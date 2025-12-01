import { db } from "../../db";
import { scans, scanEvents } from "@shared/schema";
import { eq, and, gte, lte, sql, count, countDistinct } from "drizzle-orm";
import { sendAnalyticsToVcmOs, AnalyticsSnapshotPayload } from "../integrations/vcmOsClient";

function getYesterdayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
    0, 0, 0
  ));
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
    23, 59, 59
  ));
  return { start, end };
}

export async function mirrorYesterdayAnalyticsToVcmOs() {
  const { start, end } = getYesterdayRange();
  
  console.log(`[VCM OS Mirror] Aggregating analytics from ${start.toISOString()} to ${end.toISOString()}`);

  try {
    const rows = await db
      .select({
        userId: scans.userId,
        scanId: scans.id,
        scanCount: count(scanEvents.id),
        uniqueScanners: countDistinct(scanEvents.ipHash),
      })
      .from(scans)
      .leftJoin(
        scanEvents,
        and(
          eq(scanEvents.scanId, scans.id),
          gte(scanEvents.timestamp, start),
          lte(scanEvents.timestamp, end)
        )
      )
      .groupBy(scans.userId, scans.id);

    const byUser: Record<string, AnalyticsSnapshotPayload[]> = {};

    for (const row of rows) {
      const userId = row.userId;
      if (!byUser[userId]) byUser[userId] = [];

      byUser[userId].push({
        app_offer_id: String(row.scanId),
        snapshot_period_start: start.toISOString(),
        snapshot_period_end: end.toISOString(),
        visits: Number(row.scanCount) || 0,
        conversions: Number(row.scanCount) || 0,
        revenue: 0,
        raw_metrics: {
          unique_scanners: Number(row.uniqueScanners) || 0
        }
      });
    }

    const userCount = Object.keys(byUser).length;
    const totalSnapshots = Object.values(byUser).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[VCM OS Mirror] Found ${totalSnapshots} QR codes across ${userCount} users`);

    for (const [userId, snapshots] of Object.entries(byUser)) {
      await sendAnalyticsToVcmOs(userId, snapshots);
    }

    console.log("[VCM OS Mirror] Daily analytics mirroring complete");
  } catch (err) {
    console.error("[VCM OS Mirror] Error aggregating analytics:", err);
  }
}
