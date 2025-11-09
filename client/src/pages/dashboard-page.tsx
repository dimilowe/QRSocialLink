import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Edit, Sparkles, Download, Eye } from "lucide-react";
import type { Scan } from "@shared/schema";
import { EditQRModal } from "@/components/edit-qr-modal";

interface QRAnalytics {
  totalScans: number;
  devices: Record<string, number>;
  platforms: Record<string, number>;
  operatingSystems: Record<string, number>;
  timeSeries: Array<{ date: string; scans: number }>;
}

function QRAnalyticsCard({ scanId }: { scanId: string }) {
  const { data: analytics, isLoading } = useQuery<QRAnalytics>({
    queryKey: ["/api/scans", scanId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/scans/${scanId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="h-3 w-3" />
        <span>Loading...</span>
      </div>
    );
  }

  const totalScans = analytics?.totalScans || 0;
  const topPlatform = analytics?.platforms 
    ? Object.entries(analytics.platforms).sort(([,a], [,b]) => b - a)[0]?.[0]
    : null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          {totalScans} {totalScans === 1 ? 'scan' : 'scans'}
        </Badge>
        {topPlatform && topPlatform !== 'Direct/Unknown' && (
          <Badge variant="outline" className="text-xs">
            {topPlatform}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingScan, setEditingScan] = useState<Scan | null>(null);

  const { data: scans, isLoading } = useQuery<Scan[]>({
    queryKey: ["/api/user/scans"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/scans`);
      if (!response.ok) throw new Error("Failed to fetch scans");
      const data = await response.json();
      return data.scans.filter((scan: Scan) => scan.type === "created");
    },
    enabled: !!user,
  });

  const handleDownloadQR = (scan: Scan) => {
    if (!scan.qrImageUrl) return;
    
    const link = document.createElement("a");
    link.download = `qr-code-${scan.title || scan.id}.png`;
    link.href = scan.qrImageUrl;
    link.click();
  };

  const createdScans = scans || [];
  const planLimit = user?.plan === "free" ? 1 : user?.plan === "starter" ? 20 : user?.plan === "pro" ? 50 : -1;
  const canCreateMore = planLimit === -1 || createdScans.length < planLimit;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading font-bold" data-testid="text-dashboard-title">
                QR Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage and edit your QR codes
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {createdScans.length} / {planLimit === -1 ? "∞" : planLimit} QR codes
            </p>
            {!canCreateMore && (
              <p className="text-xs text-destructive">
                Upgrade to create more
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : createdScans.length === 0 ? (
          <Card className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No QR codes yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first QR code to get started
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {createdScans.map((scan) => (
              <Card key={scan.id} className="p-4 space-y-4" data-testid={`card-qr-${scan.id}`}>
                <div className="aspect-square bg-muted rounded-lg p-4 flex items-center justify-center">
                  <img
                    src={scan.qrImageUrl}
                    alt={scan.title || "QR Code"}
                    className="max-w-full max-h-full object-contain"
                    data-testid={`img-qr-${scan.id}`}
                  />
                </div>
                <div className="space-y-2">
                  {scan.title && (
                    <h3 className="font-semibold truncate" data-testid={`text-title-${scan.id}`}>
                      {scan.title}
                    </h3>
                  )}
                  <p className="text-sm text-muted-foreground truncate" data-testid={`text-url-${scan.id}`}>
                    {scan.decodedUrl}
                  </p>
                  <QRAnalyticsCard scanId={scan.id} />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleDownloadQR(scan)}
                    data-testid={`button-download-${scan.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => setEditingScan(scan)}
                    data-testid={`button-edit-${scan.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditQRModal
        scan={editingScan}
        open={!!editingScan}
        onOpenChange={(open) => !open && setEditingScan(null)}
      />
    </div>
  );
}
