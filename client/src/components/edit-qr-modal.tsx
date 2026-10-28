import { QRDesignControls } from "@/components/qr-design-controls";
import { type ModuleStyle, type EyeStyle } from "@/lib/qr-design";
import { generateBrandedQR } from "@/lib/qr-generator";
import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Square, Circle, Star, Heart, Diamond, Camera, Download, Upload, X } from "lucide-react";
import { Scan } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface EditQRModalProps {
  scan: Scan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditQRModal({ scan, open, onOpenChange }: EditQRModalProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [moduleStyle, setModuleStyle] = useState<ModuleStyle>("rounded");
  const [eyeStyle, setEyeStyle] = useState<EyeStyle>("rounded");
  const [eyeColor, setEyeColor] = useState("#182333");
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [borderColor, setBorderColor] = useState("#8B5CF6");
  const [enableBranding, setEnableBranding] = useState(false);
  const [topText, setTopText] = useState("qrsocial.io");
  const [bottomText, setBottomText] = useState("Screenshot & Long-press");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [borderShape, setBorderShape] = useState<"square" | "circle" | "star" | "polaroid" | "diamond" | "heart">("square");
  const [imageFit, setImageFit] = useState<"cover" | "contain" | "stretch">("cover");
  const [polaroidText, setPolaroidText] = useState("");
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [canvasFillEnabled, setCanvasFillEnabled] = useState(false);
  const [canvasFillColor, setCanvasFillColor] = useState("#FFFFFF");
  const [originalScan, setOriginalScan] = useState<Scan | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedScanId = useRef<string | null>(null);
  const { toast } = useToast();
  const [enableABTesting, setEnableABTesting] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [savedSimpleUrl, setSavedSimpleUrl] = useState<string>("");
  
  const isFreeUser = user?.plan === 'free';

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user && open,
  });

  const campaignIdForDestinations = selectedCampaignId || scan?.campaignId;
  
  const { data: campaignDestinations } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignIdForDestinations, "destinations"],
    enabled: !!campaignIdForDestinations && open,
  });

  useEffect(() => {
    if (scan && open) {
      const needsReinit = initializedScanId.current !== scan.id;
      
      if (needsReinit) {
        initializedScanId.current = scan.id;
        setOriginalScan(scan);
        
        let initialUrl = "";
        if ((scan as any).destination) {
          initialUrl = (scan as any).destination;
        } else if (scan.redirectUrl) {
          initialUrl = scan.redirectUrl;
        } else if (scan.decodedUrl) {
          initialUrl = scan.decodedUrl;
        } else {
          initialUrl = "";
        }
        
        setUrl(initialUrl);
        setTitle(scan.title || "");
        setModuleStyle((scan.moduleStyle as ModuleStyle) || "square");
        setEyeStyle((scan.eyeStyle as EyeStyle) || "square");
        setEyeColor(scan.eyeColor || scan.foregroundColor || "#000000");
        setForegroundColor(scan.foregroundColor || "#000000");
        setBackgroundColor(scan.backgroundColor || "#FFFFFF");
        setBorderColor(scan.borderColor || "#8B5CF6");
        setEnableBranding(scan.enableBranding || false);
        setTopText(scan.topText || "qrsocial.io");
        setBottomText(scan.bottomText || "Screenshot & Long-press");
        setBackgroundImage(scan.backgroundImage || null);
        setBorderShape((scan.borderShape as any) || "square");
        setImageFit((scan.imageFitMode as any) || "cover");
        setPolaroidText(scan.polaroidText || "");
        setCanvasFillEnabled((scan as any).canvasFillEnabled || false);
        setCanvasFillColor((scan as any).canvasFillColor || "#FFFFFF");
        setQrPreviewUrl(scan.qrImageUrl || "");
        setEnableABTesting(!!scan.campaignId);
        setSelectedCampaignId(scan.campaignId || "");
      }
    } else {
      initializedScanId.current = null;
    }
  }, [scan, open]);

  useEffect(() => {
    if (scan?.campaignId && campaignDestinations && campaignDestinations.length > 0 && !url) {
      const highestWeightDest = campaignDestinations.reduce((max, dest) => 
        dest.weight > max.weight ? dest : max
      , campaignDestinations[0]);
      setUrl(highestWeightDest.url);
    }
  }, [scan?.campaignId, campaignDestinations, url]);

  useEffect(() => {
    if (enableABTesting && selectedCampaignId && campaignDestinations && campaignDestinations.length > 0) {
      const highestWeightDest = campaignDestinations.reduce((max, dest) => 
        dest.weight > max.weight ? dest : max
      , campaignDestinations[0]);
      setUrl(highestWeightDest.url);
    } else if (enableABTesting && selectedCampaignId && (!campaignDestinations || campaignDestinations.length === 0)) {
      setUrl("");
    }
  }, [enableABTesting, selectedCampaignId, campaignDestinations]);

  // QR Preview Generation
  useEffect(() => {
    if (!url || !open) {
      return;
    }

    let cancelled = false;
    setIsGenerating(true);
    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        const result = await generateBrandedQR({
          targetUrl: scan?.dynamicSlug ? `${window.location.origin}/q/${scan.dynamicSlug}` : url, foregroundColor, backgroundColor, borderColor,
          topText, bottomText, enableBranding, backgroundImage,
          backgroundImageType: backgroundImage?.startsWith("data:image/gif") ? "image/gif" : null,
          imageFit, borderShape, polaroidText, canvasFillEnabled, canvasFillColor,
          moduleStyle, eyeStyle, eyeColor,
        });
        if (!cancelled) { setQrPreviewUrl(result.qrImageUrl); setIsGenerating(false); }
      } catch (err) {
        if (!cancelled) {
          setQrPreviewUrl("");
          setIsGenerating(false);
          console.error("QR preview error:", err);
        }
      }
    };

    const debounce = setTimeout(generatePreview, 300);
    return () => { cancelled = true; clearTimeout(debounce); };
  }, [scan?.dynamicSlug, moduleStyle, eyeStyle, eyeColor, url, foregroundColor, backgroundColor, borderColor, topText, bottomText, enableBranding, backgroundImage, imageFit, borderShape, polaroidText, canvasFillEnabled, canvasFillColor, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!scan) throw new Error("No scan selected");
      
      return await apiRequest("PATCH", `/api/scans/${scan.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/scans"] });
      toast({
        title: "QR Updated",
        description: "Your QR code has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update QR code",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setBackgroundImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scan || !originalScan) return;

    if (enableABTesting && !selectedCampaignId) {
      toast({
        title: "Campaign Required",
        description: "Please select a campaign for split testing",
        variant: "destructive",
      });
      return;
    }

    if (enableABTesting && !url) {
      toast({
        title: "No Destinations",
        description: "This campaign has no destinations. Add destinations to the campaign first.",
        variant: "destructive",
      });
      return;
    }

    if (!enableABTesting) {
      try {
        new URL(url.trim());
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid destination URL",
          variant: "destructive",
        });
        return;
      }
    }
      
    if (isFreeUser) {
      const updates: any = { moduleStyle, eyeStyle, eyeColor };
      const normalizeValue = (val: any) => val || null;
      
      if (normalizeValue(title.trim()) !== normalizeValue(originalScan.title)) {
        updates.title = title.trim() || null;
      }
      
      updateMutation.mutate(updates);
      return;
    }
    
    const updates: any = { moduleStyle, eyeStyle, eyeColor };
    const normalizeValue = (val: any) => val || null;
      
    if (enableABTesting) {
      updates.destination = null;
      updates.redirectUrl = null;
      updates.campaignId = selectedCampaignId;
    } else {
      updates.destination = url.trim();
      updates.campaignId = null;
    }
    
    if (normalizeValue(title.trim()) !== normalizeValue(originalScan.title)) {
      updates.title = title.trim() || null;
    }
    
    if (foregroundColor !== (originalScan.foregroundColor || "#000000")) {
      updates.foregroundColor = foregroundColor;
    }
    
    if (backgroundColor !== (originalScan.backgroundColor || "#FFFFFF")) {
      updates.backgroundColor = backgroundColor;
    }
    
    if (borderColor !== (originalScan.borderColor || "#8B5CF6")) {
      updates.borderColor = borderColor;
    }
    
    if (enableBranding !== (originalScan.enableBranding || false)) {
      updates.enableBranding = enableBranding;
    }
    
    const newTopText = enableBranding ? topText : null;
    if (normalizeValue(newTopText) !== normalizeValue(originalScan.topText)) {
      updates.topText = newTopText;
    }
    
    const newBottomText = enableBranding ? bottomText : null;
    if (normalizeValue(newBottomText) !== normalizeValue(originalScan.bottomText)) {
      updates.bottomText = newBottomText;
    }
    
    if (normalizeValue(backgroundImage) !== normalizeValue(originalScan.backgroundImage)) {
      updates.backgroundImage = backgroundImage || null;
    }
    
    if (borderShape !== (originalScan.borderShape || "square")) {
      updates.borderShape = borderShape;
    }
    
    if (imageFit !== (originalScan.imageFitMode || "cover")) {
      updates.imageFitMode = imageFit;
    }
    
    const newPolaroidText = borderShape === "polaroid" ? polaroidText : null;
    if (normalizeValue(newPolaroidText) !== normalizeValue(originalScan.polaroidText)) {
      updates.polaroidText = newPolaroidText;
    }
    
    if (canvasFillEnabled !== ((originalScan as any).canvasFillEnabled || false)) {
      updates.canvasFillEnabled = canvasFillEnabled;
    }
    
    if (canvasFillColor !== ((originalScan as any).canvasFillColor || "#FFFFFF")) {
      updates.canvasFillColor = canvasFillColor;
    }
    
    // Always use the current preview as the saved QR image
    // This ensures the dashboard shows exactly what's in the preview
    if (qrPreviewUrl && qrPreviewUrl !== scan.qrImageUrl) {
      updates.qrImageUrl = qrPreviewUrl;
      console.log("[Edit Modal] Using preview as new QR image, length:", qrPreviewUrl?.length);
    }
    
    console.log("[Edit Modal] Sending updates:", Object.keys(updates), "qrImageUrl included:", !!updates.qrImageUrl);
    updateMutation.mutate(updates);
  };

  const shapeButtons = [
    { value: "square", icon: Square, label: "Square" },
    { value: "circle", icon: Circle, label: "Circle" },
    { value: "star", icon: Star, label: "Star" },
    { value: "polaroid", icon: Camera, label: "Polaroid" },
    { value: "diamond", icon: Diamond, label: "Diamond" },
    { value: "heart", icon: Heart, label: "Heart" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]" data-testid="dialog-edit-qr">
        <DialogHeader>
          <DialogTitle>Edit QR Code</DialogTitle>
          <DialogDescription>
            Update the appearance and destination of your QR code
          </DialogDescription>
        </DialogHeader>

        {isFreeUser && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Free plan users can only edit the <strong>Title</strong> field (scroll to top of form). 
              Upgrade to Starter or higher to edit design, colors, and other settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScrollArea className="h-[500px] pr-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Destination URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  data-testid="input-url"
                  disabled={enableABTesting}
                />
                {enableABTesting && !url && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    This campaign has no destinations yet. Add destinations to the campaign first, then edit this QR.
                  </p>
                )}
                {enableABTesting && url && (
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from campaign's highest-weight destination. Toggle off split testing to edit manually.
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

              {!isFreeUser && (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Enable Split Testing</Label>
                      <p className="text-sm text-muted-foreground">
                        Route traffic to multiple campaign destinations
                      </p>
                    </div>
                    <Switch
                      checked={enableABTesting}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSavedSimpleUrl(url);
                        } else {
                          setUrl(savedSimpleUrl || url);
                        }
                        setEnableABTesting(checked);
                      }}
                      data-testid="switch-ab-testing-edit"
                    />
                  </div>

                  {enableABTesting && (
                    <div className="space-y-2">
                      <Label>Campaign *</Label>
                      <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger data-testid="select-campaign-edit">
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
                        Select a campaign with multiple destinations for split testing
                      </p>
                    </div>
                  )}
                </>
              )}


                      <QRDesignControls moduleStyle={moduleStyle} eyeStyle={eyeStyle} eyeColor={eyeColor}
                        foregroundColor={foregroundColor} backgroundColor={backgroundColor}
                        onModuleStyle={setModuleStyle} onEyeStyle={setEyeStyle} onEyeColor={setEyeColor} onBackgroundColor={setBackgroundColor}
                        onPreset={(preset) => {
                          setModuleStyle(preset.moduleStyle); setEyeStyle(preset.eyeStyle);
                          setEyeColor(preset.accent); setForegroundColor(preset.foreground);
                          setBackgroundColor(preset.background); setBorderColor(preset.background);
                          setBackgroundImage(null); setBorderShape("square"); setEnableBranding(false);
                        }} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="foreground">Foreground</Label>
                  <div className="flex gap-2">
                    <Input
                      id="foreground"
                      type="color"
                      value={foregroundColor}
                      onChange={(e) => setForegroundColor(e.target.value)}
                      className="h-10 w-20"
                    />
                    <Input
                      type="text"
                      value={foregroundColor}
                      onChange={(e) => setForegroundColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background"
                      type="color"
                      value={backgroundColor === "transparent" ? "#FFFFFF" : backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-10 w-20"
                    />
                    <Input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Border Shape</Label>
                <p className="text-xs text-muted-foreground">Choose a creative border shape for your QR code</p>
                <div className="grid grid-cols-3 gap-2">
                  {shapeButtons.map(({ value, icon: Icon, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={borderShape === value ? "default" : "outline"}
                      className="flex flex-col gap-1 h-auto py-3"
                      onClick={() => setBorderShape(value)}
                      data-testid={`button-shape-${value}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Background Image</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                    data-testid="button-upload-image"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {backgroundImage ? "Change Image" : "Upload Image"}
                  </Button>
                  {backgroundImage && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => setBackgroundImage(null)}
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {backgroundImage && (
                  <div className="space-y-2">
                    <Label htmlFor="imageFit">Image Fit</Label>
                    <Select value={imageFit} onValueChange={(value: "cover" | "contain" | "stretch") => setImageFit(value)}>
                      <SelectTrigger data-testid="select-image-fit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cover">Cover (Fill Frame)</SelectItem>
                        <SelectItem value="contain">Contain (Fit Inside)</SelectItem>
                        <SelectItem value="stretch">Stretch (May Distort)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canvasFill"
                    checked={canvasFillEnabled}
                    onCheckedChange={(checked) => setCanvasFillEnabled(checked as boolean)}
                    data-testid="checkbox-canvas-fill"
                  />
                  <Label htmlFor="canvasFill" className="text-sm cursor-pointer">
                    Fill background outside shape
                  </Label>
                </div>
                {canvasFillEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="canvasFillColor">Background Fill Color</Label>
                    <div className="flex gap-2">
                      <input
                        id="canvasFillColor"
                        type="color"
                        value={canvasFillColor}
                        onChange={(e) => setCanvasFillColor(e.target.value)}
                        className="h-10 w-full rounded-md border cursor-pointer"
                        data-testid="input-canvas-fill-color"
                      />
                      <Input
                        type="text"
                        value={canvasFillColor}
                        onChange={(e) => setCanvasFillColor(e.target.value)}
                        className="flex-1"
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="branding"
                  checked={enableBranding}
                  onCheckedChange={(checked) => setEnableBranding(checked as boolean)}
                  data-testid="checkbox-branding"
                />
                <Label htmlFor="branding" className="text-sm cursor-pointer">
                  Add custom branding
                </Label>
              </div>

              {enableBranding && borderShape !== "polaroid" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="topText">Top Text</Label>
                    <Input
                      id="topText"
                      type="text"
                      value={topText}
                      onChange={(e) => setTopText(e.target.value)}
                      data-testid="input-top-text"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bottomText">Bottom Text</Label>
                    <Input
                      id="bottomText"
                      type="text"
                      value={bottomText}
                      onChange={(e) => setBottomText(e.target.value)}
                      data-testid="input-bottom-text"
                    />
                  </div>
                </>
              )}

              {borderShape === "polaroid" && (
                <div className="space-y-2">
                  <Label htmlFor="polaroidText">Polaroid Caption</Label>
                  <Input
                    id="polaroidText"
                    type="text"
                    placeholder="Add a caption..."
                    value={polaroidText}
                    onChange={(e) => setPolaroidText(e.target.value)}
                    data-testid="input-polaroid-text"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="borderColor">Border Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="borderColor"
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="h-10 w-20"
                  />
                  <Input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isGenerating || !qrPreviewUrl || updateMutation.isPending}
                  data-testid="button-save-changes"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </ScrollArea>

          <div className="flex flex-col items-center justify-center">
            <div className="space-y-2 w-full">
              <Label>Live Preview</Label>
              <div className="flex items-center justify-center p-4 bg-background rounded-md border min-h-[420px]">
                {isGenerating ? (
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Generating preview...</p>
                  </div>
                ) : qrPreviewUrl ? (
                  <img 
                    src={qrPreviewUrl} 
                    alt="QR Code Preview" 
                    className="max-w-full h-auto object-contain rounded"
                    style={{ maxHeight: "400px" }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Enter a URL to see preview</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Preview updates automatically as you make changes
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrPreviewUrl || scan?.qrImageUrl || '';
                  link.download = `qr-code-${scan?.id}.png`;
                  link.click();
                }}
                data-testid="button-download"
                disabled={isGenerating || !qrPreviewUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Preview
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
