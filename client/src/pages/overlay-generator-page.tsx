import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { PLATFORM_PRESETS } from "@shared/schema";
import { Sparkles, Download, Eye, Video, Square } from "lucide-react";
import type { Scan, Frame } from "@shared/schema";

export default function OverlayGeneratorPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("tiktok");
  const [selectedQR, setSelectedQR] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [ctaText, setCtaText] = useState<string>("Scan to Shop");
  const [borderRadius, setBorderRadius] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  const [textFont, setTextFont] = useState<string>("Inter");
  const [textSize, setTextSize] = useState<number>(42);
  const [textColor, setTextColor] = useState<string>("#FFFFFF");
  const [qrSizeModifier, setQrSizeModifier] = useState<number>(100);
  const [qrXOffset, setQrXOffset] = useState<number>(0);
  const [qrYOffset, setQrYOffset] = useState<number>(0);
  const [overlayColor, setOverlayColor] = useState<string>("#9333EA");
  
  const [qrBounds, setQrBounds] = useState<{x: number, y: number, size: number} | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
    if (!selectedFrame) {
      setBorderRadius(0);
      return;
    }

    try {
      const templateData = JSON.parse(selectedFrame.srcPath);
      if (templateData.overlay && templateData.overlay.borderRadius !== undefined) {
        setBorderRadius(templateData.overlay.borderRadius);
      }
    } catch (e) {
      setBorderRadius(0);
    }
  }, [selectedFrame]);

  const scaleOverlayForPlatform = (templateData: any, safeArea: any, platformConfig: any) => {
    const BASE_WIDTH = 1080;
    const BASE_HEIGHT = 1920;
    
    const scaleX = platformConfig.width / BASE_WIDTH;
    const scaleY = platformConfig.height / BASE_HEIGHT;
    
    const position = templateData.position;
    const isHorizontal = platformConfig.width > platformConfig.height;
    
    let scaledOverlay = { ...templateData.overlay };
    let scaledQR = { ...safeArea.qr };
    let scaledCTA = { ...safeArea.cta };
    
    if (position === "banner-top") {
      scaledOverlay.x = 0;
      scaledOverlay.y = 0;
      scaledOverlay.width = platformConfig.width;
      scaledOverlay.height = isHorizontal ? 200 : Math.round(templateData.overlay.height * scaleY);
      
      scaledQR.x = 40;
      scaledQR.y = isHorizontal ? 50 : Math.round(safeArea.qr.y * scaleY);
      scaledQR.size = isHorizontal ? 140 : Math.round(safeArea.qr.size * scaleY);
      
      scaledCTA.x = scaledQR.x + scaledQR.size + 30;
      scaledCTA.y = scaledQR.y;
      scaledCTA.width = platformConfig.width - scaledCTA.x - 40;
      scaledCTA.height = scaledQR.size;
    } else if (position === "banner-bottom") {
      scaledOverlay.x = 0;
      scaledOverlay.y = isHorizontal ? platformConfig.height - 200 : platformConfig.height - Math.round(templateData.overlay.height * scaleY);
      scaledOverlay.width = platformConfig.width;
      scaledOverlay.height = isHorizontal ? 200 : Math.round(templateData.overlay.height * scaleY);
      
      scaledQR.x = 40;
      scaledQR.y = scaledOverlay.y + (isHorizontal ? 30 : 40);
      scaledQR.size = isHorizontal ? 140 : Math.round(safeArea.qr.size * scaleY);
      
      scaledCTA.x = scaledQR.x + scaledQR.size + 30;
      scaledCTA.y = scaledQR.y;
      scaledCTA.width = platformConfig.width - scaledCTA.x - 40;
      scaledCTA.height = scaledQR.size;
    } else if (position.startsWith("corner-")) {
      const overlaySize = isHorizontal ? Math.min(350, platformConfig.height * 0.4) : Math.round(templateData.overlay.width * scaleX);
      const overlayHeight = isHorizontal ? overlaySize * 1.1 : Math.round(templateData.overlay.height * scaleY);
      const margin = isHorizontal ? 30 : 40;
      
      if (position === "corner-tl") {
        scaledOverlay.x = margin;
        scaledOverlay.y = isHorizontal ? margin + 80 : platformConfig.safeZone.top + 30;
      } else if (position === "corner-tr") {
        scaledOverlay.x = platformConfig.width - overlaySize - margin;
        scaledOverlay.y = isHorizontal ? margin + 80 : platformConfig.safeZone.top + 30;
      } else if (position === "corner-bl") {
        scaledOverlay.x = margin;
        scaledOverlay.y = platformConfig.height - overlayHeight - (isHorizontal ? margin + 80 : platformConfig.safeZone.bottom + 30);
      } else if (position === "corner-br") {
        scaledOverlay.x = platformConfig.width - overlaySize - margin;
        scaledOverlay.y = platformConfig.height - overlayHeight - (isHorizontal ? margin + 80 : platformConfig.safeZone.bottom + 30);
      }
      
      scaledOverlay.width = overlaySize;
      scaledOverlay.height = overlayHeight;
      
      const qrSize = overlaySize * 0.65;
      scaledQR.x = scaledOverlay.x + (overlaySize - qrSize) / 2;
      scaledQR.y = scaledOverlay.y + 40;
      scaledQR.size = qrSize;
      
      scaledCTA.x = scaledOverlay.x + 20;
      scaledCTA.y = scaledQR.y + qrSize + 20;
      scaledCTA.width = overlaySize - 40;
      scaledCTA.height = 60;
    } else if (position.startsWith("sidebar-")) {
      const sidebarWidth = isHorizontal ? 250 : Math.round(templateData.overlay.width * scaleX);
      
      if (position === "sidebar-left") {
        scaledOverlay.x = 0;
      } else {
        scaledOverlay.x = platformConfig.width - sidebarWidth;
      }
      
      scaledOverlay.y = isHorizontal ? 100 : platformConfig.safeZone.top;
      scaledOverlay.width = sidebarWidth;
      scaledOverlay.height = platformConfig.height - (isHorizontal ? 200 : platformConfig.safeZone.top + platformConfig.safeZone.bottom);
      
      const qrSize = sidebarWidth * 0.7;
      scaledQR.x = scaledOverlay.x + (sidebarWidth - qrSize) / 2;
      scaledQR.y = scaledOverlay.y + scaledOverlay.height / 2 - qrSize / 2 - 60;
      scaledQR.size = qrSize;
      
      scaledCTA.x = scaledOverlay.x + 20;
      scaledCTA.y = scaledQR.y + qrSize + 30;
      scaledCTA.width = sidebarWidth - 40;
      scaledCTA.height = 80;
    } else if (position === "center") {
      const squareSize = isHorizontal ? Math.min(450, platformConfig.height * 0.55) : Math.round(templateData.overlay.width * scaleX);
      
      scaledOverlay.x = (platformConfig.width - squareSize) / 2;
      scaledOverlay.y = (platformConfig.height - squareSize) / 2;
      scaledOverlay.width = squareSize;
      scaledOverlay.height = squareSize;
      
      const qrSize = squareSize * 0.6;
      scaledQR.x = scaledOverlay.x + (squareSize - qrSize) / 2;
      scaledQR.y = scaledOverlay.y + (squareSize - qrSize) / 2 - 30;
      scaledQR.size = qrSize;
      
      scaledCTA.x = scaledOverlay.x + 30;
      scaledCTA.y = scaledQR.y + qrSize + 30;
      scaledCTA.width = squareSize - 60;
      scaledCTA.height = 50;
    }
    
    return { scaledOverlay, scaledQR, scaledCTA };
  };

  useEffect(() => {
    const scan = scans?.find((s) => s.id === selectedQR);
    const frame = templates?.find((t) => t.id === selectedTemplate);
    
    if (!scan || !frame || !platformConfig) {
      setPreviewUrl("");
      setQrBounds(null);
      return;
    }

    const generatePreview = async () => {
      try {
        const qrDataUrl = scan.qrImageUrl;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = platformConfig.width;
        canvas.height = platformConfig.height;

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#1a1a1a");
        gradient.addColorStop(1, "#2d2d2d");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let templateData;
        try {
          templateData = JSON.parse(frame.srcPath);
        } catch (e) {
          console.error("Failed to parse template data:", e);
          return;
        }

        let safeArea;
        try {
          safeArea = JSON.parse(frame.safeArea);
        } catch (e) {
          console.error("Failed to parse safe area:", e);
          return;
        }

        if (!templateData.overlay || !safeArea.qr || !safeArea.cta) {
          console.error("Invalid template structure");
          return;
        }

        const { scaledOverlay, scaledQR, scaledCTA } = scaleOverlayForPlatform(templateData, safeArea, platformConfig);
        const effectiveBorderRadius = borderRadius >= 0 ? borderRadius : templateData.overlay.borderRadius;
        
        ctx.save();
        
        if (effectiveBorderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height, effectiveBorderRadius);
          ctx.fillStyle = overlayColor;
          ctx.fill();
        } else {
          ctx.fillStyle = overlayColor;
          ctx.fillRect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height);
        }
        
        ctx.restore();

        const qrImage = new Image();
        await new Promise((resolve) => {
          qrImage.onload = resolve;
          qrImage.src = qrDataUrl;
        });

        const qrSizeAdjusted = scaledQR.size * (qrSizeModifier / 100);
        const qrXAdjusted = scaledQR.x + qrXOffset;
        const qrYAdjusted = scaledQR.y + qrYOffset;

        ctx.drawImage(qrImage, qrXAdjusted, qrYAdjusted, qrSizeAdjusted, qrSizeAdjusted);
        
        setQrBounds({ x: qrXAdjusted, y: qrYAdjusted, size: qrSizeAdjusted });

        if (ctaText && scaledCTA) {
          const brightness = parseInt(textColor.slice(1, 3), 16) * 0.299 + 
                           parseInt(textColor.slice(3, 5), 16) * 0.587 + 
                           parseInt(textColor.slice(5, 7), 16) * 0.114;
          const strokeColor = brightness > 128 ? "#000000" : "#FFFFFF";
          
          ctx.fillStyle = textColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.font = `bold ${textSize}px ${textFont}, sans-serif`;
          ctx.textAlign = safeArea.cta.align || "center";
          
          const textX = safeArea.cta.align === "left" ? scaledCTA.x + 20 : 
                       safeArea.cta.align === "right" ? scaledCTA.x + scaledCTA.width - 20 :
                       scaledCTA.x + scaledCTA.width / 2;
          const textY = scaledCTA.y + scaledCTA.height / 2 + (textSize / 3);
          
          ctx.strokeText(ctaText, textX, textY);
          ctx.fillText(ctaText, textX, textY);
        }

        setPreviewUrl(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Preview generation error:", error);
      }
    };

    generatePreview();
  }, [selectedQR, selectedTemplate, selectedPlatform, ctaText, borderRadius, scans, templates, 
      textFont, textSize, textColor, qrSizeModifier, qrXOffset, qrYOffset, overlayColor]);

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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Square className="w-5 h-5" />
                  Style Customization
                </CardTitle>
                <CardDescription>
                  Customize the overlay appearance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="overlay-color">Overlay Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="overlay-color"
                        type="color"
                        value={overlayColor}
                        onChange={(e) => setOverlayColor(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                        data-testid="input-overlay-color"
                      />
                      <Input
                        type="text"
                        value={overlayColor}
                        onChange={(e) => setOverlayColor(e.target.value)}
                        className="flex-1"
                        placeholder="#9333EA"
                        data-testid="input-overlay-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="border-radius">Border Radius</Label>
                      <span className="text-sm text-muted-foreground">{borderRadius}px</span>
                    </div>
                    <Slider
                      id="border-radius"
                      min={0}
                      max={50}
                      step={1}
                      value={[borderRadius]}
                      onValueChange={(value) => setBorderRadius(value[0])}
                      data-testid="slider-border-radius"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">Text Styling</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="text-font">Font</Label>
                        <Select value={textFont} onValueChange={setTextFont}>
                          <SelectTrigger id="text-font" data-testid="select-text-font">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Inter">Inter</SelectItem>
                            <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Georgia">Georgia</SelectItem>
                            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                            <SelectItem value="Courier New">Courier New</SelectItem>
                            <SelectItem value="Impact">Impact</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="text-size">Text Size</Label>
                          <span className="text-sm text-muted-foreground">{textSize}px</span>
                        </div>
                        <Slider
                          id="text-size"
                          min={20}
                          max={80}
                          step={2}
                          value={[textSize]}
                          onValueChange={(value) => setTextSize(value[0])}
                          data-testid="slider-text-size"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="text-color">Text Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="text-color"
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-20 h-10 p-1 cursor-pointer"
                            data-testid="input-text-color"
                          />
                          <Input
                            type="text"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="flex-1"
                            placeholder="#FFFFFF"
                            data-testid="input-text-color-text"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">QR Code Position & Size</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="qr-size">Size</Label>
                          <span className="text-sm text-muted-foreground">{qrSizeModifier}%</span>
                        </div>
                        <Slider
                          id="qr-size"
                          min={50}
                          max={150}
                          step={5}
                          value={[qrSizeModifier]}
                          onValueChange={(value) => setQrSizeModifier(value[0])}
                          data-testid="slider-qr-size"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="qr-x">Horizontal Position</Label>
                          <span className="text-sm text-muted-foreground">{qrXOffset}px</span>
                        </div>
                        <Slider
                          id="qr-x"
                          min={-200}
                          max={200}
                          step={10}
                          value={[qrXOffset]}
                          onValueChange={(value) => setQrXOffset(value[0])}
                          data-testid="slider-qr-x"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="qr-y">Vertical Position</Label>
                          <span className="text-sm text-muted-foreground">{qrYOffset}px</span>
                        </div>
                        <Slider
                          id="qr-y"
                          min={-200}
                          max={200}
                          step={10}
                          value={[qrYOffset]}
                          onValueChange={(value) => setQrYOffset(value[0])}
                          data-testid="slider-qr-y"
                        />
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setTextFont("Inter");
                      setTextSize(42);
                      setTextColor("#FFFFFF");
                      setQrSizeModifier(100);
                      setQrXOffset(0);
                      setQrYOffset(0);
                      setOverlayColor("#9333EA");
                      setBorderRadius(0);
                    }}
                    data-testid="button-reset-styles"
                  >
                    Reset to Defaults
                  </Button>
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
