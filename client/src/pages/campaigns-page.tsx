import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, TrendingUp, BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";

export default function CampaignsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState<{
    name: string;
    abStrategy: "weighted_random" | "epsilon_greedy";
  }>({
    name: "",
    abStrategy: "weighted_random",
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newCampaign) => {
      const response = await apiRequest("POST", "/api/campaigns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowCreateDialog(false);
      setNewCampaign({ name: "", abStrategy: "weighted_random" });
      toast({
        title: "Campaign created!",
        description: "Your A/B testing campaign has been created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newCampaign.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a campaign name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newCampaign);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold" data-testid="text-campaigns-title">
              Campaigns
            </h1>
            <p className="text-sm text-muted-foreground">
              Create and manage A/B testing campaigns for your QR codes
            </p>
          </div>
          
          <Button
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-campaign"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="font-heading font-semibold text-lg mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Create your first campaign to start A/B testing different destinations and tracking conversion metrics.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-campaign">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid={`card-campaign-${campaign.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{campaign.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Created {new Date(campaign.createdAt!).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Strategy:</span>
                      <span className="font-medium">
                        {campaign.abStrategy === "weighted_random" ? "Weighted Random" : "Epsilon Greedy"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ExternalLink className="h-4 w-4" />
                      <span className="font-mono text-xs truncate">
                        {window.location.origin}/r/{campaign.slug}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-campaign">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Set up a new A/B testing campaign to optimize your QR code destinations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="Summer Promotion 2024"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                data-testid="input-campaign-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ab-strategy">A/B Testing Strategy</Label>
              <Select
                value={newCampaign.abStrategy}
                onValueChange={(value: "weighted_random" | "epsilon_greedy") =>
                  setNewCampaign({ ...newCampaign, abStrategy: value })
                }
              >
                <SelectTrigger id="ab-strategy" data-testid="select-ab-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weighted_random">
                    <div>
                      <div className="font-medium">Weighted Random</div>
                      <div className="text-xs text-muted-foreground">
                        Distribute traffic based on configured weights
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="epsilon_greedy">
                    <div>
                      <div className="font-medium">Epsilon Greedy (Auto-optimize)</div>
                      <div className="text-xs text-muted-foreground">
                        Automatically optimize for highest conversion rate
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              data-testid="button-create-campaign-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
