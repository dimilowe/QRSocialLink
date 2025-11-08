import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const PLAN_TIERS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export type PlanTier = typeof PLAN_TIERS[keyof typeof PLAN_TIERS];

export const PLAN_LIMITS = {
  free: {
    maxQRs: 1,
    canEdit: false,
    hasAnalytics: false,
    hasBranding: false,
  },
  starter: {
    maxQRs: 20,
    canEdit: true,
    hasAnalytics: true,
    hasBranding: false,
  },
  pro: {
    maxQRs: 50,
    canEdit: true,
    hasAnalytics: true,
    hasBranding: false,
  },
  enterprise: {
    maxQRs: -1, // unlimited
    canEdit: true,
    hasAnalytics: true,
    hasBranding: true,
  },
} as const;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  qrImageUrl: text("qr_image_url").notNull(),
  decodedUrl: text("decoded_url").notNull(),
  redirectUrl: text("redirect_url"),
  dynamicSlug: text("dynamic_slug"),
  title: text("title"),
  type: text("type").notNull().default("scanned"),
  isPublic: boolean("is_public").notNull().default(true),
  topText: text("top_text"),
  bottomText: text("bottom_text"),
  borderColor: text("border_color"),
  enableBranding: boolean("enable_branding").default(false),
  foregroundColor: text("foreground_color"),
  backgroundColor: text("background_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followers = pgTable("followers", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followedId: uuid("followed_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const likes = pgTable("likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qrDrops = pgTable("qr_drops", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  qrImageUrl: text("qr_image_url").notNull(),
  decodedUrl: text("decoded_url").notNull(),
  title: text("title").notNull(),
  activeUntil: timestamp("active_until"),
  scanCount: integer("scan_count").notNull().default(0),
  maxScans: integer("max_scans"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  abStrategy: text("ab_strategy").notNull().default("epsilon_greedy"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const destinations = pgTable("destinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  weight: integer("weight").notNull().default(50),
  impressions: integer("impressions").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const frames = pgTable("frames", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  srcPath: text("src_path").notNull(),
  safeArea: text("safe_area").notNull(),
  loop: boolean("loop").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const overlayRenditions = pgTable("overlay_renditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  frameId: uuid("frame_id").notNull().references(() => frames.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  outputPath: text("output_path"),
  aspect: text("aspect").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const scanEvents = pgTable("scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),
  destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "set null" }),
  frameId: uuid("frame_id").references(() => frames.id, { onDelete: "set null" }),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  referrer: text("referrer"),
  country: text("country"),
  platform: text("platform"),
  deviceType: text("device_type"),
  os: text("os"),
  osVersion: text("os_version"),
  browser: text("browser"),
  browserVersion: text("browser_version"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  plan: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  createdAt: true,
});

export const insertFollowerSchema = createInsertSchema(followers).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertQrDropSchema = createInsertSchema(qrDrops).omit({
  id: true,
  createdAt: true,
  scanCount: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDestinationSchema = createInsertSchema(destinations).omit({
  id: true,
  createdAt: true,
  impressions: true,
  conversions: true,
});

export const insertFrameSchema = createInsertSchema(frames).omit({
  id: true,
  createdAt: true,
});

export const insertOverlayRenditionSchema = createInsertSchema(overlayRenditions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;

export type InsertFollower = z.infer<typeof insertFollowerSchema>;
export type Follower = typeof followers.$inferSelect;

export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likes.$inferSelect;

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export type InsertQrDrop = z.infer<typeof insertQrDropSchema>;
export type QrDrop = typeof qrDrops.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertDestination = z.infer<typeof insertDestinationSchema>;
export type Destination = typeof destinations.$inferSelect;

export type InsertFrame = z.infer<typeof insertFrameSchema>;
export type Frame = typeof frames.$inferSelect;

export type InsertOverlayRendition = z.infer<typeof insertOverlayRenditionSchema>;
export type OverlayRendition = typeof overlayRenditions.$inferSelect;

export type InsertScanEvent = z.infer<typeof insertScanEventSchema>;
export type ScanEvent = typeof scanEvents.$inferSelect;

export type ScanWithUser = Scan & {
  user: User;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
};

export type CommentWithUser = Comment & {
  user: User;
};

export type CampaignWithStats = Campaign & {
  totalScans: number;
  totalConversions: number;
  destinationCount: number;
};
