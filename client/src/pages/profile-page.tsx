import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Settings, ExternalLink, Loader2 } from "lucide-react";
import { User, Scan } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ProUpgradeModal } from "@/components/pro-upgrade-modal";
import { useState } from "react";

export default function ProfilePage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser, logout } = useAuth();
  const [showProModal, setShowProModal] = useState(false);
  
  const userId = params.id || currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  const { data: profile, isLoading: profileLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const {
    data: scansData,
    isLoading: scansLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{
    scans: Scan[];
    hasMore: boolean;
    total: number;
    page?: number;
  }>({
    queryKey: ["/api/users", userId, "scans"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/users/${userId}/scans?page=${pageParam}&pageSize=20`);
      if (!response.ok) throw new Error("Failed to fetch scans");
      return response.json();
    },
    getNextPageParam: (lastPage) => 
      lastPage.hasMore && lastPage.page ? lastPage.page + 1 : undefined,
    enabled: !!userId,
    initialPageParam: 1,
  });

  const scans = scansData?.pages.flatMap(page => page.scans) || [];
  const totalScans = scansData?.pages[0]?.total || 0;
  const canLoadMore = profile?.plan === "pro" && hasNextPage;

  const { data: stats } = useQuery<{
    scansCount: number;
    followersCount: number;
    followingCount: number;
  }>({
    queryKey: ["/api/users", userId, "stats"],
    enabled: !!userId,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout", {});
      logout();
      setLocation("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const isFreePlanMaxed = profile?.plan === "free" && scans.length >= 10;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-r from-primary/40 to-primary/20 h-32 rounded-t-xl -mx-4" />
        
        <div className="px-4">
          <div className="flex items-end justify-between -mt-16 mb-4">
            <Avatar className="h-24 w-24 border-4 border-background" data-testid="avatar-profile">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {getInitials(profile.username)}
              </AvatarFallback>
            </Avatar>

            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <Settings className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-heading font-bold" data-testid="text-profile-username">
                {profile.username}
              </h1>
              {profile.plan === "pro" && (
                <Badge
                  variant="outline"
                  className="bg-gradient-to-r from-[hsl(var(--pro-badge-from))] to-[hsl(var(--pro-badge-to))] text-white border-0"
                  data-testid="badge-pro-profile"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  PRO
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-profile-email">
              {profile.email}
            </p>

            <div className="flex gap-6">
              <button className="text-center hover-elevate p-2 rounded-md" data-testid="button-scans-count">
                <p className="font-semibold">{stats?.scansCount || 0}</p>
                <p className="text-sm text-muted-foreground">Scans</p>
              </button>
              <button className="text-center hover-elevate p-2 rounded-md" data-testid="button-followers-count">
                <p className="font-semibold">{stats?.followersCount || 0}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </button>
              <button className="text-center hover-elevate p-2 rounded-md" data-testid="button-following-count">
                <p className="font-semibold">{stats?.followingCount || 0}</p>
                <p className="text-sm text-muted-foreground">Following</p>
              </button>
            </div>
          </div>

          {isOwnProfile && profile.plan === "free" && (
            <Card className="p-4 mb-6 border-primary/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Upgrade to Pro</h3>
                  <p className="text-sm text-muted-foreground">
                    Unlock unlimited history, analytics, and more
                  </p>
                </div>
                <Button
                  onClick={() => setShowProModal(true)}
                  data-testid="button-upgrade-profile"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              </div>
            </Card>
          )}

          <Tabs defaultValue="scans" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scans" data-testid="tab-scans">Scan History</TabsTrigger>
              <TabsTrigger value="drops" data-testid="tab-drops">QR Drops</TabsTrigger>
            </TabsList>
            
            <TabsContent value="scans" className="mt-6">
              {scansLoading ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
              ) : scans.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No scans yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.plan === "pro" && totalScans > 0 && (
                    <Card className="p-3 bg-gradient-to-r from-[hsl(var(--pro-badge-from))]/10 to-[hsl(var(--pro-badge-to))]/10 border-[hsl(var(--pro-badge-from))]/20">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-[hsl(var(--pro-badge-from))]" />
                        <p className="text-sm font-medium">
                          Pro: Unlimited scan history ({totalScans} total scans)
                        </p>
                      </div>
                    </Card>
                  )}
                  
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {scans.map((scan) => (
                      <button
                        key={scan.id}
                        className="aspect-square bg-white rounded-lg p-2 hover-elevate active-elevate-2 group relative overflow-visible"
                        onClick={() => window.open(scan.decodedUrl, "_blank")}
                        data-testid={`scan-thumbnail-${scan.id}`}
                      >
                        <img
                          src={scan.qrImageUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <ExternalLink className="h-6 w-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {canLoadMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        data-testid="button-load-more-scans"
                      >
                        {isFetchingNextPage ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          `Load More Scans`
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {isFreePlanMaxed && (
                    <Card className="p-4 border-[hsl(var(--pro-badge-from))]/30">
                      <div className="text-center">
                        <Crown className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--pro-badge-from))]" />
                        <p className="text-sm font-medium mb-1">
                          Free plan limit reached (10 scans)
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Upgrade to Pro for unlimited scan history
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setShowProModal(true)}
                          data-testid="button-upgrade-history-limit"
                        >
                          <Crown className="h-3 w-3 mr-1" />
                          Upgrade to Pro
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="drops" className="mt-6">
              <div className="text-center py-12">
                <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  QR Drops coming soon in Pro version
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProUpgradeModal open={showProModal} onOpenChange={setShowProModal} />
    </div>
  );
}
