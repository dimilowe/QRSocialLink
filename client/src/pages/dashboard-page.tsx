import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Edit, Sparkles, Download, Eye, QrCode, Frame, Trash2 } from "lucide-react";
import type { Scan, OverlayRendition } from "@shared/schema";
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
  const [viewMode, setViewMode] = useState<"qr-codes" | "overlays">("qr-codes");

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

  const { data: overlays, isLoading: overlaysLoading } = useQuery<OverlayRendition[]>({
    queryKey: ["/api/overlays"],
    enabled: !!user && viewMode === "overlays",
  });

  const handleDownloadQR = (scan: Scan) => {
    if (!scan.qrImageUrl) return;
    
    const link = document.createElement("a");
    link.download = `qr-code-${scan.title || scan.id}.png`;
    link.href = scan.qrImageUrl;
    link.click();
  };

  const handleDownloadOverlay = (overlay: OverlayRendition) => {
    if (!overlay.outputPath) return;
    window.open(overlay.outputPath, '_blank');
  };

  const deleteOverlayMutation = useMutation({
    mutationFn: async (overlayId: string) => {
      return apiRequest('DELETE', `/api/overlays/${overlayId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/overlays'] });
      toast({
        title: "Overlay deleted",
        description: "The overlay has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete overlay",
        variant: "destructive",
      });
    },
  });

  const handleDeleteOverlay = (overlayId: string) => {
    if (confirm("Are you sure you want to delete this overlay?")) {
      deleteOverlayMutation.mutate(overlayId);
    }
  };

  const deleteQRMutation = useMutation({
    mutationFn: async (scanId: string) => {
      return apiRequest('DELETE', `/api/scans/${scanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/scans'] });
      toast({
        title: "QR code deleted",
        description: "The QR code has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete QR code",
        variant: "destructive",
      });
    },
  });

  const handleDeleteQR = (scanId: string) => {
    if (confirm("Are you sure you want to delete this QR code? This cannot be undone.")) {
      deleteQRMutation.mutate(scanId);
    }
  };

  const createdScans = scans || [];
  const createdOverlays = overlays || [];
  const planLimit = user?.plan === "free" ? 1 : user?.plan === "starter" ? 20 : user?.plan === "pro" ? 50 : -1;
  const canCreateMore = planLimit === -1 || createdScans.length < planLimit;
  
  const currentLoading = viewMode === "qr-codes" ? isLoading : overlaysLoading;
  const currentItems = viewMode === "qr-codes" ? createdScans : createdOverlays;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading font-bold" data-testid="text-dashboard-title">
                {viewMode === "qr-codes" ? "QR Dashboard" : "Overlay Gallery"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {viewMode === "qr-codes" ? "Manage and edit your QR codes" : "View and download your generated overlays"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <Button
                size="sm"
                variant={viewMode === "qr-codes" ? "default" : "ghost"}
                onClick={() => setViewMode("qr-codes")}
                className="gap-2"
                data-testid="button-view-qrcodes"
              >
                <QrCode className="h-4 w-4" />
                QR Codes
              </Button>
              <Button
                size="sm"
                variant={viewMode === "overlays" ? "default" : "ghost"}
                onClick={() => setViewMode("overlays")}
                className="gap-2"
                data-testid="button-view-overlays"
              >
                <Frame className="h-4 w-4" />
                Overlays
              </Button>
            </div>
            {viewMode === "qr-codes" && (
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
            )}
          </div>
        </div>

        {currentLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : currentItems.length === 0 ? (
          <Card className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {viewMode === "qr-codes" ? "No QR codes yet" : "No overlays yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {viewMode === "qr-codes" 
                ? "Create your first QR code to get started"
                : "Generate your first overlay to get started"}
            </p>
          </Card>
        ) : viewMode === "qr-codes" ? (
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
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDeleteQR(scan.id)}
                    disabled={deleteQRMutation.isPending}
                    data-testid={`button-delete-${scan.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {createdOverlays.map((overlay) => (
              <Card key={overlay.id} className="p-4 space-y-4" data-testid={`card-overlay-${overlay.id}`}>
                <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden flex items-center justify-center p-2">
                  {overlay.status === "completed" && overlay.outputPath ? (
                    <img
                      src={overlay.outputPath}
                      alt="Generated Overlay"
                      className="w-full h-full object-contain"
                      data-testid={`img-overlay-${overlay.id}`}
                    />
                  ) : overlay.status === "rendering" ? (
                    <div className="text-center p-4">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                      <p className="text-sm text-muted-foreground">Rendering...</p>
                    </div>
                  ) : overlay.status === "failed" ? (
                    <div className="text-center p-4">
                      <p className="text-sm text-destructive">Render Failed</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Queued</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {overlay.ctaText && (
                    <p className="text-sm font-medium truncate" data-testid={`text-cta-${overlay.id}`}>
                      {overlay.ctaText}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {overlay.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(overlay.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleDownloadOverlay(overlay)}
                    disabled={overlay.status !== "completed"}
                    data-testid={`button-download-overlay-${overlay.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleDeleteOverlay(overlay.id)}
                    disabled={deleteOverlayMutation.isPending}
                    data-testid={`button-delete-overlay-${overlay.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
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
