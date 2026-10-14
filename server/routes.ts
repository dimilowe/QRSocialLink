import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";
import { nanoid } from "nanoid";
import { insertScanSchema, insertCommentSchema, insertCampaignSchema, insertDestinationSchema, insertOverlayRenditionSchema, insertFeedbackSchema, PLAN_TIERS, PLAN_LIMITS, type PlanTier } from "@shared/schema";
import { createABStrategy } from "./services/ab-testing";
import crypto from "crypto";
import { UAParser } from "ua-parser-js";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { pushScanEventToVcmOs } from "./integrations/vcmOsClient";

const execAsync = promisify(exec);

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia" as any,
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
  unlimited: {
    amount: 9900, // $99
    name: "QR Social Unlimited",
  },
} as const;

function detectPlatform(referrer: string | null): string | null {
  if (!referrer) return null;
  
  const referrerLower = referrer.toLowerCase();
  
  if (referrerLower.includes('tiktok.com')) return 'TikTok';
  if (referrerLower.includes('instagram.com')) return 'Instagram';
  if (referrerLower.includes('facebook.com')) return 'Facebook';
  if (referrerLower.includes('youtube.com') || referrerLower.includes('youtu.be')) return 'YouTube';
  if (referrerLower.includes('twitter.com') || referrerLower.includes('x.com')) return 'Twitter/X';
  if (referrerLower.includes('linkedin.com')) return 'LinkedIn';
  if (referrerLower.includes('pinterest.com')) return 'Pinterest';
  if (referrerLower.includes('reddit.com')) return 'Reddit';
  if (referrerLower.includes('snapchat.com')) return 'Snapchat';
  if (referrerLower.includes('whatsapp.com')) return 'WhatsApp';
  if (referrerLower.includes('telegram.')) return 'Telegram';
  if (referrerLower.includes('google.com')) return 'Google Search';
  
  return 'Other';
}

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

  app.get("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const scans = await storage.getUserScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userPlan = req.user.plan as PlanTier;
      const canSave = PLAN_LIMITS[userPlan]?.canSave;
      
      if (!canSave) {
        return res.status(403).json({ 
          message: "Upgrade to a paid plan to save QR codes. You can build and preview for free, but saving requires a subscription.",
          requiresUpgrade: true
        });
      }

      const dynamicSlug = nanoid(10);
      const validatedData = insertScanSchema.parse({
        ...req.body,
        userId: req.user.id,
        dynamicSlug,
      });
      const scan = await storage.createScan(validatedData);
      res.json(scan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/scans/:id", async (req, res) => {
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
      const canEdit = PLAN_LIMITS[userPlan]?.canEdit;
      
      const updateSchema = insertScanSchema.partial().omit({ userId: true, type: true, isPublic: true });
      console.log("[PATCH scan] Received keys:", Object.keys(req.body), "qrImageUrl present:", !!req.body.qrImageUrl);
      const validatedData = updateSchema.parse(req.body);
      console.log("[PATCH scan] Validated keys:", Object.keys(validatedData), "qrImageUrl present:", !!validatedData.qrImageUrl);
      
      if (!canEdit) {
        const freeEditableFields = ['title'];
        
        for (const field of Object.keys(validatedData)) {
          if (!freeEditableFields.includes(field)) {
            const oldValue = (scan as any)[field];
            const newValue = (validatedData as any)[field];
            
            console.log(`Comparing field ${field}:`, { oldValue, newValue, equal: oldValue === newValue });
            
            if (oldValue !== newValue) {
              console.log(`Blocked: Field ${field} was changed from ${oldValue} to ${newValue}`);
              return res.status(403).json({ 
                message: `Upgrade to Starter or higher to edit QR code design and settings. Free users can only edit the title. (Field changed: ${field})` 
              });
            }
          }
        }
      }
      
      const updatedScan = await storage.updateScan(req.params.id, validatedData);
      
      res.json(updatedScan);
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

  app.delete("/api/scans/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const scan = await storage.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ message: "QR code not found" });
      }

      if (scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this QR code" });
      }

      await storage.deleteScan(req.params.id);
      res.json({ message: "QR code deleted successfully" });
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

  app.patch("/api/user/username", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { username } = req.body;
      
      if (!username || !username.trim()) {
        return res.status(400).json({ message: "Username is required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const updatedUser = await storage.updateUsername(req.user.id, username.trim());
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/settings`,
      });

      res.json({ url: session.url });
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

  app.post("/api/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const slug = nanoid(10);
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        userId: req.user.id,
        slug,
        abStrategy: "weighted_random",
      });
      const campaign = await storage.createCampaign(validatedData);
      res.json(campaign);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaigns = await storage.getUserCampaigns(req.user.id);
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const destinations = await storage.getCampaignDestinations(campaign.id);
      const events = await storage.getCampaignEvents(campaign.id, 1000);
      
      res.json({
        ...campaign,
        destinations,
        totalScans: events.length,
        totalConversions: destinations.reduce((sum, d) => sum + d.conversions, 0),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updateSchema = insertCampaignSchema.partial().omit({ userId: true, slug: true });
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateCampaign(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campaign deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:id/destinations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const destinations = await storage.getCampaignDestinations(req.params.id);
      res.json(destinations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/campaigns/:campaignId/destinations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const validatedData = insertDestinationSchema.parse({
        ...req.body,
        campaignId: req.params.campaignId,
      });
      const destination = await storage.createDestination(validatedData);
      res.json(destination);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/destinations/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const destination = await storage.getDestination(req.params.id);
      if (!destination) {
        return res.status(404).json({ message: "Destination not found" });
      }

      const campaign = await storage.getCampaign(destination.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updateSchema = insertDestinationSchema.partial().omit({ campaignId: true });
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateDestination(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/destinations/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const destination = await storage.getDestination(req.params.id);
      if (!destination) {
        return res.status(404).json({ message: "Destination not found" });
      }

      const campaign = await storage.getCampaign(destination.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteDestination(req.params.id);
      res.json({ message: "Destination deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/r/:slug", async (req, res) => {
    try {
      const campaign = await storage.getCampaignBySlug(req.params.slug);
      if (!campaign) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Campaign Not Found - QR Social</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .container { max-width: 400px; }
                h1 { color: #9333ea; font-size: 48px; margin: 0 0 16px 0; }
                p { color: #a0a0a0; line-height: 1.6; }
                a { color: #9333ea; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>404</h1>
                <p>Campaign not found. This QR code may have been deleted or the link is invalid.</p>
                <p><a href="/">Visit QR Social</a></p>
              </div>
            </body>
          </html>
        `);
      }

      const destinations = await storage.getCampaignDestinations(campaign.id);
      if (destinations.length === 0) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>No Destinations - QR Social</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .container { max-width: 500px; }
                h1 { color: #9333ea; font-size: 36px; margin: 0 0 16px 0; }
                p { color: #a0a0a0; line-height: 1.6; margin: 12px 0; }
                .campaign-name { color: #fff; font-weight: 600; }
                a { color: #9333ea; text-decoration: none; display: inline-block; margin-top: 20px; padding: 12px 24px; border: 1px solid #9333ea; border-radius: 8px; }
                a:hover { background: #9333ea; color: #fff; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ Setup Required</h1>
                <p class="campaign-name">"${campaign.name}"</p>
                <p>This campaign hasn't been configured yet. The campaign owner needs to add at least one destination URL before this QR code will work.</p>
                <a href="/">Visit QR Social</a>
              </div>
            </body>
          </html>
        `);
      }

      const strategy = createABStrategy(campaign.abStrategy);
      const selectedDestination = strategy.selectDestination(destinations);

      const ipHash = crypto
        .createHash("sha256")
        .update((req.ip || "unknown") + (process.env.SESSION_SECRET || "salt"))
        .digest("hex");

      const userAgentString = req.headers["user-agent"] || "";
      const parser = new UAParser(userAgentString);
      const uaResult = parser.getResult();
      
      const deviceType = uaResult.device.type || (uaResult.device.vendor ? 'mobile' : 'desktop');
      const platform = detectPlatform(req.headers.referer || null);

      await storage.createScanEvent({
        campaignId: campaign.id,
        destinationId: selectedDestination.id,
        frameId: null,
        userAgent: userAgentString || null,
        ipHash,
        referrer: req.headers.referer || null,
        country: null,
        platform,
        deviceType,
        os: uaResult.os.name || null,
        osVersion: uaResult.os.version || null,
        browser: uaResult.browser.name || null,
        browserVersion: uaResult.browser.version || null,
        scanId: null,
      });

      await storage.incrementDestinationImpressions(selectedDestination.id);

      res.redirect(302, selectedDestination.url);
    } catch (error: any) {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error - QR Social</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .container { max-width: 400px; }
              h1 { color: #ef4444; font-size: 36px; margin: 0 0 16px 0; }
              p { color: #a0a0a0; line-height: 1.6; }
              a { color: #9333ea; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Error</h1>
              <p>Something went wrong while processing this QR code. Please try again later.</p>
              <p><a href="/">Visit QR Social</a></p>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.get("/q/:slug", async (req, res) => {
    try {
      const scan = await storage.getScanBySlug(req.params.slug);
      if (!scan) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code Not Found - QR Social</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .container { max-width: 400px; }
                h1 { color: #9333ea; font-size: 48px; margin: 0 0 16px 0; }
                p { color: #a0a0a0; line-height: 1.6; }
                a { color: #9333ea; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>404</h1>
                <p>QR code not found. This QR code may have been deleted or the link is invalid.</p>
                <p><a href="/">Visit QR Social</a></p>
              </div>
            </body>
          </html>
        `);
      }

      let destinationUrl: string;
      let selectedDestinationId: string | null = null;
      
      if (scan.campaignId) {
        const campaign = await storage.getCampaign(scan.campaignId);
        if (campaign) {
          const destinations = await storage.getCampaignDestinations(scan.campaignId);
          if (destinations && destinations.length > 0) {
            const strategy = createABStrategy(campaign.abStrategy);
            const selectedDestination = strategy.selectDestination(destinations);
            destinationUrl = selectedDestination.url;
            selectedDestinationId = selectedDestination.id;
            await storage.incrementDestinationImpressions(selectedDestination.id);
          } else {
            destinationUrl = scan.destination || scan.redirectUrl || scan.decodedUrl;
          }
        } else {
          destinationUrl = scan.destination || scan.redirectUrl || scan.decodedUrl;
        }
      } else {
        destinationUrl = scan.destination || scan.redirectUrl || scan.decodedUrl;
      }
      
      if (!destinationUrl) {
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Configuration Error - QR Social</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .container { max-width: 400px; }
                h1 { color: #ef4444; font-size: 36px; margin: 0 0 16px 0; }
                p { color: #a0a0a0; line-height: 1.6; }
                a { color: #9333ea; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Configuration Error</h1>
                <p>This QR code hasn't been configured properly. Please contact the QR code owner.</p>
                <p><a href="/">Visit QR Social</a></p>
              </div>
            </body>
          </html>
        `);
      }

      try {
        new URL(destinationUrl);
      } catch {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invalid URL - QR Social</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .container { max-width: 400px; }
                h1 { color: #ef4444; font-size: 36px; margin: 0 0 16px 0; }
                p { color: #a0a0a0; line-height: 1.6; }
                a { color: #9333ea; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Invalid URL</h1>
                <p>The destination URL for this QR code is invalid.</p>
                <p><a href="/">Visit QR Social</a></p>
              </div>
            </body>
          </html>
        `);
      }

      const ipHash = crypto
        .createHash("sha256")
        .update((req.ip || "unknown") + (process.env.SESSION_SECRET || "salt"))
        .digest("hex");

      const userAgentString = req.headers["user-agent"] || "";
      const parser = new UAParser(userAgentString);
      const uaResult = parser.getResult();
      
      const deviceType = uaResult.device.type || (uaResult.device.vendor ? 'mobile' : 'desktop');
      const platform = detectPlatform(req.headers.referer || null);

      await storage.createScanEvent({
        campaignId: scan.campaignId || null,
        destinationId: selectedDestinationId,
        frameId: null,
        scanId: scan.id,
        userAgent: userAgentString || null,
        ipHash,
        referrer: req.headers.referer || null,
        country: null,
        platform,
        deviceType,
        os: uaResult.os.name || null,
        osVersion: uaResult.os.version || null,
        browser: uaResult.browser.name || null,
        browserVersion: uaResult.browser.version || null,
      });

      pushScanEventToVcmOs({
        app_slug: "qr_social",
        event_type: "qr_scan",
        event_at: new Date().toISOString(),
        app_user_identifier: String(scan.userId),
        metadata: {
          qr_id: scan.id,
          scan_id: scan.id,
          destination_url: destinationUrl,
          user_agent: userAgentString,
          ip_hash: ipHash,
          device_type: deviceType,
          platform,
          os: uaResult.os.name || null,
          browser: uaResult.browser.name || null,
        },
      });

      res.redirect(302, destinationUrl);
    } catch (error: any) {
      console.error('[QR Redirect Error]:', error.message);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error - QR Social</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .container { max-width: 400px; }
              h1 { color: #ef4444; font-size: 36px; margin: 0 0 16px 0; }
              p { color: #a0a0a0; line-height: 1.6; }
              a { color: #9333ea; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Error</h1>
              <p>Something went wrong while processing this QR code. Please try again later.</p>
              <p><a href="/">Visit QR Social</a></p>
            </div>
          </body>
          </html>
      `);
    }
  });

  app.post("/api/events/conversion", async (req, res) => {
    try {
      const { campaignId, destinationId } = req.body;
      if (!destinationId) {
        return res.status(400).json({ message: "Missing destinationId" });
      }

      await storage.incrementDestinationConversions(destinationId);
      res.json({ message: "Conversion recorded" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:campaignId/analytics/devices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const events = await storage.getCampaignEvents(req.params.campaignId);
      const deviceBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const device = event.deviceType || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      res.json(deviceBreakdown);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:campaignId/analytics/platforms", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const events = await storage.getCampaignEvents(req.params.campaignId);
      const platformBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const platform = event.platform || 'Direct/Unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {});

      res.json(platformBreakdown);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:campaignId/analytics/timeseries", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const events = await storage.getCampaignEvents(req.params.campaignId);
      const timeSeriesData = events.reduce((acc: Record<string, number>, event) => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const sortedData = Object.entries(timeSeriesData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, scans: count }));

      res.json(sortedData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/campaigns/:campaignId/analytics/os", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const events = await storage.getCampaignEvents(req.params.campaignId);
      const osBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const os = event.os || 'Unknown';
        acc[os] = (acc[os] || 0) + 1;
        return acc;
      }, {});

      res.json(osBreakdown);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/scans/:scanId/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const scan = await storage.getScan(req.params.scanId);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const events = await storage.getScanEvents(req.params.scanId);
      
      const deviceBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const device = event.deviceType || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      const platformBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const platform = event.platform || 'Direct/Unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {});

      const osBreakdown = events.reduce((acc: Record<string, number>, event) => {
        const os = event.os || 'Unknown';
        acc[os] = (acc[os] || 0) + 1;
        return acc;
      }, {});

      const timeSeriesData = events.reduce((acc: Record<string, number>, event) => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const sortedTimeSeries = Object.entries(timeSeriesData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, scans: count }));

      res.json({
        totalScans: events.length,
        devices: deviceBreakdown,
        platforms: platformBreakdown,
        operatingSystems: osBreakdown,
        timeSeries: sortedTimeSeries,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.userId;
          const planTier = (session.metadata?.planTier || "pro") as PlanTier;

          if (userId) {
            // Authenticated user checkout — existing flow
            await storage.updateUserStripeInfo(userId, customerId, subscriptionId);
            await storage.updateUserPlan(userId, planTier);
            console.log(`Checkout completed: User ${userId} subscribed to ${planTier}`);
          } else {
            // Guest checkout — find or create account from Stripe email
            const email = session.customer_details?.email?.trim().toLowerCase();
            if (email && customerId && subscriptionId) {
              let user = await storage.getUserByEmail(email);
              if (!user) {
                // Clerk will verify email ownership before linking this billing account.
                try {
                  user = await storage.createUser({
                    email, username: email, password: crypto.randomBytes(48).toString("hex"),
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

  app.post("/api/create-checkout-session", async (req, res) => {
    const { planTier } = req.body;

    if (!planTier || !["starter", "pro", "unlimited"].includes(planTier)) {
      return res.status(400).json({ error: "Invalid plan tier" });
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://qrsocial.io'
      : `${req.protocol}://${req.get('host')}`;

    try {
      // ── Authenticated user path ──────────────────────────────────────────
      if (req.isAuthenticated()) {
        const user = req.user;
        console.log(`[Checkout] User ${user.id} (${user.email}) requesting ${planTier} plan. Current plan: ${user.plan}, Stripe Sub: ${user.stripeSubscriptionId}`);

        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email!,
            name: user.username,
            metadata: { userId: user.id },
          });
          customerId = customer.id;
          await storage.updateUserStripeInfo(user.id, customerId, null);
          console.log(`[Checkout] Created new Stripe customer: ${customerId}`);
        }

        if (user.stripeSubscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
            const currentPlanTier = subscription.metadata?.planTier;
            const activeStatuses = ['active', 'trialing', 'past_due'];
            const isActive = activeStatuses.includes(subscription.status);
            console.log(`[Checkout] Retrieved subscription. Plan tier: ${currentPlanTier}, Status: ${subscription.status}, Active: ${isActive}`);

            if (!isActive) {
              console.log(`[Checkout] Subscription ${subscription.status} — clearing stale data for user ${user.id}`);
              await storage.updateUserStripeInfo(user.id, customerId, null);
              if (user.plan !== 'free') await storage.updateUserPlan(user.id, 'free');
            } else if (currentPlanTier === planTier) {
              if (user.plan !== planTier) await storage.updateUserPlan(user.id, planTier);
              return res.json({
                success: true,
                message: `You already have the ${PLAN_PRICES[planTier as keyof typeof PLAN_PRICES].name} plan`,
              });
            } else if (currentPlanTier && user.plan !== currentPlanTier) {
              await storage.updateUserPlan(user.id, currentPlanTier);
            }
          } catch (subscriptionError: any) {
            console.log(`[Checkout] Error retrieving subscription: ${subscriptionError.message}`);
            if (subscriptionError.message?.includes('test mode') || subscriptionError.message?.includes('live mode')) {
              await storage.updateUserStripeInfo(user.id, customerId, null);
            }
          }
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: PLAN_PRICES[planTier as keyof typeof PLAN_PRICES].name,
                description: `QR Social ${planTier.charAt(0).toUpperCase() + planTier.slice(1)} Plan`,
              },
              unit_amount: PLAN_PRICES[planTier as keyof typeof PLAN_PRICES].amount,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          }],
          mode: 'subscription',
          success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/pricing`,
          metadata: { userId: user.id, planTier },
          subscription_data: { metadata: { userId: user.id, planTier } },
        });

        return res.json({ sessionId: session.id, url: session.url });
      }

      // ── Guest user path — no account yet, Stripe collects email ──────────
      console.log(`[Checkout] Guest requesting ${planTier} plan — creating guest checkout session`);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: PLAN_PRICES[planTier as keyof typeof PLAN_PRICES].name,
              description: `QR Social ${planTier.charAt(0).toUpperCase() + planTier.slice(1)} Plan`,
            },
            unit_amount: PLAN_PRICES[planTier as keyof typeof PLAN_PRICES].amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
        metadata: { planTier },            // no userId — webhook will create the account
        subscription_data: { metadata: { planTier } },
      });

      return res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      return res.status(400).json({ error: error.message });
    }
  });

  // Confirm payment without exposing email addresses or credentials to guests.
  app.get("/api/checkout-account", async (req, res) => {
    const sessionId = req.query.session_id as string;
    if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        paid: session.status === "complete" && session.payment_status === "paid",
      });
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
  });

  app.post("/api/generate-animated-qr", async (req, res) => {
    let tempDir: string | null = null;
    
    try {
      const { backgroundImageData, qrCodeData, imageFit } = req.body;

      if (!backgroundImageData || !qrCodeData) {
        return res.status(400).json({ message: "Missing required data" });
      }

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qr-'));
      const backgroundPath = path.join(tempDir, 'background.gif');
      const qrPath = path.join(tempDir, 'qr.png');
      const outputPath = path.join(tempDir, 'output.gif');

      const backgroundBuffer = Buffer.from(backgroundImageData.split(',')[1], 'base64');
      await fs.writeFile(backgroundPath, backgroundBuffer);

      const qrBuffer = Buffer.from(qrCodeData.split(',')[1], 'base64');
      await fs.writeFile(qrPath, qrBuffer);

      let filterComplex = '';
      if (imageFit === 'cover') {
        filterComplex = '[0:v]scale=400:400:force_original_aspect_ratio=increase,crop=400:400[bg];[bg][1:v]overlay=(W-w)/2:(H-h)/2';
      } else if (imageFit === 'contain') {
        filterComplex = '[0:v]scale=400:400:force_original_aspect_ratio=decrease,pad=400:400:(ow-iw)/2:(oh-ih)/2:white[bg];[bg][1:v]overlay=(W-w)/2:(H-h)/2';
      } else {
        filterComplex = '[0:v]scale=400:400[bg];[bg][1:v]overlay=(W-w)/2:(H-h)/2';
      }

      const ffmpegCommand = `ffmpeg -i "${backgroundPath}" -i "${qrPath}" -filter_complex "${filterComplex}" -y "${outputPath}"`;
      
      await execAsync(ffmpegCommand, { maxBuffer: 10 * 1024 * 1024 });

      const outputBuffer = await fs.readFile(outputPath);
      const base64Output = outputBuffer.toString('base64');

      res.json({ 
        animatedQrCode: `data:image/gif;base64,${base64Output}` 
      });
    } catch (error: any) {
      console.error('FFmpeg error:', error);
      res.status(500).json({ message: error.message || "Failed to generate animated QR code" });
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    }
  });

  app.get("/api/overlay-templates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const templates = await storage.getFrames();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/overlays", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const overlays = await storage.getUserOverlayRenditions(req.user.id);
      res.json(overlays);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/overlays/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const overlayId = req.params.id;
      const overlay = await storage.getOverlayRendition(overlayId);
      
      if (!overlay) {
        return res.status(404).json({ message: "Overlay not found" });
      }

      const scan = await storage.getScan(overlay.scanId);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (overlay.status !== "completed") {
        return res.status(400).json({ 
          message: `Overlay is ${overlay.status}. Please wait for processing to complete.`,
          status: overlay.status
        });
      }

      const { overlayProcessor } = req.app.locals;
      if (!overlayProcessor) {
        return res.status(500).json({ message: "Overlay processor not initialized" });
      }

      const filePath = await overlayProcessor.getOutputPath(overlayId);
      if (!filePath) {
        return res.status(404).json({ message: "Overlay file not found" });
      }

      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Download overlay error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/overlays/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const overlayId = req.params.id;
      const overlay = await storage.getOverlayRendition(overlayId);
      
      if (!overlay) {
        return res.status(404).json({ message: "Overlay not found" });
      }

      const scan = await storage.getScan(overlay.scanId);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { overlayProcessor } = req.app.locals;
      if (overlayProcessor && overlay.outputPath) {
        try {
          const filePath = await overlayProcessor.getOutputPath(overlayId);
          if (filePath) {
            await fs.unlink(filePath);
          }
        } catch (fileError) {
          console.error("Failed to delete overlay file:", fileError);
        }
      }

      await storage.deleteOverlayRendition(overlayId);

      res.json({ message: "Overlay deleted successfully" });
    } catch (error: any) {
      console.error("Delete overlay error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/overlays/generate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const validatedData = insertOverlayRenditionSchema.parse(req.body);

      const scan = await storage.getScan(validatedData.scanId);
      if (!scan) {
        return res.status(404).json({ message: "QR code not found" });
      }

      if (scan.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const frame = await storage.getFrame(validatedData.frameId);
      if (!frame) {
        return res.status(404).json({ message: "Frame template not found" });
      }

      const rendition = await storage.createOverlayRendition(validatedData);

      // Trigger immediate processing (no 5-second wait)
      const { overlayProcessor } = req.app.locals;
      if (overlayProcessor) {
        setImmediate(() => overlayProcessor.processQueue());
      }

      res.json(rendition);
    } catch (error: any) {
      console.error('Overlay generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate overlay" });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const userId = req.isAuthenticated() ? req.user.id : null;
      
      const validatedData = insertFeedbackSchema.parse({
        ...req.body,
        userId,
      });

      const feedbackSubmission = await storage.createFeedback(validatedData);
      
      res.json({ 
        message: "Thank you for your feedback! We appreciate you taking the time to help us improve.",
        id: feedbackSubmission.id 
      });
    } catch (error: any) {
      console.error('Feedback submission error:', error);
      res.status(400).json({ message: error.message || "Failed to submit feedback" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
