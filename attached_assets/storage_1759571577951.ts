import {
  users,
  content,
  purchases,
  earnings,
  balances,
  payoutLogs,
  type User,
  type UpsertUser,
  type Content,
  type InsertContent,
  type Purchase,
  type InsertPurchase,
  type Earning,
  type InsertEarning,
  type Balance,
  type InsertBalance,
  type PayoutLog,
  type InsertPayoutLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sum, count, sql, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateUserPayoutInfo(userId: string, payoutMethod: string, payoutEmail: string): Promise<User>;
  enableUserPayouts(userId: string): Promise<User>;
  updateUserSubscription(userId: string, subscriptionData: {
    stripeSubscriptionId: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    subscriptionEndsAt?: Date;
  }): Promise<User>;
  
  // Content operations
  createContent(contentData: InsertContent): Promise<Content>;
  getContentByUser(userId: string): Promise<Content[]>;
  getContentById(id: number): Promise<Content | undefined>;
  getContentByIdWithUser(id: number): Promise<(Content & { user: User }) | undefined>;
  updateContent(id: number, updates: Partial<Content>): Promise<Content>;
  deleteContent(id: number): Promise<void>;
  incrementUnlockCount(contentId: number, amount: number): Promise<void>;
  
  // Purchase operations
  createPurchase(purchaseData: InsertPurchase): Promise<Purchase>;
  getPurchaseByPaymentIntent(paymentIntentId: string): Promise<Purchase | undefined>;
  updatePurchaseStatus(id: number, status: string): Promise<Purchase>;
  getPendingPayouts(): Promise<(Purchase & { content: Content; user: User })[]>;
  getPendingPurchasesByContent(contentId: number): Promise<Purchase[]>;
  markPayoutCompleted(purchaseId: number): Promise<Purchase>;
  
  // Earnings operations
  createEarning(earningData: InsertEarning): Promise<Earning>;
  getCreatorEarnings(creatorId: string): Promise<Earning[]>;
  getCreatorBalance(creatorId: string): Promise<Balance | undefined>;
  updateCreatorBalance(creatorId: string, balance: number): Promise<Balance>;
  getCreatorsForPayout(minAmount?: number): Promise<{creatorId: string, totalAvailable: number, user: User}[]>;
  markEarningsAsPaid(creatorId: string, amount: number): Promise<void>;
  createPayoutLog(payoutData: InsertPayoutLog): Promise<PayoutLog>;
  getCreatorPayoutHistory(creatorId: string): Promise<PayoutLog[]>;
  
  // Analytics
  getUserStats(userId: string): Promise<{
    totalEarnings: number;
    availableBalance: number;
    contentCount: number;
    totalUnlocks: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateStripeCustomerId(userId: string, customerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPayoutInfo(userId: string, payoutMethod: string, payoutEmail: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ payoutMethod, payoutEmail, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async enableUserPayouts(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ payoutEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserSubscription(userId: string, subscriptionData: {
    stripeSubscriptionId: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    subscriptionEndsAt?: Date;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        subscriptionTier: subscriptionData.subscriptionTier,
        subscriptionStatus: subscriptionData.subscriptionStatus,
        subscriptionEndsAt: subscriptionData.subscriptionEndsAt,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Content operations
  async createContent(contentData: InsertContent): Promise<Content> {
    const [newContent] = await db
      .insert(content)
      .values(contentData)
      .returning();
    return newContent;
  }

  async getContentByUser(userId: string): Promise<Content[]> {
    return await db
      .select()
      .from(content)
      .where(eq(content.userId, userId))
      .orderBy(desc(content.createdAt));
  }

  async getContentById(id: number): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item;
  }

  async getContentByIdWithUser(id: number): Promise<(Content & { user: User }) | undefined> {
    const [result] = await db
      .select()
      .from(content)
      .innerJoin(users, eq(content.userId, users.id))
      .where(eq(content.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.content,
      user: result.users,
    };
  }

  async updateContent(id: number, updates: Partial<Content>): Promise<Content> {
    const [updated] = await db
      .update(content)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async deleteContent(id: number): Promise<void> {
    await db.delete(content).where(eq(content.id, id));
  }

  async incrementUnlockCount(contentId: number, amount: number): Promise<void> {
    await db
      .update(content)
      .set({
        unlockCount: sql`${content.unlockCount} + 1`,
        totalEarnings: sql`${content.totalEarnings} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(content.id, contentId));
  }

  // Purchase operations
  async createPurchase(purchaseData: InsertPurchase): Promise<Purchase> {
    const [purchase] = await db
      .insert(purchases)
      .values(purchaseData)
      .returning();
    return purchase;
  }

  async getPurchaseByPaymentIntent(paymentIntentId: string): Promise<Purchase | undefined> {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripePaymentIntentId, paymentIntentId));
    return purchase;
  }

  async updatePurchaseStatus(id: number, status: string): Promise<Purchase> {
    const [updated] = await db
      .update(purchases)
      .set({ status })
      .where(eq(purchases.id, id))
      .returning();
    return updated;
  }

  // Analytics
  async getUserStats(userId: string): Promise<{
    totalEarnings: number;
    availableBalance: number;
    contentCount: number;
    totalUnlocks: number;
  }> {
    // Get content stats
    const [contentStats] = await db
      .select({
        contentCount: count(content.id),
        totalUnlocks: sum(content.unlockCount),
      })
      .from(content)
      .where(eq(content.userId, userId));

    // Get earnings stats - try/catch for earnings table that might not exist yet
    let earningsStats = { totalEarnings: 0, availableBalance: 0 };
    try {
      const [result] = await db
        .select({
          totalEarnings: sum(earnings.netAmount),
          availableBalance: sum(sql`CASE WHEN ${earnings.status} = 'available' THEN ${earnings.netAmount} ELSE 0 END`),
        })
        .from(earnings)
        .where(eq(earnings.creatorId, userId));
      
      if (result) {
        earningsStats = {
          totalEarnings: Number(result.totalEarnings) || 0,
          availableBalance: Number(result.availableBalance) || 0,
        };
      }
    } catch (error) {
      // Earnings table doesn't exist yet, use fallback
      const [oldStats] = await db
        .select({
          totalEarnings: sum(content.totalEarnings),
        })
        .from(content)
        .where(eq(content.userId, userId));
      
      earningsStats.totalEarnings = Number(oldStats?.totalEarnings) || 0;
    }
    
    return {
      totalEarnings: earningsStats.totalEarnings,
      availableBalance: earningsStats.availableBalance,
      contentCount: Number(contentStats?.contentCount) || 0,
      totalUnlocks: Number(contentStats?.totalUnlocks) || 0,
    };
  }

  async getPendingPayouts(): Promise<(Purchase & { content: Content; user: User })[]> {
    const result = await db
      .select()
      .from(purchases)
      .innerJoin(content, eq(purchases.contentId, content.id))
      .innerJoin(users, eq(content.userId, users.id))
      .where(and(
        eq(purchases.status, 'completed'),
        eq(purchases.creatorPaid, false)
      ));

    return result.map(row => ({
      ...row.purchases,
      content: row.content,
      user: row.users
    }));
  }

  async getPendingPurchasesByContent(contentId: number): Promise<Purchase[]> {
    return await db
      .select()
      .from(purchases)
      .where(and(
        eq(purchases.contentId, contentId),
        eq(purchases.status, 'pending')
      ))
      .orderBy(desc(purchases.createdAt));
  }

  async markPayoutCompleted(purchaseId: number): Promise<Purchase> {
    const [purchase] = await db
      .update(purchases)
      .set({ 
        creatorPaid: true,
        payoutDate: new Date()
      })
      .where(eq(purchases.id, purchaseId))
      .returning();
    return purchase;
  }

  // Earnings operations
  async createEarning(earningData: InsertEarning): Promise<Earning> {
    const [earning] = await db
      .insert(earnings)
      .values(earningData)
      .returning();
    return earning;
  }

  async getCreatorEarnings(creatorId: string): Promise<Earning[]> {
    return await db
      .select()
      .from(earnings)
      .where(eq(earnings.creatorId, creatorId))
      .orderBy(desc(earnings.createdAt));
  }

  async getCreatorBalance(creatorId: string): Promise<Balance | undefined> {
    const [balance] = await db
      .select()
      .from(balances)
      .where(eq(balances.creatorId, creatorId));
    return balance;
  }

  async updateCreatorBalance(creatorId: string, balance: number): Promise<Balance> {
    const [result] = await db
      .insert(balances)
      .values({
        creatorId,
        currentBalance: balance.toString(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: balances.creatorId,
        set: {
          currentBalance: balance.toString(),
          updatedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  async getCreatorsForPayout(minAmount: number = 25): Promise<{creatorId: string, totalAvailable: number, user: User}[]> {
    const result = await db
      .select({
        creatorId: earnings.creatorId,
        totalAvailable: sum(earnings.netAmount),
        user: users
      })
      .from(earnings)
      .innerJoin(users, eq(earnings.creatorId, users.id))
      .where(eq(earnings.status, 'available'))
      .groupBy(earnings.creatorId, users.id)
      .having(sql`SUM(${earnings.netAmount}) >= ${minAmount}`);
    
    return result.map(row => ({
      creatorId: row.creatorId,
      totalAvailable: Number(row.totalAvailable) || 0,
      user: row.user
    }));
  }

  async markEarningsAsPaid(creatorId: string, amount: number): Promise<void> {
    await db
      .update(earnings)
      .set({ 
        status: 'paid',
        paidOutAt: new Date()
      })
      .where(and(
        eq(earnings.creatorId, creatorId),
        eq(earnings.status, 'available')
      ));
  }

  async createPayoutLog(payoutData: InsertPayoutLog): Promise<PayoutLog> {
    const [log] = await db
      .insert(payoutLogs)
      .values(payoutData)
      .returning();
    return log;
  }

  async getCreatorPayoutHistory(creatorId: string): Promise<PayoutLog[]> {
    return await db
      .select()
      .from(payoutLogs)
      .where(eq(payoutLogs.creatorId, creatorId))
      .orderBy(desc(payoutLogs.createdAt));
  }

  // Admin helper methods
  async getAllPurchases(): Promise<Purchase[]> {
    return await db
      .select()
      .from(purchases)
      .orderBy(desc(purchases.createdAt));
  }
}

export const storage = new DatabaseStorage();
