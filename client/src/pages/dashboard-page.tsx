import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LayoutDashboard, Edit, AlertCircle, Sparkles, Download, BarChart3, Eye } from "lucide-react";
import type { Scan } from "@shared/schema";
import { useEffect } from "react";

const editQRFormSchema = z.object({
  decodedUrl: z.string().min(1, "URL is required"),
  title: z.string().optional(),
});

type EditQRFormData = z.infer<typeof editQRFormSchema>;

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
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#9333EA");
  const [topText, setTopText] = useState("qrsocial.com");
  const [bottomText, setBottomText] = useState("long-press to open");
  const [enableBranding, setEnableBranding] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  const form = useForm<EditQRFormData>({
    resolver: zodResolver(editQRFormSchema),
    defaultValues: {
      decodedUrl: "",
      title: "",
    },
  });

  const url = form.watch("decodedUrl");

  useEffect(() => {
    if (!editingScan) return;
    
    setForegroundColor(editingScan.foregroundColor || "#000000");
    setBackgroundColor(editingScan.backgroundColor || "#ffffff");
    setBorderColor(editingScan.borderColor || "#9333EA");
    setTopText(editingScan.topText || "qrsocial.com");
    setBottomText(editingScan.bottomText || "long-press to open");
    setEnableBranding(editingScan.enableBranding ?? true);
    
    form.reset({
      decodedUrl: editingScan.decodedUrl,
      title: editingScan.title || "",
    });
  }, [editingScan, form]);

  useEffect(() => {
    if (!url || !editingScan) {
      setQrImageUrl(editingScan?.qrImageUrl || "");
      return;
    }

    const generateQR = async () => {
      setIsGenerating(true);
      try {
        const QRCode = (await import("qrcode")).default;
        
        const qrDataUrl = await QRCode.toDataURL(url, {
          color: {
            dark: foregroundColor,
            light: backgroundColor,
          },
          width: 400,
          margin: 1,
        });

        if (!enableBranding) {
          setQrImageUrl(qrDataUrl);
          setIsGenerating(false);
          return;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        const borderSize = 60;
        const qrSize = 400;
        canvas.width = qrSize + borderSize * 2;
        canvas.height = qrSize + borderSize * 2;

        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, borderSize, borderSize, qrSize, qrSize);

          if (topText) {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(topText, canvas.width / 2, 35);
          }

          if (bottomText) {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "16px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(bottomText, canvas.width / 2, canvas.height - 25);
          }

          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.font = "10px Inter, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("Made with QR Social", canvas.width - 10, canvas.height - 10);

          const brandedDataUrl = canvas.toDataURL("image/png");
          setQrImageUrl(brandedDataUrl);
          setIsGenerating(false);
        };
        img.src = qrDataUrl;
      } catch (err) {
        console.error("QR generation error:", err);
        setIsGenerating(false);
      }
    };

    const debounce = setTimeout(generateQR, 300);
    return () => clearTimeout(debounce);
  }, [url, foregroundColor, backgroundColor, borderColor, topText, bottomText, enableBranding, editingScan]);

  const updateQRMutation = useMutation({
    mutationFn: async (data: EditQRFormData) => {
      if (!editingScan || !qrImageUrl) {
        throw new Error("QR code generation failed");
      }

      const response = await apiRequest("PATCH", `/api/scans/${editingScan.id}`, {
        decodedUrl: data.decodedUrl,
        title: data.title || undefined,
        qrImageUrl,
        topText: enableBranding ? topText : null,
        bottomText: enableBranding ? bottomText : null,
        borderColor: enableBranding ? borderColor : null,
        enableBranding,
        foregroundColor,
        backgroundColor,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({
        title: "QR Code updated!",
        description: "Your changes have been saved",
      });
      setEditingScan(null);
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to update QR code";
      if (message.includes("Upgrade to Starter")) {
        toast({
          title: "Upgrade Required",
          description: "Free tier users cannot edit QR codes. Upgrade to Starter or higher to unlock editing.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: EditQRFormData) => {
    updateQRMutation.mutate(data);
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

  const handleDownloadQR = (scan: Scan) => {
    if (!scan.qrImageUrl) return;
    
    const link = document.createElement("a");
    link.download = `qr-code-${scan.title || scan.id}.png`;
    link.href = scan.qrImageUrl;
    link.click();
  };

  const handleDownloadPreviewQR = () => {
    if (!qrImageUrl || !editingScan) return;
    
    const link = document.createElement("a");
    link.download = `qr-code-${form.watch("title") || editingScan.id}.png`;
    link.href = qrImageUrl;
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

      <Dialog open={!!editingScan} onOpenChange={(open) => !open && setEditingScan(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="decodedUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination URL *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com"
                            data-testid="input-edit-url"
                            {...field}
                          />
                        </FormControl>
                        {field.value && !isValidUrl(field.value) && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Please enter a valid URL
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="My awesome link"
                            data-testid="input-edit-title"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FormLabel htmlFor="edit-foreground">Foreground</FormLabel>
                      <input
                        id="edit-foreground"
                        type="color"
                        value={foregroundColor}
                        onChange={(e) => setForegroundColor(e.target.value)}
                        className="h-10 w-full rounded-md border cursor-pointer"
                        data-testid="input-edit-foreground-color"
                      />
                    </div>

                    <div className="space-y-2">
                      <FormLabel htmlFor="edit-background">Background</FormLabel>
                      <input
                        id="edit-background"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="h-10 w-full rounded-md border cursor-pointer"
                        data-testid="input-edit-background-color"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="edit-enable-branding"
                        type="checkbox"
                        checked={enableBranding}
                        onChange={(e) => setEnableBranding(e.target.checked)}
                        className="h-4 w-4 rounded border cursor-pointer"
                        data-testid="checkbox-edit-enable-branding"
                      />
                      <FormLabel htmlFor="edit-enable-branding" className="cursor-pointer mb-0">
                        Add custom branding
                      </FormLabel>
                    </div>
                  </div>

                  {enableBranding && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                      <div className="space-y-2">
                        <FormLabel htmlFor="edit-top-text">Top Text</FormLabel>
                        <Input
                          id="edit-top-text"
                          value={topText}
                          onChange={(e) => setTopText(e.target.value)}
                          placeholder="qrsocial.com"
                          maxLength={30}
                          data-testid="input-edit-top-text"
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel htmlFor="edit-bottom-text">Bottom Text</FormLabel>
                        <Input
                          id="edit-bottom-text"
                          value={bottomText}
                          onChange={(e) => setBottomText(e.target.value)}
                          placeholder="long-press to open"
                          maxLength={30}
                          data-testid="input-edit-bottom-text"
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel htmlFor="edit-border-color">Border Color</FormLabel>
                        <input
                          id="edit-border-color"
                          type="color"
                          value={borderColor}
                          onChange={(e) => setBorderColor(e.target.value)}
                          className="h-10 w-full rounded-md border cursor-pointer"
                          data-testid="input-edit-border-color"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditingScan(null)}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={!isValidUrl(url) || !qrImageUrl || updateQRMutation.isPending}
                      data-testid="button-save-edit"
                    >
                      {updateQRMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Preview</h3>
              {qrImageUrl ? (
                <>
                  <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-square">
                    <img
                      src={qrImageUrl}
                      alt="QR Code Preview"
                      className="max-w-full max-h-full"
                      data-testid="img-edit-qr-preview"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadPreviewQR}
                    data-testid="button-download-preview-qr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </>
              ) : (
                <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-square">
                  <p className="text-muted-foreground text-center">
                    Loading preview...
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
