import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_PRESETS } from "@shared/schema";
import { Sparkles, Download, Eye, Video } from "lucide-react";
import type { Scan, Frame } from "@shared/schema";

export default function OverlayGeneratorPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("tiktok");
  const [selectedQR, setSelectedQR] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [ctaText, setCtaText] = useState<string>("Scan to Shop");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: scans } = useQuery<Scan[]>({
    queryKey: ["/api/scans"],
  });

  const { data: templates } = useQuery<Frame[]>({
    queryKey: ["/api/overlay-templates"],
  });

  const platformConfig = Object.values(PLATFORM_PRESETS).find(
    (p) => p.id === selectedPlatform
  );

  const selectedScan = scans?.find((s) => s.id === selectedQR);
  const selectedFrame = templates?.find((t) => t.id === selectedTemplate);

  useEffect(() => {
    const scan = scans?.find((s) => s.id === selectedQR);
    const frame = templates?.find((t) => t.id === selectedTemplate);
    
    if (!scan || !frame || !platformConfig) {
      setPreviewUrl("");
      return;
    }

    const generatePreview = async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        
        const qrDataUrl = await QRCode.toDataURL(scan.decodedUrl, {
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
          width: 400,
          margin: 1,
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = platformConfig.width;
        canvas.height = platformConfig.height;

        let templateData;
        try {
          templateData = JSON.parse(frame.srcPath);
        } catch (e) {
          console.error("Failed to parse template data:", e);
          templateData = { type: "solid", backgroundColor: "#1a1a1a" };
        }

        if (templateData.type === "gradient") {
          const gradient = ctx.createLinearGradient(
            templateData.direction === "diagonal" ? 0 : canvas.width / 2,
            templateData.direction === "diagonal" ? 0 : 0,
            templateData.direction === "diagonal" ? canvas.width : canvas.width / 2,
            templateData.direction === "diagonal" ? canvas.height : canvas.height
          );
          gradient.addColorStop(0, templateData.colors[0]);
          gradient.addColorStop(1, templateData.colors[1]);
          ctx.fillStyle = gradient;
        } else if (templateData.type === "solid" || templateData.type === "neon" || templateData.type === "minimal" || templateData.type === "frame" || templateData.type === "cta-focused") {
          ctx.fillStyle = templateData.backgroundColor;
        } else if (templateData.type === "arrows" || templateData.type === "pulse") {
          ctx.fillStyle = templateData.backgroundColor;
        }

        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let safeArea;
        try {
          safeArea = JSON.parse(frame.safeArea);
        } catch (e) {
          console.error("Failed to parse safe area:", e);
          safeArea = {
            qr: { x: 340, y: 760, size: 400 },
            cta: { x: 100, y: 1400, width: 880, height: 120 }
          };
        }

        if (!safeArea.qr || !safeArea.cta) {
          console.error("Invalid safe area structure");
          return;
        }

        const qrImage = new Image();
        await new Promise((resolve) => {
          qrImage.onload = resolve;
          qrImage.src = qrDataUrl;
        });

        ctx.drawImage(qrImage, safeArea.qr.x, safeArea.qr.y, safeArea.qr.size, safeArea.qr.size);

        if (ctaText && safeArea.cta) {
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 6;
          ctx.font = "bold 48px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.strokeText(ctaText, canvas.width / 2, safeArea.cta.y + safeArea.cta.height / 2 + 16);
          ctx.fillText(ctaText, canvas.width / 2, safeArea.cta.y + safeArea.cta.height / 2 + 16);
        }

        if (templateData.type === "neon" && templateData.glowColor) {
          ctx.shadowColor = templateData.glowColor;
          ctx.shadowBlur = 40;
          ctx.strokeStyle = templateData.glowColor;
          ctx.lineWidth = 8;
          ctx.strokeRect(safeArea.qr.x - 10, safeArea.qr.y - 10, safeArea.qr.size + 20, safeArea.qr.size + 20);
          ctx.shadowBlur = 0;
        }

        if (templateData.type === "frame" || (templateData.type === "solid" && templateData.overlay === "bold-border")) {
          ctx.strokeStyle = templateData.borderColor || "#8B5CF6";
          ctx.lineWidth = templateData.borderWidth || 8;
          ctx.strokeRect(safeArea.qr.x - 20, safeArea.qr.y - 20, safeArea.qr.size + 40, safeArea.qr.size + 40);
        }

        setPreviewUrl(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Preview generation error:", error);
      }
    };

    generatePreview();
  }, [selectedQR, selectedTemplate, selectedPlatform, ctaText, scans, templates]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold" data-testid="heading-overlay-generator">
              Overlay Generator
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Create platform-perfect video overlays with your QR codes embedded
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Selection</CardTitle>
                <CardDescription>
                  Choose your target social media platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(PLATFORM_PRESETS).map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                        selectedPlatform === platform.id
                          ? "border-primary bg-primary/10"
                          : "border-border"
                      }`}
                      data-testid={`button-platform-${platform.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Video className="w-5 h-5 text-primary" />
                        <Badge variant="secondary" className="text-xs">
                          {platform.aspectRatio}
                        </Badge>
                      </div>
                      <div className="font-semibold text-sm mb-1">{platform.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {platform.width} × {platform.height}
                      </div>
                    </button>
                  ))}
                </div>

                {platformConfig && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium mb-2">Safe Zones</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Top: {platformConfig.safeZone.top}px</div>
                      <div>Bottom: {platformConfig.safeZone.bottom}px</div>
                      <div>Left: {platformConfig.safeZone.left}px</div>
                      <div>Right: {platformConfig.safeZone.right}px</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Select QR Code</CardTitle>
                <CardDescription>
                  Choose which QR code to embed in your overlay
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedQR} onValueChange={setSelectedQR}>
                  <SelectTrigger data-testid="select-qr">
                    <SelectValue placeholder="Select a QR code" />
                  </SelectTrigger>
                  <SelectContent>
                    {scans?.map((scan) => (
                      <SelectItem key={scan.id} value={scan.id}>
                        {scan.title || scan.decodedUrl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overlay Template</CardTitle>
                <CardDescription>
                  Choose a professional overlay design
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {templates && templates.length > 0 ? (
                    templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        className={`p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                          selectedTemplate === template.id
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                        data-testid={`button-template-${template.id}`}
                      >
                        <div className="font-semibold text-sm mb-1">{template.name}</div>
                        <div className="text-xs text-muted-foreground">{template.type}</div>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-2 p-8 text-center text-muted-foreground">
                      <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Premium templates coming soon!</p>
                      <p className="text-xs mt-1">
                        Create studio-quality overlays for your videos
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call to Action</CardTitle>
                <CardDescription>
                  Add custom text to your overlay
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="cta-text">CTA Text</Label>
                  <Input
                    id="cta-text"
                    placeholder="e.g., Scan to Shop"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    data-testid="input-cta-text"
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep it short and actionable (max 120 characters)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
                <CardDescription>
                  See how your overlay will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <canvas ref={canvasRef} className="hidden" />
                <div className="bg-muted/50 rounded-lg overflow-hidden p-4">
                  {previewUrl ? (
                    <div className="flex justify-center">
                      <img
                        src={previewUrl}
                        alt="Overlay preview"
                        className="max-h-[600px] w-auto border-2 border-border/50 rounded-lg shadow-lg"
                        style={{
                          aspectRatio: platformConfig?.aspectRatio || "9/16",
                        }}
                        data-testid="img-preview"
                      />
                    </div>
                  ) : (
                    <div
                      className="mx-auto border-2 border-border/50 bg-background/80 flex items-center justify-center rounded-lg"
                      style={{
                        aspectRatio: platformConfig?.aspectRatio || "9/16",
                        maxHeight: "600px",
                      }}
                    >
                      <div className="text-center p-8">
                        <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground text-sm">
                          Select a QR code and template to preview your overlay
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!selectedQR || !selectedTemplate}
                    data-testid="button-generate"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Overlay
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download MP4
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Why Use Overlays?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Platform-perfect dimensions for TikTok, YouTube, Instagram</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Safe zones ensure your QR code is always visible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Professional motion graphics without design skills</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Download as MP4 to use in CapCut, Premiere, or VN</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
