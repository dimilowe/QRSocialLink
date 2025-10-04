import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScanWithUser } from "@shared/schema";
import { ScanCard } from "@/components/feed/scan-card";
import { Button } from "@/components/ui/button";
import { QrCode, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QrScanner } from "@/components/scanner/qr-scanner";
import { ProUpgradeModal } from "@/components/pro-upgrade-modal";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const { data: feed = [], isLoading } = useQuery<ScanWithUser[]>({
    queryKey: ["/api/feed"],
    refetchInterval: 10000,
  });

  const { data: followingData = [] } = useQuery<{ followedId: string }[]>({
    queryKey: ["/api/following"],
    enabled: !!user,
  });

  useEffect(() => {
    setFollowingIds(new Set(followingData.map((f) => f.followedId)));
  }, [followingData]);

  const likeMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const response = await apiRequest("POST", `/api/scans/${scanId}/like`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const isFollowing = followingIds.has(userId);
      const response = await apiRequest(
        "POST",
        `/api/users/${userId}/${isFollowing ? "unfollow" : "follow"}`,
        {}
      );
      return { userId, isFollowing, data: await response.json() };
    },
    onSuccess: ({ userId, isFollowing }) => {
      const newFollowing = new Set(followingIds);
      if (isFollowing) {
        newFollowing.delete(userId);
      } else {
        newFollowing.add(userId);
      }
      setFollowingIds(newFollowing);
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
    },
  });

  const saveScanMutation = useMutation({
    mutationFn: async ({
      decodedUrl,
      qrImageUrl,
    }: {
      decodedUrl: string;
      qrImageUrl: string;
    }) => {
      const response = await apiRequest("POST", "/api/scans", {
        decodedUrl,
        qrImageUrl,
        isPublic: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/scans"] });
      toast({
        title: "Scan saved!",
        description: "Your scan has been added to your history and the feed",
      });
    },
  });

  const handleScanSuccess = async (decodedUrl: string) => {
    setShowScanner(false);
    
    window.open(decodedUrl, "_blank");

    if (user) {
      const QRCode = (await import("qrcode")).default;
      const qrImageUrl = await QRCode.toDataURL(decodedUrl);
      saveScanMutation.mutate({ decodedUrl, qrImageUrl });
    }
  };

  const handleRescan = async (url: string) => {
    if (!user) return;

    const QRCode = (await import("qrcode")).default;
    const qrImageUrl = await QRCode.toDataURL(url);
    saveScanMutation.mutate({ decodedUrl: url, qrImageUrl });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold" data-testid="text-feed-title">
              Feed
            </h1>
            <p className="text-sm text-muted-foreground">
              Latest scans from the community
            </p>
          </div>
          
          {user?.plan === "free" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProModal(true)}
              data-testid="button-upgrade-pro"
              className="gap-2"
            >
              <Crown className="h-4 w-4 text-[hsl(var(--pro-badge-from))]" />
              Upgrade
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-12">
            <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-lg mb-2">No scans yet</h3>
            <p className="text-muted-foreground mb-6">
              Be the first to scan and share a QR code!
            </p>
            <Button onClick={() => setShowScanner(true)} data-testid="button-scan-first">
              <QrCode className="h-5 w-5 mr-2" />
              Scan QR Code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((scan) => (
              <ScanCard
                key={scan.id}
                scan={scan}
                currentUserId={user?.id}
                onLike={(scanId) => likeMutation.mutate(scanId)}
                onFollow={(userId) => followMutation.mutate(userId)}
                onRescan={handleRescan}
                isFollowing={followingIds.has(scan.userId)}
              />
            ))}
          </div>
        )}
      </div>

      {user && (
        <Button
          size="icon"
          className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-lg z-40"
          onClick={() => setShowScanner(true)}
          data-testid="button-floating-scan"
        >
          <QrCode className="h-6 w-6" />
        </Button>
      )}

      {showScanner && (
        <QrScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <ProUpgradeModal open={showProModal} onOpenChange={setShowProModal} />
    </div>
  );
}
