import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, CreditCard, User, Lock, ExternalLink } from "lucide-react";
import { PLAN_LIMITS } from "@shared/schema";

const PLAN_NAMES = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Unlimited",
} as const;

const PLAN_PRICES = {
  free: "$0",
  starter: "$10/mo",
  pro: "$30/mo",
  enterprise: "$99/mo",
} as const;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateUsernameMutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const response = await apiRequest("PATCH", "/api/user/username", { username: newUsername });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update username");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Username updated!",
        description: "Your username has been successfully updated",
      });
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update username",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("PATCH", "/api/user/password", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update password");
      }
      return response.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPortalSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/create-portal-session", {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create portal session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateUsername = () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }
    if (username === user?.username) {
      toast({
        title: "No changes",
        description: "This is already your username",
      });
      return;
    }
    updateUsernameMutation.mutate(username);
  };

  const handleUpdatePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "All fields required",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (!user) {
    return <div className="min-h-screen bg-background" />;
  }

  const userPlan = user.plan as keyof typeof PLAN_NAMES;
  const planLimits = PLAN_LIMITS[userPlan];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-heading font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and subscription</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Your current plan and billing</CardDescription>
                </div>
              </div>
              <Badge variant={userPlan === "free" ? "secondary" : "default"} className="text-base px-3 py-1">
                {PLAN_NAMES[userPlan]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plan</p>
                <p className="font-medium">{PLAN_NAMES[userPlan]} - {PLAN_PRICES[userPlan]}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Max QR Codes</p>
                <p className="font-medium">{planLimits.maxQRs === -1 ? "Unlimited" : planLimits.maxQRs}</p>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <h4 className="font-medium">Features</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${planLimits.canSave ? 'bg-green-500' : 'bg-muted'}`} />
                  <span className={planLimits.canSave ? '' : 'text-muted-foreground'}>Save QR codes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${planLimits.canDownload ? 'bg-green-500' : 'bg-muted'}`} />
                  <span className={planLimits.canDownload ? '' : 'text-muted-foreground'}>Download QR codes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${planLimits.canEdit ? 'bg-green-500' : 'bg-muted'}`} />
                  <span className={planLimits.canEdit ? '' : 'text-muted-foreground'}>Edit QR codes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${planLimits.hasAnalytics ? 'bg-green-500' : 'bg-muted'}`} />
                  <span className={planLimits.hasAnalytics ? '' : 'text-muted-foreground'}>Analytics & tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${planLimits.hasBranding ? 'bg-green-500' : 'bg-muted'}`} />
                  <span className={planLimits.hasBranding ? '' : 'text-muted-foreground'}>Remove "Made with QR Social" watermark</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-3">
              {userPlan === "free" ? (
                <Button asChild data-testid="button-upgrade">
                  <a href="/pricing">
                    Upgrade Plan
                  </a>
                </Button>
              ) : (
                <Button 
                  onClick={() => createPortalSessionMutation.mutate()}
                  disabled={createPortalSessionMutation.isPending}
                  data-testid="button-manage-billing"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {createPortalSessionMutation.isPending ? "Loading..." : "Manage Billing"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your username</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                data-testid="input-username"
              />
            </div>

            <Button 
              onClick={handleUpdateUsername}
              disabled={updateUsernameMutation.isPending || username === user.username}
              data-testid="button-update-username"
            >
              {updateUsernameMutation.isPending ? "Updating..." : "Update Username"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Password</CardTitle>
                <CardDescription>Change your password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                data-testid="input-confirm-password"
              />
            </div>

            <Button 
              onClick={handleUpdatePassword}
              disabled={updatePasswordMutation.isPending}
              data-testid="button-update-password"
            >
              {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
