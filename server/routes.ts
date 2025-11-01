import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";
import { insertScanSchema, insertCommentSchema, PLAN_TIERS, PLAN_LIMITS, type PlanTier } from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

const PLAN_PRICES = {
  starter: {
    amount: 1000, // $10
    name: "QR Social Starter",
  },
  pro: {
    amount: 3000, // $30
    name: "QR Social Pro",
  },
  enterprise: {
    amount: 9900, // $99
    name: "QR Social Enterprise",
  },
} as const;

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/feed", async (req, res) => {
    try {
      const currentUserId = req.user?.id;
      const feed = await storage.getFeed(currentUserId);
      res.json(feed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const validatedData = insertScanSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const scan = await storage.createScan(validatedData);
      res.json(scan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/scans/:id/redirect", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const scan = await storage.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      if (scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to edit this scan" });
      }

      const userPlan = req.user.plan as PlanTier;
      if (!PLAN_LIMITS[userPlan]?.canEdit) {
        return res.status(403).json({ message: "Paid plan required for dynamic QR updates" });
      }

      const { redirectUrl } = req.body;
      
      if (redirectUrl === null || redirectUrl === "") {
        const updatedScan = await storage.updateScanRedirectUrl(req.params.id, null);
        return res.json(updatedScan);
      }
      
      if (typeof redirectUrl !== "string") {
        return res.status(400).json({ message: "Invalid redirect URL" });
      }

      try {
        const url = new URL(redirectUrl);
        if (!url.protocol.startsWith('https')) {
          return res.status(400).json({ message: "Redirect URLs must use HTTPS for security" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      const updatedScan = await storage.updateScanRedirectUrl(req.params.id, redirectUrl);
      res.json(updatedScan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/scans", async (req, res) => {
    try {
      const profileUserId = req.params.id;
      const isOwnProfile = req.isAuthenticated() && req.user.id === profileUserId;
      const currentUserPlan = (req.user?.plan || "free") as PlanTier;
      
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      
      const stats = await storage.getUserStats(profileUserId);
      const planLimits = PLAN_LIMITS[currentUserPlan];
      
      if (isOwnProfile && (planLimits.maxQRs === -1 || planLimits.maxQRs > 10)) {
        const offset = (page - 1) * pageSize;
        const scans = await storage.getUserScansPaginated(profileUserId, pageSize, offset);
        res.json({ 
          scans, 
          hasMore: offset + scans.length < stats.scansCount,
          total: stats.scansCount,
          page,
          pageSize
        });
      } else {
        const limit = isOwnProfile ? planLimits.maxQRs : 10;
        const scans = await storage.getUserScans(profileUserId, limit);
        res.json({ 
          scans, 
          hasMore: isOwnProfile && stats.scansCount > limit, 
          total: stats.scansCount,
          page: 1,
          pageSize: limit
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/stats", async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.params.id);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users/:id/follow", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const follower = await storage.followUser(req.user.id, req.params.id);
      res.json(follower);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users/:id/unfollow", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      await storage.unfollowUser(req.user.id, req.params.id);
      res.json({ message: "Unfollowed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/following", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const following = await storage.getFollowing(req.user.id);
      res.json(following);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scans/:id/like", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const result = await storage.likeScan(req.user.id, req.params.id);
      res.json(result || { message: "Unliked" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/scans/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getScanComments(req.params.id);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scans/:id/comments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const validatedData = insertCommentSchema.parse({
        userId: req.user.id,
        scanId: req.params.id,
        content: req.body.content,
      });
      const comment = await storage.createComment(validatedData);
      res.json(comment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send("Webhook signature or secret missing");
    }

    let event: Stripe.Event;

    try {
      const body = Buffer.isBuffer(req.body) 
        ? req.body.toString('utf8') 
        : req.body;
      
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          const users = await storage.getUserByStripeCustomerId(customerId);
          const invoiceSubscriptionId = (invoice as any).subscription;
          if (users && invoiceSubscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(
              invoiceSubscriptionId as string
            );
            const planTier = (subscription.metadata?.planTier || "pro") as PlanTier;
            await storage.updateUserPlan(users.id, planTier);
            console.log(`User ${users.id} upgraded to ${planTier} (invoice paid)`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const users = await storage.getUserByStripeCustomerId(customerId);
          if (users) {
            const activePlanStatuses = ["active", "trialing", "past_due"];
            const planTier = (subscription.metadata?.planTier || "pro") as PlanTier;
            const plan = activePlanStatuses.includes(subscription.status) ? planTier : "free";
            await storage.updateUserPlan(users.id, plan);
            console.log(`User ${users.id} subscription updated: ${plan} (status: ${subscription.status})`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const users = await storage.getUserByStripeCustomerId(customerId);
          if (users) {
            await storage.updateUserPlan(users.id, "free");
            console.log(`User ${users.id} downgraded to free (subscription deleted)`);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          const users = await storage.getUserByStripeCustomerId(customerId);
          if (users) {
            console.log(`Payment failed for user ${users.id}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/get-or-create-subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    let user = req.user;
    const { planTier } = req.body;

    if (!planTier || !["starter", "pro", "enterprise"].includes(planTier)) {
      return res.status(400).send({ error: { message: "Invalid plan tier" } });
    }

    if (!user.email) {
      throw new Error("No user email on file");
    }

    try {
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
        });
        customerId = customer.id;
      }

      const planConfig = PLAN_PRICES[planTier as keyof typeof PLAN_PRICES];

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId
        );

        const currentPlanTier = subscription.metadata?.planTier;

        if (currentPlanTier === planTier) {
          return res.send({
            subscriptionId: subscription.id,
            success: true,
            message: `You already have the ${planConfig.name} plan`,
          });
        }

        const newPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: planConfig.amount,
          recurring: {
            interval: "month",
          },
          product_data: {
            name: planConfig.name,
          } as any,
        });

        const updatedSubscription = await stripe.subscriptions.update(
          user.stripeSubscriptionId,
          {
            items: [{
              id: subscription.items.data[0].id,
              price: newPrice.id,
            }],
            metadata: {
              planTier: planTier,
            },
            proration_behavior: "create_prorations",
            expand: ["latest_invoice.payment_intent"],
          }
        );

        const invoice = updatedSubscription.latest_invoice as any;
        const paymentIntent = invoice?.payment_intent as any;

        if (!paymentIntent || paymentIntent.status === "succeeded") {
          await storage.updateUserPlan(user.id, planTier as PlanTier);
          
          return res.send({
            subscriptionId: updatedSubscription.id,
            success: true,
            message: "Subscription updated successfully",
          });
        }

        return res.send({
          subscriptionId: updatedSubscription.id,
          clientSecret: paymentIntent?.client_secret,
        });
      }

      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: planConfig.amount,
        recurring: {
          interval: "month",
        },
        product_data: {
          name: planConfig.name,
        } as any,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          planTier: planTier,
        },
      });

      await storage.updateUserStripeInfo(user.id, customerId, subscription.id);

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent as any;

      res.send({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      return res.status(400).send({ error: { message: error.message } });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
