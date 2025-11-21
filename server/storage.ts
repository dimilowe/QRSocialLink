import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  scans,
  followers,
  likes,
  comments,
  qrDrops,
  campaigns,
  destinations,
  frames,
  overlayRenditions,
  scanEvents,
  feedback,
  type User,
  type InsertUser,
  type Scan,
  type InsertScan,
  type Follower,
  type InsertFollower,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type QrDrop,
  type InsertQrDrop,
  type Campaign,
  type InsertCampaign,
  type Destination,
  type InsertDestination,
  type Frame,
  type InsertFrame,
  type OverlayRendition,
  type InsertOverlayRendition,
  type ScanEvent,
  type InsertScanEvent,
  type Feedback,
  type InsertFeedback,
  type ScanWithUser,
  type CommentWithUser,
  type CampaignWithStats,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(
    userId: string,
    customerId: string | null,
    subscriptionId: string | null
  ): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;
  updateUsername(userId: string, username: string): Promise<User>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  getScanBySlug(slug: string): Promise<Scan | undefined>;
  updateScan(scanId: string, updates: Partial<Scan>): Promise<Scan>;
  updateScanRedirectUrl(scanId: string, redirectUrl: string | null): Promise<Scan>;
  getUserScans(userId: string, limit?: number): Promise<Scan[]>;
  getUserScansPaginated(userId: string, limit: number, offset: number): Promise<Scan[]>;
  getFeed(currentUserId?: string, limit?: number): Promise<ScanWithUser[]>;
  
  followUser(followerId: string, followedId: string): Promise<Follower>;
  unfollowUser(followerId: string, followedId: string): Promise<void>;
  getFollowers(userId: string): Promise<Follower[]>;
  getFollowing(userId: string): Promise<Follower[]>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  
  likeScan(userId: string, scanId: string): Promise<Like | void>;
  unlikeScan(userId: string, scanId: string): Promise<void>;
  getScanLikes(scanId: string): Promise<Like[]>;
  hasUserLikedScan(userId: string, scanId: string): Promise<boolean>;
  
  createComment(comment: InsertComment): Promise<Comment>;
  getScanComments(scanId: string): Promise<CommentWithUser[]>;
  
  getUserStats(userId: string): Promise<{
    scansCount: number;
    followersCount: number;
    followingCount: number;
  }>;

  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaignBySlug(slug: string): Promise<Campaign | undefined>;
  getUserCampaigns(userId: string): Promise<Campaign[]>;
  updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(campaignId: string): Promise<void>;
  
  createDestination(destination: InsertDestination): Promise<Destination>;
  getDestination(id: string): Promise<Destination | undefined>;
  getCampaignDestinations(campaignId: string): Promise<Destination[]>;
  updateDestination(destinationId: string, updates: Partial<Destination>): Promise<Destination>;
  deleteDestination(destinationId: string): Promise<void>;
  incrementDestinationImpressions(destinationId: string): Promise<void>;
  incrementDestinationConversions(destinationId: string): Promise<void>;
  
  createScanEvent(event: InsertScanEvent): Promise<ScanEvent>;
  getCampaignEvents(campaignId: string, limit?: number): Promise<ScanEvent[]>;
  getScanEvents(scanId: string, limit?: number): Promise<ScanEvent[]>;
  
  createFrame(frame: InsertFrame): Promise<Frame>;
  getFrame(id: string): Promise<Frame | undefined>;
  getFrames(): Promise<Frame[]>;
  getUserFrames(userId: string): Promise<Frame[]>;
  
  createOverlayRendition(rendition: InsertOverlayRendition): Promise<OverlayRendition>;
  getOverlayRendition(id: string): Promise<OverlayRendition | undefined>;
  getUserOverlayRenditions(userId: string): Promise<OverlayRendition[]>;
  claimQueuedOverlayRendition(): Promise<OverlayRendition | null>;
  updateOverlayRendition(id: string, updates: Partial<OverlayRendition>): Promise<OverlayRendition>;
  deleteOverlayRendition(id: string): Promise<void>;
  
  createFeedback(insertFeedback: InsertFeedback): Promise<Feedback>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserStripeInfo(
    userId: string,
    customerId: string | null,
    subscriptionId: string | null
  ): Promise<User> {
    const result = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ plan })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ username })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async createScan(insertScan: InsertScan): Promise<Scan> {
    const result = await db.insert(scans).values(insertScan).returning();
    return result[0];
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
    return result[0];
  }

  async getScanBySlug(slug: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.dynamicSlug, slug)).limit(1);
    return result[0];
  }

  async updateScan(scanId: string, updates: Partial<Scan>): Promise<Scan> {
    const result = await db
      .update(scans)
      .set(updates)
      .where(eq(scans.id, scanId))
      .returning();
    return result[0];
  }

  async updateScanRedirectUrl(scanId: string, redirectUrl: string | null): Promise<Scan> {
    const result = await db
      .update(scans)
      .set({ redirectUrl: redirectUrl || null })
      .where(eq(scans.id, scanId))
      .returning();
    return result[0];
  }

  async getUserScans(userId: string, limit?: number): Promise<Scan[]> {
    const query = db
      .select()
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  async getUserScansPaginated(userId: string, limit: number, offset: number): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getFeed(currentUserId?: string, limit: number = 50): Promise<ScanWithUser[]> {
    const feedScans = await db
      .select({
        scan: scans,
        user: users,
      })
      .from(scans)
      .innerJoin(users, eq(scans.userId, users.id))
      .where(eq(scans.isPublic, true))
      .orderBy(desc(scans.createdAt))
      .limit(limit);

    const scansWithCounts = await Promise.all(
      feedScans.map(async ({ scan, user }) => {
        const likesCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(likes)
          .where(eq(likes.scanId, scan.id));
        
        const commentsCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(eq(comments.scanId, scan.id));

        const isLiked = currentUserId
          ? await this.hasUserLikedScan(currentUserId, scan.id)
          : false;

        return {
          ...scan,
          user,
          likesCount: likesCountResult[0]?.count || 0,
          commentsCount: commentsCountResult[0]?.count || 0,
          isLiked,
        };
      })
    );

    return scansWithCounts;
  }

  async followUser(followerId: string, followedId: string): Promise<Follower> {
    const existing = await db
      .select()
      .from(followers)
      .where(
        and(
          eq(followers.followerId, followerId),
          eq(followers.followedId, followedId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(followers)
      .values({ followerId, followedId })
      .returning();
    return result[0];
  }

  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    await db
      .delete(followers)
      .where(
        and(
          eq(followers.followerId, followerId),
          eq(followers.followedId, followedId)
        )
      );
  }

  async getFollowers(userId: string): Promise<Follower[]> {
    return await db
      .select()
      .from(followers)
      .where(eq(followers.followedId, userId));
  }

  async getFollowing(userId: string): Promise<Follower[]> {
    return await db
      .select()
      .from(followers)
      .where(eq(followers.followerId, userId));
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(followers)
      .where(
        and(
          eq(followers.followerId, followerId),
          eq(followers.followedId, followedId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async likeScan(userId: string, scanId: string): Promise<Like | void> {
    const existing = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.scanId, scanId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.scanId, scanId)));
      return;
    }

    const result = await db
      .insert(likes)
      .values({ userId, scanId })
      .returning();
    return result[0];
  }

  async unlikeScan(userId: string, scanId: string): Promise<void> {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.scanId, scanId)));
  }

  async getScanLikes(scanId: string): Promise<Like[]> {
    return await db.select().from(likes).where(eq(likes.scanId, scanId));
  }

  async hasUserLikedScan(userId: string, scanId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.scanId, scanId)))
      .limit(1);
    return result.length > 0;
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(insertComment).returning();
    return result[0];
  }

  async getScanComments(scanId: string): Promise<CommentWithUser[]> {
    const result = await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.scanId, scanId))
      .orderBy(desc(comments.createdAt));

    return result.map(({ comment, user }) => ({
      ...comment,
      user,
    }));
  }

  async getUserStats(userId: string): Promise<{
    scansCount: number;
    followersCount: number;
    followingCount: number;
  }> {
    const scansCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scans)
      .where(eq(scans.userId, userId));

    const followersCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(followers)
      .where(eq(followers.followedId, userId));

    const followingCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(followers)
      .where(eq(followers.followerId, userId));

    return {
      scansCount: scansCountResult[0]?.count || 0,
      followersCount: followersCountResult[0]?.count || 0,
      followingCount: followingCountResult[0]?.count || 0,
    };
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(insertCampaign).returning();
    return result[0];
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return result[0];
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
    const result = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
    return result[0];
  }

  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign> {
    const result = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
      .returning();
    return result[0];
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, campaignId));
  }

  async createDestination(insertDestination: InsertDestination): Promise<Destination> {
    const result = await db.insert(destinations).values(insertDestination).returning();
    return result[0];
  }

  async getDestination(id: string): Promise<Destination | undefined> {
    const result = await db.select().from(destinations).where(eq(destinations.id, id)).limit(1);
    return result[0];
  }

  async getCampaignDestinations(campaignId: string): Promise<Destination[]> {
    return await db
      .select()
      .from(destinations)
      .where(eq(destinations.campaignId, campaignId))
      .orderBy(desc(destinations.createdAt));
  }

  async updateDestination(destinationId: string, updates: Partial<Destination>): Promise<Destination> {
    const result = await db
      .update(destinations)
      .set(updates)
      .where(eq(destinations.id, destinationId))
      .returning();
    return result[0];
  }

  async deleteDestination(destinationId: string): Promise<void> {
    await db.delete(destinations).where(eq(destinations.id, destinationId));
  }

  async incrementDestinationImpressions(destinationId: string): Promise<void> {
    await db
      .update(destinations)
      .set({ impressions: sql`${destinations.impressions} + 1` })
      .where(eq(destinations.id, destinationId));
  }

  async incrementDestinationConversions(destinationId: string): Promise<void> {
    await db
      .update(destinations)
      .set({ conversions: sql`${destinations.conversions} + 1` })
      .where(eq(destinations.id, destinationId));
  }

  async createScanEvent(insertEvent: InsertScanEvent): Promise<ScanEvent> {
    const result = await db.insert(scanEvents).values(insertEvent).returning();
    return result[0];
  }

  async getCampaignEvents(campaignId: string, limit: number = 1000): Promise<ScanEvent[]> {
    return await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.campaignId, campaignId))
      .orderBy(desc(scanEvents.timestamp))
      .limit(limit);
  }

  async getScanEvents(scanId: string, limit: number = 1000): Promise<ScanEvent[]> {
    return await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.scanId, scanId))
      .orderBy(desc(scanEvents.timestamp))
      .limit(limit);
  }

  async createFrame(insertFrame: InsertFrame): Promise<Frame> {
    const result = await db.insert(frames).values(insertFrame).returning();
    return result[0];
  }

  async getFrame(id: string): Promise<Frame | undefined> {
    const result = await db.select().from(frames).where(eq(frames.id, id)).limit(1);
    return result[0];
  }

  async getFrames(): Promise<Frame[]> {
    return await db
      .select()
      .from(frames)
      .orderBy(desc(frames.createdAt));
  }

  async getUserFrames(userId: string): Promise<Frame[]> {
    return await db
      .select()
      .from(frames)
      .where(eq(frames.userId, userId))
      .orderBy(desc(frames.createdAt));
  }

  async createOverlayRendition(insertRendition: InsertOverlayRendition): Promise<OverlayRendition> {
    const result = await db.insert(overlayRenditions).values(insertRendition).returning();
    return result[0];
  }

  async getOverlayRendition(id: string): Promise<OverlayRendition | undefined> {
    const result = await db
      .select()
      .from(overlayRenditions)
      .where(eq(overlayRenditions.id, id))
      .limit(1);
    return result[0];
  }

  async getUserOverlayRenditions(userId: string): Promise<OverlayRendition[]> {
    const overlays = await db
      .select({
        rendition: overlayRenditions,
        scan: scans,
      })
      .from(overlayRenditions)
      .innerJoin(scans, eq(overlayRenditions.scanId, scans.id))
      .where(eq(scans.userId, userId))
      .orderBy(desc(overlayRenditions.createdAt));

    return overlays.map(({ rendition }) => rendition);
  }

  async claimQueuedOverlayRendition(): Promise<OverlayRendition | null> {
    const queued = await db
      .select()
      .from(overlayRenditions)
      .where(eq(overlayRenditions.status, "queued"))
      .orderBy(overlayRenditions.createdAt)
      .limit(1);

    if (queued.length === 0) {
      return null;
    }

    const result = await db
      .update(overlayRenditions)
      .set({ status: "rendering" })
      .where(and(
        eq(overlayRenditions.id, queued[0].id),
        eq(overlayRenditions.status, "queued")
      ))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  async updateOverlayRendition(id: string, updates: Partial<OverlayRendition>): Promise<OverlayRendition> {
    const result = await db
      .update(overlayRenditions)
      .set(updates)
      .where(eq(overlayRenditions.id, id))
      .returning();
    return result[0];
  }

  async deleteOverlayRendition(id: string): Promise<void> {
    await db
      .delete(overlayRenditions)
      .where(eq(overlayRenditions.id, id));
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values(insertFeedback).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
