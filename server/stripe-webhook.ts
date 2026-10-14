import type { Express, Request, Response } from "express";
import type Stripe from "stripe";
import crypto from "crypto";
import type { IStorage } from "./storage";
import type { PlanTier } from "@shared/schema";

export function registerStripeWebhookRoute(
  app: Express,
  storage: IStorage,
  stripe: Stripe,
) {
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send("Webhook signature or secret missing");
    }

    let event: Stripe.Event;
    try {
      const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.userId;
          const planTier = (session.metadata?.planTier || "pro") as PlanTier;

          if (userId) {
            await storage.updateUserStripeInfo(userId, customerId, subscriptionId);
            await storage.updateUserPlan(userId, planTier);
            console.log(`Checkout completed: User ${userId} subscribed to ${planTier}`);
          } else {
            const email = session.customer_details?.email?.trim().toLowerCase();
            if (email && customerId && subscriptionId) {
              let user = await storage.getUserByEmail(email);
              if (!user) {
                try {
                  user = await storage.createUser({
                    email,
                    username: email,
                    password: crypto.randomBytes(48).toString("hex"),
                  });
                } catch (error) {
                  user = await storage.getUserByEmail(email);
                  if (!user) throw error;
                }
              } else {
                console.log(`[Checkout] Linked existing account ${user.id} to guest checkout`);
              }
              await storage.updateUserStripeInfo(user.id, customerId, subscriptionId);
              await storage.updateUserPlan(user.id, planTier);
            }
          }
          break;
        }
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          const user = await storage.getUserByStripeCustomerId(customerId);
          const invoiceSubscriptionId = (invoice as any).subscription;
          if (user && invoiceSubscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId as string);
            const planTier = (subscription.metadata?.planTier || "pro") as PlanTier;
            await storage.updateUserPlan(user.id, planTier);
            console.log(`User ${user.id} upgraded to ${planTier} (invoice paid)`);
          }
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const activePlanStatuses = ["active", "trialing", "past_due"];
            const planTier = (subscription.metadata?.planTier || "pro") as PlanTier;
            const plan = activePlanStatuses.includes(subscription.status) ? planTier : "free";
            await storage.updateUserPlan(user.id, plan);
            console.log(`User ${user.id} subscription updated: ${plan} (status: ${subscription.status})`);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserPlan(user.id, "free");
            console.log(`User ${user.id} downgraded to free (subscription deleted)`);
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
          if (user) console.log(`Payment failed for user ${user.id}`);
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
}
