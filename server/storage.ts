import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  scans,
  followers,
  likes,
  comments,
  qrDrops,
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
  type ScanWithUser,
  type CommentWithUser,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(
    userId: string,
    customerId: string,
    subscriptionId: string
  ): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;
  
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
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
    customerId: string,
    subscriptionId: string
  ): Promise<User> {
    const result = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: "pro",
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

  async createScan(insertScan: InsertScan): Promise<Scan> {
    const result = await db.insert(scans).values(insertScan).returning();
    return result[0];
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
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
}

export const storage = new DatabaseStorage();
