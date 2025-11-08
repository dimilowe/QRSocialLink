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
import { Sparkles, AlertCircle, Download, Upload, X, Image as ImageIcon } from "lucide-react";
import { insertScanSchema } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [giflerInstance, setGiflerInstance] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<CreateQRFormData>({
    resolver: zodResolver(createQRFormSchema),
    defaultValues: {
      decodedUrl: "",
      title: "",
    },
  });

  const url = form.watch("decodedUrl");

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

  useEffect(() => {
    if (!url) {
      setQrImageUrl("");
      return;
    }

    let currentGifler: any = null;

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

        if (!enableBranding && !backgroundImage) {
          setQrImageUrl(qrDataUrl);
          setIsGenerating(false);
          return;
        }

        const borderSize = 60;
        const qrSize = 400;
        const totalSize = qrSize + borderSize * 2;

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
          ctx.drawImage(qrImage, borderSize, borderSize, qrSize, qrSize);

          if (enableBranding) {
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
              ctx.strokeText(bottomText, canvasWidth / 2, canvasHeight - 25);
              ctx.fillText(bottomText, canvasWidth / 2, canvasHeight - 25);
            }
          }

          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.font = "10px Inter, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("Made with QR Social", canvasWidth - 10, canvasHeight - 10);
        };

        if (backgroundImage && backgroundImageType === "image/gif") {
          // For GIF backgrounds, create a transparent QR overlay
          const overlayCanvas = document.createElement("canvas");
          const overlayCtx = overlayCanvas.getContext("2d");
          if (!overlayCtx) throw new Error("Canvas not supported");

          overlayCanvas.width = totalSize;
          overlayCanvas.height = totalSize;

          // Draw QR code and branding on transparent background
          drawQROverlay(overlayCtx, totalSize, totalSize);

          const transparentQRUrl = overlayCanvas.toDataURL("image/png");
          setQrOverlayUrl(transparentQRUrl);

          // Also create a static composite for download
          const compositeCanvas = document.createElement("canvas");
          const compositeCtx = compositeCanvas.getContext("2d");
          if (!compositeCtx) throw new Error("Canvas not supported");

          compositeCanvas.width = totalSize;
          compositeCanvas.height = totalSize;

          const bgImg = new Image();
          bgImg.onload = () => {
            compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
            drawImageOnCanvas(compositeCtx, bgImg, bgImg.width, bgImg.height, compositeCanvas.width, compositeCanvas.height);
            drawQROverlay(compositeCtx, compositeCanvas.width, compositeCanvas.height);

            const compositeDataUrl = compositeCanvas.toDataURL("image/png");
            setQrImageUrl(compositeDataUrl);
            setIsGenerating(false);
          };
          bgImg.src = backgroundImage;
        } else if (backgroundImage) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");

          canvas.width = totalSize;
          canvas.height = totalSize;

          const bgImg = new Image();
          bgImg.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawImageOnCanvas(ctx, bgImg, bgImg.width, bgImg.height, canvas.width, canvas.height);
            drawQROverlay(ctx, canvas.width, canvas.height);

            const brandedDataUrl = canvas.toDataURL("image/png");
            setQrImageUrl(brandedDataUrl);
            setIsGenerating(false);
          };
          bgImg.src = backgroundImage;
        } else {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");

          canvas.width = totalSize;
          canvas.height = totalSize;

          ctx.fillStyle = borderColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          drawQROverlay(ctx, canvas.width, canvas.height);

          const brandedDataUrl = canvas.toDataURL("image/png");
          setQrImageUrl(brandedDataUrl);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("QR generation error:", err);
        setIsGenerating(false);
      }
    };

    const debounce = setTimeout(generateQR, 300);
    return () => {
      clearTimeout(debounce);
      if (currentGifler && currentGifler.stop) {
        currentGifler.stop();
      }
      if (giflerInstance && giflerInstance.stop) {
        giflerInstance.stop();
      }
    };
  }, [url, foregroundColor, backgroundColor, borderColor, topText, bottomText, enableBranding, backgroundImage, backgroundImageType, imageFit]);

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
      toast({
        title: "QR Code created!",
        description: "Your QR code has been saved to your dashboard",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create QR code",
        variant: "destructive",
      });
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

  const handleDownloadQR = () => {
    if (!qrImageUrl) return;
    
    const link = document.createElement("a");
    link.download = `qr-code-${form.watch("title") || "download"}.png`;
    link.href = qrImageUrl;
    link.click();

    toast({
      title: "QR Code Downloaded",
      description: "Your QR code has been saved to your device",
    });
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
