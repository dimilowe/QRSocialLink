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
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditQRModalProps {
  scan: Scan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditQRModal({ scan, open, onOpenChange }: EditQRModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [borderColor, setBorderColor] = useState("#8B5CF6");
  const [enableBranding, setEnableBranding] = useState(false);
  const [topText, setTopText] = useState("qrsocial.com");
  const [bottomText, setBottomText] = useState("Screenshot & Long-press");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [borderShape, setBorderShape] = useState<"square" | "circle" | "star" | "polaroid" | "diamond" | "heart">("square");
  const [imageFit, setImageFit] = useState<"cover" | "contain" | "stretch">("cover");
  const [polaroidText, setPolaroidText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scan && open) {
      setUrl(scan.redirectUrl || scan.decodedUrl);
      setTitle(scan.title || "");
      setForegroundColor(scan.foregroundColor || "#000000");
      setBackgroundColor(scan.backgroundColor || "#FFFFFF");
      setBorderColor(scan.borderColor || "#8B5CF6");
      setEnableBranding(scan.enableBranding || false);
      setTopText(scan.topText || "qrsocial.com");
      setBottomText(scan.bottomText || "Screenshot & Long-press");
      setBackgroundImage(scan.backgroundImage || null);
      setBorderShape((scan.borderShape as any) || "square");
      setImageFit((scan.imageFitMode as any) || "cover");
      setPolaroidText(scan.polaroidText || "");
    }
  }, [scan, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!scan) throw new Error("No scan selected");
      
      return await apiRequest("PATCH", `/api/scans/${scan.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scan) return;

    try {
      const parsedUrl = new URL(url.trim());
      
      updateMutation.mutate({
        redirectUrl: url.trim() !== scan.decodedUrl ? url.trim() : null,
        title: title.trim() || null,
        foregroundColor,
        backgroundColor,
        borderColor,
        enableBranding,
        topText: enableBranding ? topText : null,
        bottomText: enableBranding ? bottomText : null,
        backgroundImage: backgroundImage || null,
        borderShape,
        imageFitMode: imageFit,
        polaroidText: borderShape === "polaroid" ? polaroidText : null,
      });
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
    }
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
                />
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
                      value={backgroundColor}
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
                  disabled={updateMutation.isPending}
                  data-testid="button-save-changes"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </ScrollArea>

          <div className="flex flex-col items-center justify-center">
            <div className="space-y-2 w-full">
              <Label>Preview</Label>
              <div className="flex items-center justify-center p-4 bg-background rounded-md border">
                {scan?.qrImageUrl && (
                  <img 
                    src={scan.qrImageUrl} 
                    alt="QR Code Preview" 
                    className="max-w-full h-auto object-contain rounded"
                    style={{ maxHeight: "400px" }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Current QR code image
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Destination: {scan?.redirectUrl || scan?.decodedUrl}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = scan?.qrImageUrl || '';
                  link.download = `qr-code-${scan?.id}.png`;
                  link.click();
                }}
                data-testid="button-download"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
