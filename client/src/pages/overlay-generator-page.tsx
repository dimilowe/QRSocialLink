import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PLATFORM_PRESETS } from "@shared/schema";
import { Sparkles, Download, Eye, Video, Square, Trash2, Edit } from "lucide-react";
import type { Scan, Frame, InsertOverlayRendition, OverlayRendition } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OverlayGeneratorPage() {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("tiktok");
  const [selectedQR, setSelectedQR] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [ctaText, setCtaText] = useState<string>("Scan to Shop");
  const [borderRadius, setBorderRadius] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [overlayToDelete, setOverlayToDelete] = useState<string | null>(null);
  
  const [textFont, setTextFont] = useState<string>("Inter");
  const [textSize, setTextSize] = useState<number>(42);
  const [textColor, setTextColor] = useState<string>("#FFFFFF");
  const [qrSizeModifier, setQrSizeModifier] = useState<number>(100);
  const [qrOffsetPercent, setQrOffsetPercent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [qrOffsetPx, setQrOffsetPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [qrXOffset, setQrXOffset] = useState<number>(0);
  const [qrYOffset, setQrYOffset] = useState<number>(0);
  const [overlayColor, setOverlayColor] = useState<string>("#9333EA");
  const [overlayBackgroundImage, setOverlayBackgroundImage] = useState<string>("");
  const [overlayImageFit, setOverlayImageFit] = useState<"cover" | "contain" | "stretch">("cover");
  const [overlayWidth, setOverlayWidth] = useState<number>(1080);
  const [overlayHeight, setOverlayHeight] = useState<number>(400);
  
  const [qrBounds, setQrBounds] = useState<{x: number, y: number, size: number} | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isQrSelected, setIsQrSelected] = useState<boolean>(false);
  const [resizeData, setResizeData] = useState<{
    anchorX: number;
    anchorY: number;
    initialSize: number;
    initialXOffset: number;
    initialYOffset: number;
    initialSizeModifier: number;
    scaledQR: any;
  } | null>(null);
  
  const [isBannerSelected, setIsBannerSelected] = useState<boolean>(false);
  const [isBannerResizing, setIsBannerResizing] = useState<boolean>(false);
  const [bannerResizeHandle, setBannerResizeHandle] = useState<string | null>(null);
  const [bannerResizeData, setBannerResizeData] = useState<{
    initialWidth: number;
    initialHeight: number;
    initialMouseX: number;
    initialMouseY: number;
    initialDisplayWidth: number;
    initialDisplayHeight: number;
  } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const overlayImageInputRef = useRef<HTMLInputElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);

  const { data: scans } = useQuery<Scan[]>({
    queryKey: ["/api/scans"],
  });

  const { data: templates } = useQuery<Frame[]>({
    queryKey: ["/api/overlay-templates"],
  });

  const { data: overlays } = useQuery<OverlayRendition[]>({
    queryKey: ["/api/overlays"],
    refetchInterval: (query) => {
      // Auto-refresh every 500ms if any overlay is queued or rendering  
      const hasProcessing = query.state.data?.some((o: OverlayRendition) => o.status === "queued" || o.status === "rendering");
      return hasProcessing ? 500 : false;
    },
  });

  const latestOverlay = overlays?.[0];

  const generateOverlayMutation = useMutation({
    mutationFn: async (data: InsertOverlayRendition) => {
      const response = await apiRequest("POST", "/api/overlays/generate", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overlays"] });
      toast({
        title: "Generating Overlay",
        description: "Your overlay is being generated. This usually takes just a few seconds...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to queue overlay for rendering. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteOverlayMutation = useMutation({
    mutationFn: async (overlayId: string) => {
      const response = await apiRequest("DELETE", `/api/overlays/${overlayId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overlays"] });
      setDeleteDialogOpen(false);
      setOverlayToDelete(null);
      toast({
        title: "Overlay Deleted",
        description: "Your overlay has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete overlay. Please try again.",
        variant: "destructive",
      });
    },
  });

  const platformConfig = Object.values(PLATFORM_PRESETS).find(
    (p) => p.id === selectedPlatform
  );

  const loadOverlayForEdit = (overlay: OverlayRendition) => {
    setSelectedQR(overlay.scanId);
    setSelectedTemplate(overlay.frameId);
    setCtaText(overlay.ctaText || "Scan to Shop");
    setSelectedPlatform(overlay.aspect || "tiktok");
    
    if (overlay.renderConfig && typeof overlay.renderConfig === 'object') {
      const config = overlay.renderConfig as any;
      if (config.textFont) setTextFont(config.textFont);
      if (config.textSize !== undefined) setTextSize(config.textSize);
      if (config.textColor) setTextColor(config.textColor);
      if (config.qrSizeModifier !== undefined) setQrSizeModifier(config.qrSizeModifier);
      if (config.qrXOffset !== undefined || config.qrYOffset !== undefined) {
        const xOffset = config.qrXOffset ?? 0;
        const yOffset = config.qrYOffset ?? 0;
        setTimeout(() => updateQrOffset({ px: { x: xOffset, y: yOffset } }), 100);
      }
      if (config.overlayColor) setOverlayColor(config.overlayColor);
      if (config.overlayBackgroundImage) setOverlayBackgroundImage(config.overlayBackgroundImage);
      if (config.overlayImageFit) setOverlayImageFit(config.overlayImageFit);
      if (config.overlayWidth !== undefined) setOverlayWidth(config.overlayWidth);
      if (config.overlayHeight !== undefined) setOverlayHeight(config.overlayHeight);
      if (config.borderRadius !== undefined) setBorderRadius(config.borderRadius);
    }
    
    toast({
      title: "Overlay Loaded",
      description: "Overlay configuration loaded into editor. Click 'Generate Overlay' to create a new version.",
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  useEffect(() => {
    if (!selectedFrame || !platformConfig) {
      setQrOffsetPx({ x: 0, y: 0 });
      setQrXOffset(0);
      setQrYOffset(0);
      return;
    }

    try {
      const templateData = JSON.parse(selectedFrame.srcPath);
      const safeArea = JSON.parse(selectedFrame.safeArea);
      const bannerDimensions = templateData.position.startsWith("banner-") ? {
        width: overlayWidth,
        height: overlayHeight
      } : null;

      const { scaledOverlay } = scaleOverlayForPlatform(templateData, safeArea, platformConfig, bannerDimensions);
      
      const overlayWidthForCalc = scaledOverlay.width || platformConfig.width;
      const overlayHeightForCalc = scaledOverlay.height || platformConfig.height;
      
      const pixelX = qrOffsetPercent.x * overlayWidthForCalc;
      const pixelY = qrOffsetPercent.y * overlayHeightForCalc;
      
      setQrOffsetPx({ x: pixelX, y: pixelY });
      setQrXOffset(pixelX);
      setQrYOffset(pixelY);
    } catch (e) {
      console.error("Failed to recalculate QR offsets:", e);
    }
  }, [selectedFrame, platformConfig, qrOffsetPercent, overlayWidth, overlayHeight]);

  const updateQrOffset = (params: { px?: { x: number; y: number }; percent?: { x: number; y: number } }) => {
    if (!selectedFrame || !platformConfig) return;
    
    try {
      const templateData = JSON.parse(selectedFrame.srcPath);
      const safeArea = JSON.parse(selectedFrame.safeArea);
      const bannerDimensions = templateData.position.startsWith("banner-") ? {
        width: overlayWidth,
        height: overlayHeight
      } : null;
      
      const { scaledOverlay } = scaleOverlayForPlatform(templateData, safeArea, platformConfig, bannerDimensions);
      const overlayWidthForCalc = scaledOverlay.width || platformConfig.width;
      const overlayHeightForCalc = scaledOverlay.height || platformConfig.height;
      
      let pixelOffset: { x: number; y: number };
      let percentOffset: { x: number; y: number };
      
      if (params.px) {
        pixelOffset = params.px;
        percentOffset = {
          x: pixelOffset.x / (overlayWidthForCalc || 1),
          y: pixelOffset.y / (overlayHeightForCalc || 1)
        };
      } else if (params.percent) {
        percentOffset = params.percent;
        pixelOffset = {
          x: percentOffset.x * overlayWidthForCalc,
          y: percentOffset.y * overlayHeightForCalc
        };
      } else {
        return;
      }
      
      setQrOffsetPercent(percentOffset);
      setQrOffsetPx(pixelOffset);
      setQrXOffset(pixelOffset.x);
      setQrYOffset(pixelOffset.y);
    } catch (e) {
      console.error("Failed to update QR offset:", e);
    }
  };

  const scaleOverlayForPlatform = (templateData: any, safeArea: any, platformConfig: any, bannerDimensions?: {width: number, height: number} | null) => {
    const BASE_WIDTH = 1080;
    const BASE_HEIGHT = 1920;
    
    const scaleX = platformConfig.width / BASE_WIDTH;
    const scaleY = platformConfig.height / BASE_HEIGHT;
    
    const position = templateData.position;
    const isHorizontal = platformConfig.width > platformConfig.height;
    
    let scaledOverlay = { ...templateData.overlay };
    let scaledQR = { ...safeArea.qr };
    let scaledCTA = { ...safeArea.cta };
    
    if (position === "banner-top" || position === "banner-bottom") {
      const baseScaledHeight = isHorizontal ? 200 : Math.round(templateData.overlay.height * scaleY);
      const effectiveWidth = Math.min(platformConfig.width, bannerDimensions?.width ?? platformConfig.width);
      const effectiveHeight = Math.min(platformConfig.height, bannerDimensions?.height ?? baseScaledHeight);
      const offsetX = Math.max(0, Math.round((platformConfig.width - effectiveWidth) / 2));
      
      const qrRatio = effectiveHeight / baseScaledHeight;
      const widthRatio = effectiveWidth / platformConfig.width;
      
      scaledOverlay.x = offsetX;
      scaledOverlay.width = effectiveWidth;
      scaledOverlay.height = effectiveHeight;
      
      if (position === "banner-top") {
        scaledOverlay.y = platformConfig.safeZone?.top ?? 0;
      } else {
        scaledOverlay.y = platformConfig.height - effectiveHeight - (platformConfig.safeZone?.bottom ?? 0);
      }
      
      const leftMargin = Math.round(40 * widthRatio);
      const rightMargin = Math.round(40 * widthRatio);
      const qrCtaGap = Math.round(30 * widthRatio);
      
      const baseQrSize = isHorizontal ? 140 : Math.round(safeArea.qr.size * scaleY);
      let idealQrSize = Math.round(Math.max(80, baseQrSize * qrRatio));
      
      const maxAvailableQrWidth = effectiveWidth - leftMargin - rightMargin - qrCtaGap - 50;
      let qrSize = Math.min(idealQrSize, maxAvailableQrWidth);
      qrSize = Math.max(40, qrSize);
      
      if (qrSize > effectiveWidth * 0.7) {
        qrSize = Math.round(effectiveWidth * 0.5);
      }
      
      scaledQR.size = Math.min(qrSize, effectiveWidth - leftMargin - rightMargin);
      scaledQR.x = offsetX + leftMargin;
      scaledQR.y = scaledOverlay.y + Math.round((isHorizontal ? 50 : 40) * qrRatio);
      
      const idealCtaX = scaledQR.x + scaledQR.size + qrCtaGap;
      const maxCtaRight = offsetX + effectiveWidth - rightMargin;
      const minCtaX = offsetX + leftMargin;
      
      scaledCTA.x = Math.max(minCtaX, Math.min(idealCtaX, maxCtaRight));
      scaledCTA.y = scaledQR.y;
      const availableCtaWidth = Math.max(0, maxCtaRight - scaledCTA.x);
      scaledCTA.width = Math.min(800, availableCtaWidth);
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

        const bannerDimensions = templateData.position.startsWith("banner-") ? {
          width: overlayWidth,
          height: overlayHeight
        } : null;
        
        const { scaledOverlay, scaledQR, scaledCTA } = scaleOverlayForPlatform(templateData, safeArea, platformConfig, bannerDimensions);
        const effectiveBorderRadius = borderRadius >= 0 ? borderRadius : templateData.overlay.borderRadius;
        
        ctx.save();
        
        ctx.beginPath();
        if (effectiveBorderRadius > 0) {
          ctx.roundRect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height, effectiveBorderRadius);
        } else {
          ctx.rect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height);
        }
        ctx.clip();
        
        if (overlayBackgroundImage) {
          try {
            const bgImage = new Image();
            await new Promise((resolve, reject) => {
              bgImage.onload = resolve;
              bgImage.onerror = reject;
              bgImage.src = overlayBackgroundImage;
            });

            ctx.fillStyle = overlayColor;
            ctx.fillRect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height);

            let drawX = scaledOverlay.x;
            let drawY = scaledOverlay.y;
            let drawWidth = scaledOverlay.width;
            let drawHeight = scaledOverlay.height;

            if (overlayImageFit === "cover") {
              const imgAspect = bgImage.width / bgImage.height;
              const overlayAspect = scaledOverlay.width / scaledOverlay.height;

              if (imgAspect > overlayAspect) {
                drawWidth = scaledOverlay.height * imgAspect;
                drawHeight = scaledOverlay.height;
                drawX = scaledOverlay.x - (drawWidth - scaledOverlay.width) / 2;
              } else {
                drawWidth = scaledOverlay.width;
                drawHeight = scaledOverlay.width / imgAspect;
                drawY = scaledOverlay.y - (drawHeight - scaledOverlay.height) / 2;
              }
            } else if (overlayImageFit === "contain") {
              const imgAspect = bgImage.width / bgImage.height;
              const overlayAspect = scaledOverlay.width / scaledOverlay.height;

              if (imgAspect > overlayAspect) {
                drawWidth = scaledOverlay.width;
                drawHeight = scaledOverlay.width / imgAspect;
                drawY = scaledOverlay.y + (scaledOverlay.height - drawHeight) / 2;
              } else {
                drawWidth = scaledOverlay.height * imgAspect;
                drawHeight = scaledOverlay.height;
                drawX = scaledOverlay.x + (scaledOverlay.width - drawWidth) / 2;
              }
            }

            ctx.drawImage(bgImage, drawX, drawY, drawWidth, drawHeight);
          } catch (error) {
            console.error("Failed to load overlay background image:", error);
            toast({
              title: "Image Load Failed",
              description: "Failed to load the overlay background image. Using color fallback.",
              variant: "destructive",
            });
            ctx.fillStyle = overlayColor;
            ctx.fillRect(scaledOverlay.x, scaledOverlay.y, scaledOverlay.width, scaledOverlay.height);
          }
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
      textFont, textSize, textColor, qrSizeModifier, qrXOffset, qrYOffset, overlayColor,
      overlayBackgroundImage, overlayImageFit, overlayWidth, overlayHeight]);

  const handleOverlayImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setOverlayBackgroundImage(result);
        if (overlayImageInputRef.current) {
          overlayImageInputRef.current.value = "";
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const getScaleFactor = () => {
    if (!previewImageRef.current || !platformConfig) return 1;
    const displayWidth = previewImageRef.current.offsetWidth;
    const canvasWidth = platformConfig.width;
    return displayWidth / canvasWidth;
  };

  const getOverlayBounds = () => {
    if (!previewImageRef.current || !platformConfig || !isBannerTemplate) return null;
    
    const scaleFactor = getScaleFactor();
    const effectiveWidth = Math.min(platformConfig.width, overlayWidth);
    const effectiveHeight = Math.min(platformConfig.height, overlayHeight);
    const offsetX = Math.max(0, Math.round((platformConfig.width - effectiveWidth) / 2));
    
    let overlayY = 0;
    if (selectedFramePosition === "banner-top") {
      overlayY = platformConfig.safeZone?.top ?? 0;
    } else {
      overlayY = platformConfig.height - effectiveHeight - (platformConfig.safeZone?.bottom ?? 0);
    }
    
    return {
      x: offsetX * scaleFactor,
      y: overlayY * scaleFactor,
      width: effectiveWidth * scaleFactor,
      height: effectiveHeight * scaleFactor
    };
  };

  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    if (!previewImageRef.current) return;
    
    const rect = previewImageRef.current.getBoundingClientRect();
    const scaleFactor = getScaleFactor();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const canvasX = clickX / scaleFactor;
    const canvasY = clickY / scaleFactor;
    
    // Priority 1: Check if clicking on QR code
    if (qrBounds) {
      const isInQr = 
        canvasX >= qrBounds.x &&
        canvasX <= qrBounds.x + qrBounds.size &&
        canvasY >= qrBounds.y &&
        canvasY <= qrBounds.y + qrBounds.size;
      
      if (isInQr) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setIsQrSelected(true);
        setIsBannerSelected(false);
        setDragStart({
          x: canvasX - qrBounds.x,
          y: canvasY - qrBounds.y
        });
        return;
      }
    }
    
    // Priority 2: Check if clicking on banner overlay (banner templates only)
    if (isBannerTemplate && platformConfig) {
      const effectiveWidth = Math.min(platformConfig.width, overlayWidth);
      const effectiveHeight = Math.min(platformConfig.height, overlayHeight);
      const offsetX = Math.max(0, Math.round((platformConfig.width - effectiveWidth) / 2));
      
      let overlayY = 0;
      if (selectedFramePosition === "banner-top") {
        overlayY = platformConfig.safeZone?.top ?? 0;
      } else {
        overlayY = platformConfig.height - effectiveHeight - (platformConfig.safeZone?.bottom ?? 0);
      }
      
      const isInOverlay = 
        canvasX >= offsetX &&
        canvasX <= offsetX + effectiveWidth &&
        canvasY >= overlayY &&
        canvasY <= overlayY + effectiveHeight;
      
      if (isInOverlay) {
        e.preventDefault();
        e.stopPropagation();
        setIsBannerSelected(true);
        setIsQrSelected(false);
        return;
      }
    }
    
    // Priority 3: Clicked elsewhere, deselect everything
    setIsBannerSelected(false);
    setIsQrSelected(false);
  };

  const handleQrPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart || !qrBounds || !previewImageRef.current || !platformConfig) return;
    
    e.preventDefault();
    
    requestAnimationFrame(() => {
      const rect = previewImageRef.current!.getBoundingClientRect();
      const scaleFactor = getScaleFactor();
      
      const canvasX = (e.clientX - rect.left) / scaleFactor;
      const canvasY = (e.clientY - rect.top) / scaleFactor;
      
      const templateData = selectedFrame ? JSON.parse(selectedFrame.srcPath) : null;
      const safeArea = selectedFrame ? JSON.parse(selectedFrame.safeArea) : null;
      
      if (!templateData || !safeArea) return;
      
      const bannerDimensions = templateData.position.startsWith("banner-") ? {
        width: overlayWidth,
        height: overlayHeight
      } : null;
      
      const { scaledQR } = scaleOverlayForPlatform(templateData, safeArea, platformConfig, bannerDimensions);
      
      const newX = canvasX - dragStart.x;
      const newY = canvasY - dragStart.y;
      
      const deltaX = newX - scaledQR.x;
      const deltaY = newY - scaledQR.y;
      
      updateQrOffset({ px: { x: deltaX, y: deltaY } });
    });
  };

  const handleQrPointerUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleResizePointerDown = (e: React.PointerEvent, handle: string) => {
    if (!qrBounds || !selectedFrame || !platformConfig) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const templateData = JSON.parse(selectedFrame.srcPath);
    const safeArea = JSON.parse(selectedFrame.safeArea);
    
    const bannerDimensions = templateData.position.startsWith("banner-") ? {
      width: overlayWidth,
      height: overlayHeight
    } : null;
    
    const { scaledQR } = scaleOverlayForPlatform(templateData, safeArea, platformConfig, bannerDimensions);
    
    let anchorX: number, anchorY: number;
    
    switch (handle) {
      case "nw":
        anchorX = qrBounds.x + qrBounds.size;
        anchorY = qrBounds.y + qrBounds.size;
        break;
      case "ne":
        anchorX = qrBounds.x;
        anchorY = qrBounds.y + qrBounds.size;
        break;
      case "sw":
        anchorX = qrBounds.x + qrBounds.size;
        anchorY = qrBounds.y;
        break;
      case "se":
      default:
        anchorX = qrBounds.x;
        anchorY = qrBounds.y;
        break;
    }
    
    setIsResizing(true);
    setResizeHandle(handle);
    setIsQrSelected(true);
    setResizeData({
      anchorX,
      anchorY,
      initialSize: qrBounds.size,
      initialXOffset: qrXOffset,
      initialYOffset: qrYOffset,
      initialSizeModifier: qrSizeModifier,
      scaledQR
    });
    
    const rect = previewImageRef.current!.getBoundingClientRect();
    const scaleFactor = getScaleFactor();
    
    setDragStart({
      x: (e.clientX - rect.left) / scaleFactor,
      y: (e.clientY - rect.top) / scaleFactor
    });
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeData || !previewImageRef.current || !resizeHandle) return;
    
    e.preventDefault();
    
    requestAnimationFrame(() => {
      const rect = previewImageRef.current!.getBoundingClientRect();
      const scaleFactor = getScaleFactor();
      
      const canvasX = (e.clientX - rect.left) / scaleFactor;
      const canvasY = (e.clientY - rect.top) / scaleFactor;
      
      const { anchorX, anchorY, initialSize, initialSizeModifier, scaledQR } = resizeData;
      
      const newWidth = Math.abs(canvasX - anchorX);
      const newHeight = Math.abs(canvasY - anchorY);
      const newDiagonal = Math.sqrt(newWidth * newWidth + newHeight * newHeight);
      
      const initialDiagonal = initialSize * Math.SQRT2;
      
      const sizeRatio = newDiagonal / initialDiagonal;
      const newSizeModifier = Math.max(50, Math.min(150, initialSizeModifier * sizeRatio));
      
      const actualNewSize = scaledQR.size * (newSizeModifier / 100);
      
      let newQrX: number, newQrY: number;
      
      switch (resizeHandle) {
        case "nw":
          newQrX = anchorX - actualNewSize;
          newQrY = anchorY - actualNewSize;
          break;
        case "ne":
          newQrX = anchorX;
          newQrY = anchorY - actualNewSize;
          break;
        case "sw":
          newQrX = anchorX - actualNewSize;
          newQrY = anchorY;
          break;
        case "se":
        default:
          newQrX = anchorX;
          newQrY = anchorY;
          break;
      }
      
      const newXOffset = newQrX - scaledQR.x;
      const newYOffset = newQrY - scaledQR.y;
      
      setQrSizeModifier(newSizeModifier);
      updateQrOffset({ px: { x: newXOffset, y: newYOffset } });
    });
  };

  const handleResizePointerUp = () => {
    setIsResizing(false);
    setResizeHandle(null);
    setDragStart(null);
    setResizeData(null);
  };

  const selectedFramePosition = useMemo(() => {
    if (!selectedFrame) return null;
    try {
      const templateData = JSON.parse(selectedFrame.srcPath);
      return templateData.position || null;
    } catch {
      return null;
    }
  }, [selectedFrame]);

  const isBannerTemplate = useMemo(() => {
    return selectedFramePosition !== null && selectedFramePosition.startsWith("banner-");
  }, [selectedFramePosition]);

  const handleBannerResizePointerDown = (e: React.PointerEvent, handle: string) => {
    if (!isBannerTemplate || !previewImageRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsBannerResizing(true);
    setBannerResizeHandle(handle);
    setIsBannerSelected(true);
    setIsQrSelected(false);
    
    setBannerResizeData({
      initialWidth: overlayWidth,
      initialHeight: overlayHeight,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialDisplayWidth: previewImageRef.current.offsetWidth,
      initialDisplayHeight: previewImageRef.current.offsetHeight
    });
  };

  const handleBannerResizePointerMove = (e: React.PointerEvent) => {
    if (!isBannerResizing || !bannerResizeData || !bannerResizeHandle) return;
    
    e.preventDefault();
    
    requestAnimationFrame(() => {
      const deltaX = e.clientX - bannerResizeData.initialMouseX;
      const deltaY = e.clientY - bannerResizeData.initialMouseY;
      
      const scaleX = bannerResizeData.initialDisplayWidth / bannerResizeData.initialWidth;
      const scaleY = bannerResizeData.initialDisplayHeight / bannerResizeData.initialHeight;
      
      const actualDeltaX = deltaX / scaleX;
      const actualDeltaY = deltaY / scaleY;
      
      let newWidth = bannerResizeData.initialWidth;
      let newHeight = bannerResizeData.initialHeight;
      
      switch (bannerResizeHandle) {
        case "nw":
          newWidth = bannerResizeData.initialWidth - actualDeltaX;
          newHeight = bannerResizeData.initialHeight - actualDeltaY;
          break;
        case "ne":
          newWidth = bannerResizeData.initialWidth + actualDeltaX;
          newHeight = bannerResizeData.initialHeight - actualDeltaY;
          break;
        case "sw":
          newWidth = bannerResizeData.initialWidth - actualDeltaX;
          newHeight = bannerResizeData.initialHeight + actualDeltaY;
          break;
        case "se":
          newWidth = bannerResizeData.initialWidth + actualDeltaX;
          newHeight = bannerResizeData.initialHeight + actualDeltaY;
          break;
        case "top":
          newHeight = bannerResizeData.initialHeight - actualDeltaY;
          break;
        case "bottom":
          newHeight = bannerResizeData.initialHeight + actualDeltaY;
          break;
        case "left":
          newWidth = bannerResizeData.initialWidth - actualDeltaX;
          break;
        case "right":
          newWidth = bannerResizeData.initialWidth + actualDeltaX;
          break;
      }
      
      newWidth = Math.max(300, Math.min(1920, Math.round(newWidth)));
      newHeight = Math.max(100, Math.min(1920, Math.round(newHeight)));
      
      setOverlayWidth(newWidth);
      setOverlayHeight(newHeight);
    });
  };

  const handleBannerResizePointerUp = () => {
    setIsBannerResizing(false);
    setBannerResizeHandle(null);
    setBannerResizeData(null);
  };

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
                    <Label>Overlay Background</Label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={overlayColor}
                          onChange={(e) => setOverlayColor(e.target.value)}
                          className="w-20 h-10 p-1 cursor-pointer"
                          data-testid="input-overlay-color"
                          disabled={!!overlayBackgroundImage}
                        />
                        <Input
                          type="text"
                          value={overlayColor}
                          onChange={(e) => setOverlayColor(e.target.value)}
                          className="flex-1"
                          placeholder="#9333EA"
                          data-testid="input-overlay-color-text"
                          disabled={!!overlayBackgroundImage}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          ref={overlayImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleOverlayImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => overlayImageInputRef.current?.click()}
                          className="flex-1"
                          data-testid="button-upload-overlay-image"
                        >
                          {overlayBackgroundImage ? "Change Image" : "Upload Image"}
                        </Button>
                        {overlayBackgroundImage && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOverlayBackgroundImage("")}
                            data-testid="button-remove-overlay-image"
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      {overlayBackgroundImage && (
                        <div className="space-y-2">
                          <Label htmlFor="overlay-fit">Image Fit</Label>
                          <Select value={overlayImageFit} onValueChange={(value) => setOverlayImageFit(value as "cover" | "contain" | "stretch")}>
                            <SelectTrigger id="overlay-fit" data-testid="select-overlay-fit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cover">Cover (fill frame)</SelectItem>
                              <SelectItem value="contain">Contain (fit inside)</SelectItem>
                              <SelectItem value="stretch">Stretch (may distort)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
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
                    <div className="space-y-1 mb-3">
                      <h4 className="font-semibold text-sm">Banner Dimensions</h4>
                      <p className="text-xs text-muted-foreground">Customize banner overlay size (applies to Banner templates only)</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="overlay-width">Width (px)</Label>
                          <Input
                            id="overlay-width"
                            type="number"
                            min={300}
                            max={1920}
                            value={overlayWidth}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (value >= 300 && value <= 1920) {
                                setOverlayWidth(value);
                              } else if (value < 300) {
                                setOverlayWidth(300);
                              } else if (value > 1920) {
                                setOverlayWidth(1920);
                              }
                            }}
                            data-testid="input-overlay-width"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="overlay-height">Height (px)</Label>
                          <Input
                            id="overlay-height"
                            type="number"
                            min={100}
                            max={1920}
                            value={overlayHeight}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (value >= 100 && value <= 1920) {
                                setOverlayHeight(value);
                              } else if (value < 100) {
                                setOverlayHeight(100);
                              } else if (value > 1920) {
                                setOverlayHeight(1920);
                              }
                            }}
                            data-testid="input-overlay-height"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setOverlayWidth(1080); setOverlayHeight(400); }}
                          data-testid="button-size-banner"
                        >
                          Banner (1080x400)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setOverlayWidth(1080); setOverlayHeight(600); }}
                          data-testid="button-size-tall"
                        >
                          Tall (1080x600)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setOverlayWidth(1080); setOverlayHeight(1080); }}
                          data-testid="button-size-square"
                        >
                          Square (1080x1080)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setOverlayWidth(1080); setOverlayHeight(1920); }}
                          data-testid="button-size-fullscreen"
                        >
                          Full (1080x1920)
                        </Button>
                      </div>
                    </div>
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
                          onValueChange={(value) => updateQrOffset({ px: { x: value[0], y: qrYOffset } })}
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
                          onValueChange={(value) => updateQrOffset({ px: { x: qrXOffset, y: value[0] } })}
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
                      setOverlayBackgroundImage("");
                      setOverlayImageFit("cover");
                      setOverlayWidth(1080);
                      setOverlayHeight(400);
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
                  {isBannerTemplate 
                    ? "Click the purple banner to select it and show resize handles. Click the QR code to drag it around."
                    : "Click the QR code to select it and show corner handles, then drag to move or use handles to resize"}
                </CardDescription>
                {previewUrl && !isQrSelected && !isBannerSelected && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/30">
                    <p className="text-xs text-muted-foreground">
                      💡 Tip: Click on the {isBannerTemplate ? "purple banner or QR code" : "QR code"} in the preview to select it first
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <canvas ref={canvasRef} className="hidden" />
                <div className="bg-muted/50 rounded-lg overflow-hidden p-4">
                  {previewUrl ? (
                    <div 
                      className="flex justify-center relative"
                      ref={previewContainerRef}
                      onPointerDown={handlePreviewPointerDown}
                      onPointerMove={
                        isDragging ? handleQrPointerMove : 
                        isResizing ? handleResizePointerMove : 
                        isBannerResizing ? handleBannerResizePointerMove :
                        undefined
                      }
                      onPointerUp={
                        isDragging ? handleQrPointerUp : 
                        isResizing ? handleResizePointerUp :
                        isBannerResizing ? handleBannerResizePointerUp :
                        undefined
                      }
                      style={{ touchAction: "none" }}
                    >
                      <div className="relative">
                        <div className="relative">
                          <img
                            ref={previewImageRef}
                            src={previewUrl}
                            alt="Overlay preview"
                            className="max-h-[600px] w-auto rounded-lg shadow-lg select-none border-2 border-border/50"
                            style={{
                              aspectRatio: platformConfig?.aspectRatio || "9/16",
                              pointerEvents: "none"
                            }}
                            data-testid="img-preview"
                          />
                          
                          {isBannerTemplate && isBannerSelected && (() => {
                            const overlayBounds = getOverlayBounds();
                            if (!overlayBounds) return null;
                            
                            return (
                              <>
                                <div
                                  className="absolute border-2 border-dashed border-primary pointer-events-none"
                                  style={{
                                    left: `${overlayBounds.x}px`,
                                    top: `${overlayBounds.y}px`,
                                    width: `${overlayBounds.width}px`,
                                    height: `${overlayBounds.height}px`,
                                  }}
                                />
                                
                                <div
                                  className="absolute w-4 h-4 bg-primary rounded-full cursor-nwse-resize border-2 border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x - 8}px`,
                                    top: `${overlayBounds.y - 8}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "nw")}
                                  data-testid="banner-handle-nw"
                                />
                                <div
                                  className="absolute w-4 h-4 bg-primary rounded-full cursor-nesw-resize border-2 border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x + overlayBounds.width - 8}px`,
                                    top: `${overlayBounds.y - 8}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "ne")}
                                  data-testid="banner-handle-ne"
                                />
                                <div
                                  className="absolute w-4 h-4 bg-primary rounded-full cursor-nesw-resize border-2 border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x - 8}px`,
                                    top: `${overlayBounds.y + overlayBounds.height - 8}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "sw")}
                                  data-testid="banner-handle-sw"
                                />
                                <div
                                  className="absolute w-4 h-4 bg-primary rounded-full cursor-nwse-resize border-2 border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x + overlayBounds.width - 8}px`,
                                    top: `${overlayBounds.y + overlayBounds.height - 8}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "se")}
                                  data-testid="banner-handle-se"
                                />
                                
                                <div
                                  className="absolute h-2 bg-primary/50 cursor-ns-resize w-16 rounded-full border border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x + overlayBounds.width / 2 - 32}px`,
                                    top: `${overlayBounds.y - 4}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "top")}
                                  data-testid="banner-handle-top"
                                />
                                <div
                                  className="absolute h-2 bg-primary/50 cursor-ns-resize w-16 rounded-full border border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x + overlayBounds.width / 2 - 32}px`,
                                    top: `${overlayBounds.y + overlayBounds.height - 4}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "bottom")}
                                  data-testid="banner-handle-bottom"
                                />
                                <div
                                  className="absolute w-2 bg-primary/50 cursor-ew-resize h-16 rounded-full border border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x - 4}px`,
                                    top: `${overlayBounds.y + overlayBounds.height / 2 - 32}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "left")}
                                  data-testid="banner-handle-left"
                                />
                                <div
                                  className="absolute w-2 bg-primary/50 cursor-ew-resize h-16 rounded-full border border-background pointer-events-auto"
                                  style={{
                                    left: `${overlayBounds.x + overlayBounds.width - 4}px`,
                                    top: `${overlayBounds.y + overlayBounds.height / 2 - 32}px`,
                                  }}
                                  onPointerDown={(e) => handleBannerResizePointerDown(e, "right")}
                                  data-testid="banner-handle-right"
                                />
                              </>
                            );
                          })()}
                        </div>
                        {qrBounds && previewImageRef.current && (
                          <div
                            className={`absolute pointer-events-auto cursor-move transition-all border-2 border-dashed ${
                              isQrSelected 
                                ? "ring-2 ring-primary ring-offset-2 border-primary" 
                                : "border-primary/30 hover:border-primary hover:ring-2 hover:ring-primary/50"
                            }`}
                            style={{
                              left: `${(qrBounds.x / (platformConfig?.width || 1)) * previewImageRef.current.offsetWidth}px`,
                              top: `${(qrBounds.y / (platformConfig?.height || 1)) * previewImageRef.current.offsetHeight}px`,
                              width: `${(qrBounds.size / (platformConfig?.width || 1)) * previewImageRef.current.offsetWidth}px`,
                              height: `${(qrBounds.size / (platformConfig?.height || 1)) * previewImageRef.current.offsetHeight}px`,
                            }}
                            data-testid="overlay-qr-selection"
                          >
                            {isQrSelected && (
                              <>
                                <div
                                  className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -top-1.5 -left-1.5 border-2 border-background"
                                  onPointerDown={(e) => handleResizePointerDown(e, "nw")}
                                  data-testid="handle-nw"
                                />
                                <div
                                  className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -top-1.5 -right-1.5 border-2 border-background"
                                  onPointerDown={(e) => handleResizePointerDown(e, "ne")}
                                  data-testid="handle-ne"
                                />
                                <div
                                  className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -bottom-1.5 -left-1.5 border-2 border-background"
                                  onPointerDown={(e) => handleResizePointerDown(e, "sw")}
                                  data-testid="handle-sw"
                                />
                                <div
                                  className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -bottom-1.5 -right-1.5 border-2 border-background"
                                  onPointerDown={(e) => handleResizePointerDown(e, "se")}
                                  data-testid="handle-se"
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
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
                    disabled={!selectedQR || !selectedTemplate || generateOverlayMutation.isPending}
                    onClick={() => {
                      if (!selectedQR || !selectedTemplate || !platformConfig) return;
                      
                      generateOverlayMutation.mutate({
                        scanId: selectedQR,
                        frameId: selectedTemplate,
                        aspect: platformConfig.aspectRatio,
                        ctaText: ctaText || null,
                        renderConfig: {
                          textFont,
                          textSize,
                          textColor,
                          qrSizeModifier,
                          qrXOffset,
                          qrYOffset,
                          overlayColor,
                          overlayBackgroundImage,
                          overlayImageFit,
                          overlayWidth,
                          overlayHeight,
                          borderRadius,
                        },
                      });
                    }}
                    data-testid="button-generate"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {generateOverlayMutation.isPending ? "Generating..." : "Generate Overlay"}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={!latestOverlay || latestOverlay.status !== "completed"}
                    onClick={() => {
                      if (latestOverlay?.outputPath) {
                        window.open(latestOverlay.outputPath, '_blank');
                      }
                    }}
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {!latestOverlay ? "Generate First" : 
                     latestOverlay.status === "queued" ? "Queued..." :
                     latestOverlay.status === "rendering" ? "Rendering..." :
                     latestOverlay.status === "failed" ? "Failed" :
                     "Download Overlay"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {overlays && overlays.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>My Overlays</CardTitle>
                  <CardDescription>All your generated overlay frames</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {overlays.map((overlay) => {
                      const overlayFrame = templates?.find((t) => t.id === overlay.frameId);
                      const overlayScan = scans?.find((s) => s.id === overlay.scanId);
                      const templateData = overlayFrame ? JSON.parse(overlayFrame.srcPath) : null;
                      
                      return (
                        <Card key={overlay.id} className="overflow-hidden" data-testid={`card-overlay-${overlay.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm truncate">
                                  {templateData?.name || "Overlay"}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {overlay.aspect ? Object.values(PLATFORM_PRESETS).find(p => p.id === overlay.aspect)?.name : "Unknown"} • {new Date(overlay.createdAt).toLocaleDateString()}
                                </CardDescription>
                              </div>
                              <Badge 
                                variant={
                                  overlay.status === "completed" ? "default" :
                                  overlay.status === "failed" ? "destructive" :
                                  "secondary"
                                }
                                data-testid={`status-overlay-${overlay.id}`}
                              >
                                {overlay.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            {overlay.ctaText && (
                              <p className="text-xs text-muted-foreground mb-3 truncate">
                                CTA: "{overlay.ctaText}"
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                disabled={overlay.status !== "completed"}
                                onClick={() => {
                                  window.open(`/api/overlays/${overlay.id}/download`, '_blank');
                                }}
                                data-testid={`button-download-${overlay.id}`}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => loadOverlayForEdit(overlay)}
                                data-testid={`button-edit-${overlay.id}`}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOverlayToDelete(overlay.id);
                                  setDeleteDialogOpen(true);
                                }}
                                data-testid={`button-delete-${overlay.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-overlay">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Overlay?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this overlay frame. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (overlayToDelete) {
                  deleteOverlayMutation.mutate(overlayToDelete);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
