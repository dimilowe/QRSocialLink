import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, AlertCircle, Download, Upload, X, Image as ImageIcon, Square, Circle, Star, Heart, Diamond } from "lucide-react";
import { insertScanSchema } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";

const createQRFormSchema = insertScanSchema
  .pick({ decodedUrl: true, title: true })
  .extend({
    decodedUrl: z.string().min(1, "URL is required"),
    title: z.string().optional(),
  });

type CreateQRFormData = z.infer<typeof createQRFormSchema>;

export default function CreateQRPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#9333EA");
  const [topText, setTopText] = useState("qrsocial.com");
  const [bottomText, setBottomText] = useState("long-press to open");
  const [enableBranding, setEnableBranding] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrOverlayUrl, setQrOverlayUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundImageType, setBackgroundImageType] = useState<string | null>(null);
  const [imageFit, setImageFit] = useState<"cover" | "contain" | "stretch">("cover");
  const [borderShape, setBorderShape] = useState<"square" | "circle" | "star" | "polaroid" | "diamond" | "heart">("square");
  const [polaroidText, setPolaroidText] = useState("");
  const [canvasFillEnabled, setCanvasFillEnabled] = useState(false);
  const [canvasFillColor, setCanvasFillColor] = useState("#FFFFFF");
  const [giflerInstance, setGiflerInstance] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enableABTesting, setEnableABTesting] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const form = useForm<CreateQRFormData>({
    resolver: zodResolver(createQRFormSchema),
    defaultValues: {
      decodedUrl: "",
      title: "",
    },
  });

  const url = form.watch("decodedUrl");

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user && enableABTesting,
  });

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
      setBackgroundImageType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const removeBackgroundImage = () => {
    if (giflerInstance && giflerInstance.stop) {
      giflerInstance.stop();
    }
    setGiflerInstance(null);
    setBackgroundImage(null);
    setBackgroundImageType(null);
  };

  const getShapeDimensions = (shape: typeof borderShape) => {
    const borderSize = 60;
    const qrSize = 400;
    
    if (shape === "polaroid") {
      return {
        width: qrSize + borderSize * 2,
        height: qrSize + borderSize * 2 + 100,
        qrX: borderSize,
        qrY: borderSize,
        qrSize,
        borderSize,
      };
    }
    
    return {
      width: qrSize + borderSize * 2,
      height: qrSize + borderSize * 2,
      qrX: borderSize,
      qrY: borderSize,
      qrSize,
      borderSize,
    };
  };

  const createShapePath = (ctx: CanvasRenderingContext2D, shape: typeof borderShape, width: number, height: number) => {
    ctx.beginPath();
    
    const centerX = width / 2;
    const centerY = shape === "polaroid" ? (height - 100) / 2 : height / 2;
    
    switch (shape) {
      case "circle":
        const radius = Math.min(width, height) / 2;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        break;
        
      case "star":
        const outerRadius = Math.min(width, height) / 2;
        const innerRadius = outerRadius * 0.4;
        const spikes = 5;
        
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI * i) / spikes - Math.PI / 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
        
      case "heart":
        const heartSize = Math.min(width, height) / 2.2;
        const topY = centerY - heartSize * 0.3;
        
        ctx.moveTo(centerX, topY + heartSize);
        ctx.bezierCurveTo(centerX, topY + heartSize * 0.6, centerX - heartSize * 1.1, topY, centerX - heartSize * 0.7, topY);
        ctx.bezierCurveTo(centerX - heartSize * 1.3, topY, centerX - heartSize * 1.3, topY + heartSize * 0.6, centerX - heartSize * 1.3, topY + heartSize * 0.6);
        ctx.bezierCurveTo(centerX - heartSize * 1.3, topY + heartSize * 1.2, centerX, topY + heartSize * 1.8, centerX, topY + heartSize * 2.2);
        ctx.bezierCurveTo(centerX, topY + heartSize * 1.8, centerX + heartSize * 1.3, topY + heartSize * 1.2, centerX + heartSize * 1.3, topY + heartSize * 0.6);
        ctx.bezierCurveTo(centerX + heartSize * 1.3, topY + heartSize * 0.6, centerX + heartSize * 1.3, topY, centerX + heartSize * 0.7, topY);
        ctx.bezierCurveTo(centerX + heartSize * 1.1, topY, centerX, topY + heartSize * 0.6, centerX, topY + heartSize);
        ctx.closePath();
        break;
        
      case "diamond":
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        ctx.moveTo(centerX, centerY - halfHeight);
        ctx.lineTo(centerX + halfWidth, centerY);
        ctx.lineTo(centerX, centerY + halfHeight);
        ctx.lineTo(centerX - halfWidth, centerY);
        ctx.closePath();
        break;
        
      case "polaroid":
        // Polaroid includes the full rectangle with footer area
        ctx.rect(0, 0, width, height);
        break;
      case "square":
      default:
        ctx.rect(0, 0, width, height);
        break;
    }
  };

  const generateBrandedQR = async (params: {
    targetUrl: string;
    foregroundColor: string;
    backgroundColor: string;
    borderColor: string;
    topText: string;
    bottomText: string;
    enableBranding: boolean;
    backgroundImage: string | null;
    backgroundImageType: string | null;
    imageFit: "cover" | "contain" | "stretch";
    borderShape: "square" | "circle" | "star" | "polaroid" | "diamond" | "heart";
    polaroidText: string;
    canvasFillEnabled: boolean;
    canvasFillColor: string;
  }): Promise<{ qrImageUrl: string; qrOverlayUrl?: string }> => {
    const {
      targetUrl,
      foregroundColor,
      backgroundColor,
      borderColor,
      topText,
      bottomText,
      enableBranding,
      backgroundImage,
      backgroundImageType,
      imageFit,
      borderShape,
      polaroidText,
      canvasFillEnabled,
      canvasFillColor,
    } = params;

    const QRCode = (await import("qrcode")).default;
    
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
      width: 400,
      margin: 1,
    });

    if (!enableBranding && !backgroundImage && borderShape === "square") {
      return { qrImageUrl: qrDataUrl };
    }

    const dims = getShapeDimensions(borderShape);
    const { width: totalWidth, height: totalHeight, qrX, qrY, qrSize } = dims;

    const drawImageOnCanvas = (ctx: CanvasRenderingContext2D, image: HTMLImageElement | ImageBitmap, imgWidth: number, imgHeight: number, canvasWidth: number, canvasHeight: number) => {
      if (imageFit === "cover") {
        const aspectRatio = imgWidth / imgHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (aspectRatio > canvasAspectRatio) {
          drawHeight = canvasHeight;
          drawWidth = drawHeight * aspectRatio;
          offsetX = (canvasWidth - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = canvasWidth;
          drawHeight = drawWidth / aspectRatio;
          offsetX = 0;
          offsetY = (canvasHeight - drawHeight) / 2;
        }
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      } else if (imageFit === "contain") {
        const aspectRatio = imgWidth / imgHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (aspectRatio > canvasAspectRatio) {
          drawWidth = canvasWidth;
          drawHeight = drawWidth / aspectRatio;
          offsetX = 0;
          offsetY = (canvasHeight - drawHeight) / 2;
        } else {
          drawHeight = canvasHeight;
          drawWidth = drawHeight * aspectRatio;
          offsetX = (canvasWidth - drawWidth) / 2;
          offsetY = 0;
        }
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
      }
    };

    const qrImage = new Image();
    await new Promise((resolve) => {
      qrImage.onload = resolve;
      qrImage.src = qrDataUrl;
    });

    const drawQROverlay = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      const isPolaroid = borderShape === "polaroid";

      if (enableBranding && !isPolaroid) {
        if (topText) {
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3;
          ctx.font = "bold 24px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.strokeText(topText, canvasWidth / 2, 35);
          ctx.fillText(topText, canvasWidth / 2, 35);
        }

        if (bottomText) {
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3;
          ctx.font = "16px Inter, sans-serif";
          ctx.textAlign = "center";
          const bottomY = isPolaroid ? canvasHeight - 125 : canvasHeight - 25;
          ctx.strokeText(bottomText, canvasWidth / 2, bottomY);
          ctx.fillText(bottomText, canvasWidth / 2, bottomY);
        }
      }

      if (isPolaroid && polaroidText) {
        ctx.fillStyle = "#000000";
        ctx.font = "italic 20px 'Permanent Marker', cursive, Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(polaroidText, canvasWidth / 2, canvasHeight - 50);
      }

      const watermarkY = isPolaroid ? canvasHeight - 10 : canvasHeight - 10;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Made with QR Social", canvasWidth - 10, watermarkY);
    };

    if (backgroundImage && backgroundImageType === "image/gif") {
      const overlayCanvas = document.createElement("canvas");
      const overlayCtx = overlayCanvas.getContext("2d");
      if (!overlayCtx) throw new Error("Canvas not supported");

      overlayCanvas.width = totalWidth;
      overlayCanvas.height = totalHeight;

      drawQROverlay(overlayCtx, totalWidth, totalHeight);

      const transparentQRUrl = overlayCanvas.toDataURL("image/png");

      const compositeCanvas = document.createElement("canvas");
      const compositeCtx = compositeCanvas.getContext("2d");
      if (!compositeCtx) throw new Error("Canvas not supported");

      compositeCanvas.width = totalWidth;
      compositeCanvas.height = totalHeight;

      const compositeDataUrl = await new Promise<string>((resolve) => {
        const bgImg = new Image();
        bgImg.onload = () => {
          if (canvasFillEnabled) {
            compositeCtx.fillStyle = canvasFillColor;
            compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
          } else {
            compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
          }
          
          compositeCtx.save();
          createShapePath(compositeCtx, borderShape, compositeCanvas.width, compositeCanvas.height);
          compositeCtx.clip();
          drawImageOnCanvas(compositeCtx, bgImg, bgImg.width, bgImg.height, compositeCanvas.width, compositeCanvas.height);
          compositeCtx.restore();
          
          compositeCtx.globalCompositeOperation = "destination-out";
          compositeCtx.fillRect(qrX, qrY, qrSize, qrSize);
          compositeCtx.globalCompositeOperation = "source-over";
          
          compositeCtx.fillStyle = "#FFFFFF";
          compositeCtx.fillRect(qrX, qrY, qrSize, qrSize);
          
          drawQROverlay(compositeCtx, compositeCanvas.width, compositeCanvas.height);

          resolve(compositeCanvas.toDataURL("image/png"));
        };
        bgImg.src = backgroundImage;
      });

      return { qrImageUrl: compositeDataUrl, qrOverlayUrl: transparentQRUrl };
    } else if (backgroundImage) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      const brandedDataUrl = await new Promise<string>((resolve) => {
        const bgImg = new Image();
        bgImg.onload = () => {
          if (canvasFillEnabled) {
            ctx.fillStyle = canvasFillColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.save();
          createShapePath(ctx, borderShape, canvas.width, canvas.height);
          ctx.clip();
          drawImageOnCanvas(ctx, bgImg, bgImg.width, bgImg.height, canvas.width, canvas.height);
          ctx.restore();
          
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillRect(qrX, qrY, qrSize, qrSize);
          ctx.globalCompositeOperation = "source-over";
          
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(qrX, qrY, qrSize, qrSize);
          
          drawQROverlay(ctx, canvas.width, canvas.height);

          resolve(canvas.toDataURL("image/png"));
        };
        bgImg.src = backgroundImage;
      });

      return { qrImageUrl: brandedDataUrl };
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      if (canvasFillEnabled) {
        ctx.fillStyle = canvasFillColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      createShapePath(ctx, borderShape, canvas.width, canvas.height);
      ctx.fillStyle = borderColor;
      ctx.fill();
      
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.globalCompositeOperation = "source-over";
      
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      
      drawQROverlay(ctx, canvas.width, canvas.height);

      const brandedDataUrl = canvas.toDataURL("image/png");
      return { qrImageUrl: brandedDataUrl };
    }
  };

  useEffect(() => {
    if (!url) {
      setQrImageUrl("");
      return;
    }

    const generateQR = async () => {
      setIsGenerating(true);
      try {
        const result = await generateBrandedQR({
          targetUrl: url,
          foregroundColor,
          backgroundColor,
          borderColor,
          topText,
          bottomText,
          enableBranding,
          backgroundImage,
          backgroundImageType,
          imageFit,
          borderShape,
          polaroidText,
          canvasFillEnabled,
          canvasFillColor,
        });

        setQrImageUrl(result.qrImageUrl);
        if (result.qrOverlayUrl) {
          setQrOverlayUrl(result.qrOverlayUrl);
        }
        setIsGenerating(false);
      } catch (err) {
        console.error("QR generation error:", err);
        setIsGenerating(false);
      }
    };

    const debounce = setTimeout(generateQR, 300);
    return () => {
      clearTimeout(debounce);
      if (giflerInstance && giflerInstance.stop) {
        giflerInstance.stop();
      }
    };
  }, [url, foregroundColor, backgroundColor, borderColor, topText, bottomText, enableBranding, backgroundImage, backgroundImageType, imageFit, borderShape, polaroidText, canvasFillEnabled, canvasFillColor]);

  const createQRMutation = useMutation({
    mutationFn: async (data: CreateQRFormData) => {
      if (!qrImageUrl) {
        throw new Error("QR code generation failed");
      }

      const response = await apiRequest("POST", "/api/scans", {
        decodedUrl: data.decodedUrl,
        qrImageUrl,
        title: data.title || undefined,
        type: "created",
        isPublic: true,
        destination: enableABTesting ? null : data.decodedUrl,
        campaignId: enableABTesting ? selectedCampaignId : null,
        topText: enableBranding ? topText : null,
        bottomText: enableBranding ? bottomText : null,
        borderColor: enableBranding ? borderColor : null,
        enableBranding,
        foregroundColor,
        backgroundColor,
        backgroundImage: backgroundImage || null,
        borderShape,
        imageFitMode: imageFit,
        polaroidText: borderShape === "polaroid" ? polaroidText : null,
        canvasFillEnabled,
        canvasFillColor,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresUpgrade) {
          const upgradeError: any = new Error(errorData.message);
          upgradeError.requiresUpgrade = true;
          throw upgradeError;
        }
        throw new Error(errorData.message || "Failed to create QR code");
      }
      
      const savedScan = await response.json();
      
      if (savedScan.dynamicSlug) {
        try {
          const trackingUrl = `${window.location.origin}/q/${savedScan.dynamicSlug}`;
          
          const brandedTrackingQR = await generateBrandedQR({
            targetUrl: trackingUrl,
            foregroundColor,
            backgroundColor,
            borderColor,
            topText,
            bottomText,
            enableBranding,
            backgroundImage,
            backgroundImageType,
            imageFit,
            borderShape,
            polaroidText,
            canvasFillEnabled,
            canvasFillColor,
          });

          const updateResponse = await apiRequest("PATCH", `/api/scans/${savedScan.id}`, {
            qrImageUrl: brandedTrackingQR.qrImageUrl,
          });
          
          if (!updateResponse.ok) {
            throw new Error("Failed to update QR with tracking URL");
          }
        } catch (trackingError) {
          console.error("Tracking QR generation failed:", trackingError);
          throw new Error("Failed to generate analytics-enabled QR code");
        }
      }
      
      return savedScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/scans"] });
      toast({
        title: "QR Code created!",
        description: "Analytics-enabled QR code saved to your dashboard",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      if (error.requiresUpgrade) {
        toast({
          title: "Upgrade Required",
          description: error.message,
          variant: "destructive",
          action: (
            <Button variant="outline" size="sm" onClick={() => setLocation("/pricing")}>
              View Plans
            </Button>
          ) as any,
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create QR code",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: CreateQRFormData) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to create QR codes",
        variant: "destructive",
      });
      return;
    }
    if (enableABTesting && !selectedCampaignId) {
      toast({
        title: "Campaign Required",
        description: "Please select a campaign for A/B testing",
        variant: "destructive",
      });
      return;
    }
    createQRMutation.mutate(data);
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

  const handleDownloadQR = async () => {
    if (!qrImageUrl) return;
    
    if (user && user.plan === 'free') {
      toast({
        title: "Upgrade Required",
        description: "Upgrade to a paid plan to download QR codes. You can build and preview for free!",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => setLocation("/pricing")}>
            View Plans
          </Button>
        ) as any,
      });
      return;
    }
    
    if (backgroundImage && backgroundImageType?.includes('gif')) {
      try {
        toast({
          title: "Generating Animated QR...",
          description: "Processing your animated QR code, this may take a few seconds",
        });

        const response = await fetch('/api/generate-animated-qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            backgroundImageData: backgroundImage,
            qrCodeData: qrOverlayUrl,
            imageFit: imageFit,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate animated QR');
        }

        const data = await response.json();
        
        const link = document.createElement("a");
        link.download = `qr-code-${form.watch("title") || "download"}.gif`;
        link.href = data.animatedQrCode;
        link.click();

        toast({
          title: "Animated QR Downloaded",
          description: "Your animated QR code has been saved to your device",
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Could not generate animated QR. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      const link = document.createElement("a");
      link.download = `qr-code-${form.watch("title") || "download"}.png`;
      link.href = qrImageUrl;
      link.click();

      toast({
        title: "QR Code Downloaded",
        description: "Your QR code has been saved to your device",
      });
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
              Generate custom branded QR codes for your marketing campaigns
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="decodedUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination URL *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com or example.com"
                            data-testid="input-url"
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
                            data-testid="input-title"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable A/B Testing</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Track multiple destinations and optimize conversions
                      </p>
                    </div>
                    <Switch
                      checked={enableABTesting}
                      onCheckedChange={setEnableABTesting}
                      data-testid="switch-ab-testing"
                    />
                  </div>

                  {enableABTesting && (
                    <div className="space-y-2">
                      <FormLabel>Campaign *</FormLabel>
                      <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger data-testid="select-campaign">
                          <SelectValue placeholder="Select a campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaigns?.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                          {(!campaigns || campaigns.length === 0) && (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No campaigns found. Create one first.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select a campaign with multiple destinations for A/B testing
                      </p>
                    </div>
                  )}

                  <Tabs defaultValue="qr" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="qr" data-testid="tab-qr-settings">QR Code</TabsTrigger>
                      <TabsTrigger value="background" data-testid="tab-background-settings">Background</TabsTrigger>
                    </TabsList>

                    <TabsContent value="qr" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <FormLabel htmlFor="foreground">Foreground</FormLabel>
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
                          <FormLabel htmlFor="background">Background</FormLabel>
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

                      <div className="space-y-2">
                        <FormLabel>Border Shape</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "square", icon: Square, label: "Square" },
                            { value: "circle", icon: Circle, label: "Circle" },
                            { value: "star", icon: Star, label: "Star" },
                            { value: "heart", icon: Heart, label: "Heart" },
                            { value: "diamond", icon: Diamond, label: "Diamond" },
                            { value: "polaroid", icon: ImageIcon, label: "Polaroid" },
                          ].map((shape) => {
                            const Icon = shape.icon;
                            return (
                              <button
                                key={shape.value}
                                type="button"
                                onClick={() => setBorderShape(shape.value as typeof borderShape)}
                                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all hover-elevate ${
                                  borderShape === shape.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border"
                                }`}
                                data-testid={`button-shape-${shape.value}`}
                              >
                                <Icon className="w-5 h-5" />
                                <span className="text-xs font-medium">{shape.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Choose a creative border shape for your QR code
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            id="enable-branding"
                            type="checkbox"
                            checked={enableBranding}
                            onChange={(e) => setEnableBranding(e.target.checked)}
                            className="h-4 w-4 rounded border cursor-pointer"
                            data-testid="checkbox-enable-branding"
                          />
                          <FormLabel htmlFor="enable-branding" className="cursor-pointer mb-0">
                            Add custom branding
                          </FormLabel>
                        </div>
                      </div>

                      {borderShape === "polaroid" && (
                        <div className="space-y-2 p-4 border rounded-md bg-muted/30">
                          <FormLabel htmlFor="polaroid-text">Polaroid Caption</FormLabel>
                          <Input
                            id="polaroid-text"
                            value={polaroidText}
                            onChange={(e) => setPolaroidText(e.target.value)}
                            placeholder="Your caption here..."
                            maxLength={50}
                            data-testid="input-polaroid-text"
                          />
                          <p className="text-xs text-muted-foreground">
                            Add a custom caption in the Polaroid-style bottom strip
                          </p>
                        </div>
                      )}

                      {enableBranding && (
                        <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                          <div className="space-y-2">
                            <FormLabel htmlFor="top-text">Top Text</FormLabel>
                            <Input
                              id="top-text"
                              value={topText}
                              onChange={(e) => setTopText(e.target.value)}
                              placeholder="qrsocial.com"
                              maxLength={30}
                              data-testid="input-top-text"
                            />
                          </div>

                          <div className="space-y-2">
                            <FormLabel htmlFor="bottom-text">Bottom Text</FormLabel>
                            <Input
                              id="bottom-text"
                              value={bottomText}
                              onChange={(e) => setBottomText(e.target.value)}
                              placeholder="long-press to open"
                              maxLength={30}
                              data-testid="input-bottom-text"
                            />
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="background" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <FormLabel>Background Image</FormLabel>
                        {backgroundImage ? (
                          <div className="space-y-2">
                            <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden">
                              <img
                                src={backgroundImage}
                                alt="Background preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={removeBackgroundImage}
                              data-testid="button-remove-background"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove Background Image
                            </Button>
                            <div className="space-y-2">
                              <FormLabel htmlFor="image-fit">Image Fit</FormLabel>
                              <Select value={imageFit} onValueChange={(value: "cover" | "contain" | "stretch") => setImageFit(value)}>
                                <SelectTrigger data-testid="select-image-fit">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cover">Cover (fill frame)</SelectItem>
                                  <SelectItem value="contain">Contain (fit inside)</SelectItem>
                                  <SelectItem value="stretch">Stretch (may distort)</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {imageFit === "cover" && "Image fills the entire frame, may crop edges"}
                                {imageFit === "contain" && "Image fits inside frame, may show borders"}
                                {imageFit === "stretch" && "Image stretches to fill frame, may distort"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed rounded-md p-6 text-center hover-elevate cursor-pointer">
                            <input
                              type="file"
                              id="background-upload"
                              className="hidden"
                              accept="image/*"
                              onChange={handleBackgroundImageUpload}
                              data-testid="input-background-image"
                            />
                            <label htmlFor="background-upload" className="cursor-pointer flex flex-col items-center gap-2">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm font-medium">Upload Background Image</p>
                              <p className="text-xs text-muted-foreground">
                                Click to upload an image for the QR code background
                              </p>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 p-4 border rounded-md">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="canvas-fill-enabled"
                            checked={canvasFillEnabled}
                            onChange={(e) => setCanvasFillEnabled(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid="checkbox-canvas-fill"
                          />
                          <FormLabel htmlFor="canvas-fill-enabled" className="cursor-pointer">
                            Fill background outside shape
                          </FormLabel>
                        </div>
                        {canvasFillEnabled && (
                          <div className="space-y-2">
                            <FormLabel htmlFor="canvas-fill-color">Fill Color</FormLabel>
                            <div className="flex gap-2">
                              <input
                                id="canvas-fill-color"
                                type="color"
                                value={canvasFillColor}
                                onChange={(e) => setCanvasFillColor(e.target.value)}
                                className="h-10 w-20 rounded-md border cursor-pointer"
                                data-testid="input-canvas-fill-color"
                              />
                              <Input
                                type="text"
                                value={canvasFillColor}
                                onChange={(e) => setCanvasFillColor(e.target.value)}
                                className="flex-1"
                                data-testid="input-canvas-fill-color-text"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Fill the canvas background outside the shaped border
                            </p>
                          </div>
                        )}
                      </div>

                      {!backgroundImage && (
                        <div className="space-y-2">
                          <FormLabel htmlFor="border-color">Border Color</FormLabel>
                          <input
                            id="border-color"
                            type="color"
                            value={borderColor}
                            onChange={(e) => setBorderColor(e.target.value)}
                            className="h-10 w-full rounded-md border cursor-pointer"
                            data-testid="input-border-color"
                          />
                          <p className="text-xs text-muted-foreground">
                            Border color is used when no background image is uploaded
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={!isValidUrl(url) || !qrImageUrl || createQRMutation.isPending}
                  data-testid="button-create-qr"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {createQRMutation.isPending ? "Creating..." : "Create QR Code"}
                </Button>
              </form>
            </Form>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Preview</h3>
              
              <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-square relative overflow-hidden">
                {backgroundImage && backgroundImageType === "image/gif" && url ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Animated GIF Background */}
                    <img
                      src={backgroundImage}
                      alt="Animated Background"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ imageRendering: 'auto' }}
                    />
                    {/* QR Code Overlay - transparent PNG with QR and branding */}
                    {qrOverlayUrl && (
                      <img
                        src={qrOverlayUrl}
                        alt="QR Code"
                        className="relative z-10 w-full h-full"
                        data-testid="img-qr-overlay"
                      />
                    )}
                    {/* Animated GIF Badge */}
                    <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 z-20">
                      <ImageIcon className="h-3 w-3" />
                      Animated GIF
                    </div>
                  </div>
                ) : qrImageUrl ? (
                  <img
                    src={qrImageUrl}
                    alt="QR Code Preview"
                    className="max-w-full max-h-full"
                    data-testid="img-qr-preview"
                  />
                ) : (
                  <p className="text-muted-foreground text-center">
                    Enter a URL to see your QR code
                  </p>
                )}
              </div>

              {qrImageUrl && (
                <div className="space-y-4">
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadQR}
                    data-testid="button-download-qr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                  
                  {form.watch("title") && (
                    <div>
                      <p className="text-sm text-muted-foreground">Title</p>
                      <p className="font-medium" data-testid="text-title-preview">
                        {form.watch("title")}
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
              )}
            </div>
          </Card>
        </div>

        {!user && (
          <Card className="p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground text-center">
              Log in to create and manage your QR codes
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
