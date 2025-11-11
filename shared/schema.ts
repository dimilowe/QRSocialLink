import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, uuid, jsonb } from "drizzle-orm/pg-core";
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
    maxQRs: 0,
    canEdit: false,
    canDownload: false,
    canSave: false,
    hasAnalytics: false,
    hasBranding: false,
  },
  starter: {
    maxQRs: 20,
    canEdit: true,
    canDownload: true,
    canSave: true,
    hasAnalytics: true,
    hasBranding: false,
  },
  pro: {
    maxQRs: 50,
    canEdit: true,
    canDownload: true,
    canSave: true,
    hasAnalytics: true,
    hasBranding: false,
  },
  enterprise: {
    maxQRs: -1,
    canEdit: true,
    canDownload: true,
    canSave: true,
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
  backgroundImage: text("background_image"),
  borderShape: text("border_shape").default("square"),
  imageFitMode: text("image_fit_mode").default("cover"),
  polaroidText: text("polaroid_text"),
  canvasFillEnabled: boolean("canvas_fill_enabled").default(false),
  canvasFillColor: text("canvas_fill_color").default("#FFFFFF"),
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

export type RenderConfig = {
  textFont?: string;
  textSize?: number;
  textColor?: string;
  qrSizeModifier?: number;
  qrXOffset?: number;
  qrYOffset?: number;
  qrBaseSize?: number;
  qrBaseX?: number;
  qrBaseY?: number;
  overlayColor?: string;
  overlayBackgroundImage?: string;
  overlayImageFit?: "cover" | "contain" | "stretch";
  overlayWidth?: number;
  overlayHeight?: number;
  borderRadius?: number;
};

export const overlayRenditions = pgTable("overlay_renditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  frameId: uuid("frame_id").notNull().references(() => frames.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  outputPath: text("output_path"),
  aspect: text("aspect").notNull(),
  ctaText: text("cta_text"),
  renderConfig: jsonb("render_config").$type<RenderConfig | null>(),
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

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const insertOverlayRenditionSchema = createInsertSchema(overlayRenditions, {
  renderConfig: z.object({
    textFont: z.string().optional(),
    textSize: z.number().optional(),
    textColor: z.string().optional(),
    qrSizeModifier: z.number().optional(),
    qrXOffset: z.number().optional(),
    qrYOffset: z.number().optional(),
    qrBaseSize: z.number().optional(),
    qrBaseX: z.number().optional(),
    qrBaseY: z.number().optional(),
    overlayColor: z.string().optional(),
    overlayBackgroundImage: z.string().optional(),
    overlayImageFit: z.enum(["cover", "contain", "stretch"]).optional(),
    overlayWidth: z.number().optional(),
    overlayHeight: z.number().optional(),
    borderRadius: z.number().optional(),
  }).optional().nullable(),
})
  .omit({
    id: true,
    createdAt: true,
    completedAt: true,
  })
  .extend({
    ctaText: z.string().max(120).optional().nullable(),
  });

export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  timestamp: true,
});

export const insertFeedbackSchema = createInsertSchema(feedback)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    type: z.enum(["bug_report", "feature_request", "improvement", "general"]),
    subject: z.string().min(1, "Subject is required").max(200),
    message: z.string().min(10, "Message must be at least 10 characters").max(2000),
    email: z.string().email("Invalid email address"),
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

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

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

// Platform-specific overlay presets with safe zones
export const PLATFORM_PRESETS = {
  TIKTOK: {
    id: "tiktok",
    name: "TikTok / Shorts / Reels",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    description: "Vertical video for TikTok, YouTube Shorts, Instagram Reels",
    safeZone: {
      top: 131,
      bottom: 367,
      left: 120,
      right: 120,
    },
  },
  YOUTUBE_LONG: {
    id: "youtube_long",
    name: "YouTube Long-Form",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    description: "Horizontal video for YouTube standard videos",
    safeZone: {
      top: 108,
      bottom: 108,
      left: 192,
      right: 192,
    },
  },
  INSTAGRAM_FEED: {
    id: "instagram_feed",
    name: "Instagram Feed",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    description: "Instagram feed post optimized dimensions",
    safeZone: {
      top: 108,
      bottom: 135,
      left: 60,
      right: 120,
    },
  },
  FACEBOOK_VIDEO: {
    id: "facebook_video",
    name: "Facebook Video",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    description: "Square video for Facebook and Instagram",
    safeZone: {
      top: 108,
      bottom: 108,
      left: 108,
      right: 108,
    },
  },
} as const;

export type PlatformPresetId = typeof PLATFORM_PRESETS[keyof typeof PLATFORM_PRESETS]["id"];

// Overlay template positions
export const OVERLAY_POSITIONS = {
  TOP_BANNER: "top_banner",
  BOTTOM_BANNER: "bottom_banner",
  TOP_THIRD: "top_third",
  BOTTOM_THIRD: "bottom_third",
  SIDE_COLUMN: "side_column",
  CORNER: "corner",
} as const;

export type OverlayPosition = typeof OVERLAY_POSITIONS[keyof typeof OVERLAY_POSITIONS];

// Overlay template styles
export const OVERLAY_STYLES = {
  LUXURY: "luxury",
  NEON: "neon",
  MINIMAL: "minimal",
  FASHION: "fashion",
  TECH: "tech",
  GRADIENT: "gradient",
} as const;

export type OverlayStyle = typeof OVERLAY_STYLES[keyof typeof OVERLAY_STYLES];
