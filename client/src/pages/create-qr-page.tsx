import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, AlertCircle } from "lucide-react";

export default function CreateQRPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!url) {
      setQrImageUrl("");
      return;
    }

    const generateQR = async () => {
      setIsGenerating(true);
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(url, {
          color: {
            dark: foregroundColor,
            light: backgroundColor,
          },
          width: 400,
          margin: 2,
        });
        setQrImageUrl(dataUrl);
      } catch (err) {
        console.error("QR generation error:", err);
      } finally {
        setIsGenerating(false);
      }
    };

    const debounce = setTimeout(generateQR, 300);
    return () => clearTimeout(debounce);
  }, [url, foregroundColor, backgroundColor]);

  const createQRMutation = useMutation({
    mutationFn: async () => {
      if (!qrImageUrl || !url) {
        throw new Error("Please enter a valid URL");
      }

      const response = await apiRequest("POST", "/api/scans", {
        decodedUrl: url,
        qrImageUrl,
        title: title || undefined,
        type: "created",
        isPublic: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/scans"] });
      toast({
        title: "QR Code created!",
        description: "Your QR code has been posted to the feed",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create QR code",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to create QR codes",
        variant: "destructive",
      });
      return;
    }
    createQRMutation.mutate();
  };

  const isValidUrl = (str: string) => {
    if (!str) return false;
    try {
      new URL(str.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/) ? str : `https://${str}`);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-heading font-bold" data-testid="text-create-title">
              Create QR Code
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate a custom QR code and share it to the feed
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Destination URL *</Label>
                <Input
                  id="url"
                  type="text"
                  placeholder="https://example.com or example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  data-testid="input-url"
                />
                {url && !isValidUrl(url) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Please enter a valid URL
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="My awesome link"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="foreground">Foreground</Label>
                  <div className="flex gap-2">
                    <input
                      id="foreground"
                      type="color"
                      value={foregroundColor}
                      onChange={(e) => setForegroundColor(e.target.value)}
                      className="h-10 w-full rounded-md border cursor-pointer"
                      data-testid="input-foreground-color"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background</Label>
                  <div className="flex gap-2">
                    <input
                      id="background"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-10 w-full rounded-md border cursor-pointer"
                      data-testid="input-background-color"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleCreate}
              disabled={!isValidUrl(url) || !qrImageUrl || createQRMutation.isPending}
              data-testid="button-create-qr"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {createQRMutation.isPending ? "Creating..." : "Create & Post to Feed"}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Preview</h3>
              
              {qrImageUrl ? (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-square">
                    <img
                      src={qrImageUrl}
                      alt="QR Code Preview"
                      className="max-w-full max-h-full"
                      data-testid="img-qr-preview"
                    />
                  </div>
                  
                  {title && (
                    <div>
                      <p className="text-sm text-muted-foreground">Title</p>
                      <p className="font-medium" data-testid="text-title-preview">
                        {title}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="text-sm break-all" data-testid="text-url-preview">
                      {url}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-square">
                  <p className="text-muted-foreground text-center">
                    Enter a URL to see your QR code
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {!user && (
          <Card className="p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground text-center">
              💡 Log in to save and share your QR codes to the feed
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
