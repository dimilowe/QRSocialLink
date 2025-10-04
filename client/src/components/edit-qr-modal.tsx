import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, ExternalLink } from "lucide-react";
import { Scan } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditQRModalProps {
  scan: Scan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditQRModal({ scan, open, onOpenChange }: EditQRModalProps) {
  const [redirectUrl, setRedirectUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (scan && open) {
      setRedirectUrl(scan.redirectUrl || "");
    }
  }, [scan, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: { scanId: string; redirectUrl: string | null }) => {
      return await apiRequest("PATCH", `/api/scans/${data.scanId}/redirect`, {
        redirectUrl: data.redirectUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "QR Updated",
        description: "Your dynamic QR redirect has been updated successfully.",
      });
      onOpenChange(false);
      setRedirectUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update QR redirect",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scan) return;

    if (!redirectUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL or click Clear to remove redirect",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = new URL(redirectUrl.trim());
      if (!url.protocol.startsWith('https')) {
        toast({
          title: "HTTPS Required",
          description: "Redirect URLs must use HTTPS for security",
          variant: "destructive",
        });
        return;
      }
      updateMutation.mutate({ scanId: scan.id, redirectUrl: redirectUrl.trim() });
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    if (!scan) return;
    updateMutation.mutate({ scanId: scan.id, redirectUrl: null });
  };

  const currentUrl = scan?.redirectUrl || scan?.decodedUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-edit-qr">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[hsl(var(--pro-badge-from))]" />
            <DialogTitle>Edit Dynamic QR</DialogTitle>
          </div>
          <DialogDescription>
            Update the destination URL for this QR code without changing the QR image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center p-4 bg-white rounded-md">
            <img 
              src={scan?.qrImageUrl} 
              alt="QR Code" 
              className="w-32 h-32 object-contain"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Current Destination</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{currentUrl}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redirectUrl">New Destination URL</Label>
              <Input
                id="redirectUrl"
                type="url"
                placeholder="https://example.com/new-destination"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                disabled={updateMutation.isPending}
                data-testid="input-redirect-url"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              {scan?.redirectUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleClear}
                  disabled={updateMutation.isPending}
                  data-testid="button-clear-redirect"
                >
                  Clear Redirect
                </Button>
              )}
              <Button
                type="submit"
                disabled={updateMutation.isPending || !redirectUrl.trim()}
                data-testid="button-save-redirect"
              >
                {updateMutation.isPending ? "Updating..." : "Update QR"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
