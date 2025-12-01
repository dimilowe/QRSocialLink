const VCM_OS_BASE_URL = process.env.VCM_OS_BASE_URL;
const VCM_OS_API_KEY = process.env.VCM_OS_API_KEY_QR_SOCIAL;
const VCM_OS_APP_NAME = process.env.VCM_OS_APP_NAME || "QR_SOCIAL";

if (!VCM_OS_BASE_URL || !VCM_OS_API_KEY) {
  console.log("[VCM OS] Missing env vars – mirroring disabled.");
}

export type AnalyticsSnapshotPayload = {
  app_offer_id: string;
  snapshot_period_start: string;
  snapshot_period_end: string;
  visits: number;
  conversions: number;
  revenue: number;
  raw_metrics?: Record<string, any>;
};

export async function sendAnalyticsToVcmOs(
  appUserId: string,
  snapshots: AnalyticsSnapshotPayload[]
): Promise<void> {
  if (!VCM_OS_BASE_URL || !VCM_OS_API_KEY) return;
  if (!snapshots.length) return;

  try {
    const res = await fetch(`${VCM_OS_BASE_URL}/api/mirror/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APP-NAME": VCM_OS_APP_NAME,
        "X-APP-API-KEY": VCM_OS_API_KEY,
        "X-APP-USER-ID": appUserId,
      },
      body: JSON.stringify(snapshots),
    });

    if (!res.ok) {
      console.error("[VCM OS] Failed to mirror analytics:", await res.text());
    } else {
      console.log(`[VCM OS] Mirrored ${snapshots.length} snapshots for user ${appUserId}`);
    }
  } catch (err) {
    console.error("[VCM OS] Error sending analytics:", err);
  }
}
