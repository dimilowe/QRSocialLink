import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Plus, Trash2, TrendingUp, MousePointerClick, Target, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Destination } from "@shared/schema";

interface CampaignWithDetails {
  id: string;
  userId: string;
  name: string;
  slug: string;
  abStrategy: string;
  status: string;
  createdAt: string;
  destinations: Destination[];
  totalScans: number;
  totalConversions: number;
}

export default function CampaignDetailPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id;

  const [showAddDestination, setShowAddDestination] = useState(false);
  const [newDestination, setNewDestination] = useState({
    name: "",
    url: "",
    weight: 50,
  });

  const { data: campaign, isLoading } = useQuery<CampaignWithDetails>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const addDestinationMutation = useMutation({
    mutationFn: async (data: typeof newDestination) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/destinations`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      setShowAddDestination(false);
      setNewDestination({ name: "", url: "", weight: 50 });
      toast({
        title: "Destination added!",
        description: "Your A/B test variant has been added",
      });
    },
  });

  const deleteDestinationMutation = useMutation({
    mutationFn: async (destinationId: string) => {
      const response = await apiRequest("DELETE", `/api/destinations/${destinationId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      toast({
        title: "Destination removed",
        description: "The A/B test variant has been removed",
      });
    },
  });

  const handleAddDestination = () => {
    if (!newDestination.name.trim() || !newDestination.url.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    addDestinationMutation.mutate(newDestination);
  };

  const copyRedirectUrl = () => {
    const url = `${window.location.origin}/r/${campaign?.slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Redirect URL copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Campaign not found</h2>
          <Link href="/campaigns">
            <Button variant="ghost">← Back to Campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  const destinations = campaign.destinations || [];
  const conversionRate = campaign.totalScans > 0
    ? ((campaign.totalConversions / campaign.totalScans) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold" data-testid="text-campaign-name">
              {campaign.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {campaign.abStrategy === "weighted_random" ? "Manual Split" : "Auto-Optimize"} Strategy
            </p>
          </div>
          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
            {campaign.status}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dynamic Redirect URL</CardTitle>
            <CardDescription>Use this URL in your QR code for A/B testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {destinations.length === 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-500 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Setup Required: Add at least one destination below before using this URL
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/r/${campaign.slug}`}
                className="font-mono text-sm"
                data-testid="input-redirect-url"
              />
              <Button onClick={copyRedirectUrl} variant="outline" data-testid="button-copy-url">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-scans">{campaign.totalScans}</div>
              <p className="text-xs text-muted-foreground">Unique impressions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-conversions">{campaign.totalConversions}</div>
              <p className="text-xs text-muted-foreground">Completed actions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-conversion-rate">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">Overall performance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>A/B Test Variants</CardTitle>
                <CardDescription>Manage destination URLs and view performance</CardDescription>
              </div>
              <Button onClick={() => setShowAddDestination(true)} size="sm" data-testid="button-add-destination">
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {campaign.destinations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No destinations yet. Add your first A/B test variant.</p>
                <Button onClick={() => setShowAddDestination(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Destination
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {campaign.destinations.map((dest) => {
                  const destConversionRate = dest.impressions > 0
                    ? ((dest.conversions / dest.impressions) * 100).toFixed(1)
                    : "0.0";
                  
                  return (
                    <div key={dest.id} className="border rounded-lg p-4 space-y-3" data-testid={`destination-${dest.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{dest.name}</h4>
                            {!dest.isActive && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{dest.url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover-elevate"
                          onClick={() => deleteDestinationMutation.mutate(dest.id)}
                          data-testid={`button-delete-destination-${dest.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Weight</p>
                          <p className="font-medium">{dest.weight}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Impressions</p>
                          <p className="font-medium">{dest.impressions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conversions</p>
                          <p className="font-medium">{dest.conversions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conv. Rate</p>
                          <p className="font-medium">{destConversionRate}%</p>
                        </div>
                      </div>

                      {campaign.totalScans > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Traffic Share</span>
                            <span>{((dest.impressions / campaign.totalScans) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={(dest.impressions / campaign.totalScans) * 100} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDestination} onOpenChange={setShowAddDestination}>
        <DialogContent data-testid="dialog-add-destination">
          <DialogHeader>
            <DialogTitle>Add A/B Test Variant</DialogTitle>
            <DialogDescription>
              Create a new destination URL to test against existing variants
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dest-name">Variant Name</Label>
              <Input
                id="dest-name"
                placeholder="Homepage"
                value={newDestination.name}
                onChange={(e) => setNewDestination({ ...newDestination, name: e.target.value })}
                data-testid="input-destination-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dest-url">Destination URL</Label>
              <Input
                id="dest-url"
                placeholder="https://example.com/landing-page"
                value={newDestination.url}
                onChange={(e) => setNewDestination({ ...newDestination, url: e.target.value })}
                data-testid="input-destination-url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dest-weight">Traffic Weight (%)</Label>
              <Input
                id="dest-weight"
                type="number"
                min="0"
                max="100"
                placeholder="50"
                value={newDestination.weight}
                onChange={(e) => setNewDestination({ ...newDestination, weight: parseInt(e.target.value) || 0 })}
                data-testid="input-destination-weight"
              />
              <p className="text-xs text-muted-foreground">
                For weighted random strategy. Higher weight = more traffic.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDestination(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddDestination} 
              disabled={addDestinationMutation.isPending}
              data-testid="button-add-destination-submit"
            >
              {addDestinationMutation.isPending ? "Adding..." : "Add Variant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
