import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";
import { insertScanSchema, insertCommentSchema } from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

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
      const currentUserPlan = req.user?.plan || "free";
      
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      
      const stats = await storage.getUserStats(profileUserId);
      
      if (isOwnProfile && currentUserPlan === "pro") {
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
        const scans = await storage.getUserScans(profileUserId, 10);
        res.json({ 
          scans, 
          hasMore: isOwnProfile && stats.scansCount > 10, 
          total: stats.scansCount,
          page: 1,
          pageSize: 10
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
          if (users) {
            await storage.updateUserPlan(users.id, "pro");
            console.log(`User ${users.id} upgraded to Pro (invoice paid)`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const users = await storage.getUserByStripeCustomerId(customerId);
          if (users) {
            const activePlanStatuses = ["active", "trialing", "past_due"];
            const plan = activePlanStatuses.includes(subscription.status) ? "pro" : "free";
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

    if (user.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );

      const invoice: any = await stripe.invoices.retrieve(
        subscription.latest_invoice as string,
        { expand: ['payment_intent'] }
      );

      res.send({
        subscriptionId: subscription.id,
        clientSecret: invoice.payment_intent?.client_secret,
      });

      return;
    }

    if (!user.email) {
      throw new Error("No user email on file");
    }

    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
      });

      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: 1500,
        recurring: {
          interval: "month",
        },
        product_data: {
          name: "QR Social Pro",
        } as any,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      await storage.updateUserStripeInfo(user.id, customer.id, subscription.id);

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
