import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Upload, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface QrScannerProps {
  onScanSuccess: (decodedUrl: string, imageData?: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScanSuccess, onClose }: QrScannerProps) {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setScanResult(decodedText);
          stopScanning();
        },
        () => {}
      );
    } catch (err: any) {
      setError("Camera access denied or unavailable");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            setScanResult(code.data);
            stopScanning();
          } else {
            setError("No QR code found in image");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenLink = () => {
    if (scanResult) {
      onScanSuccess(scanResult);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-heading font-bold" data-testid="text-scanner-title">
            Scan QR Code
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-scanner"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {!scanResult ? (
          <div className="space-y-4">
            <div
              id="qr-reader"
              className={cn(
                "rounded-lg overflow-hidden aspect-square w-full",
                !isScanning && "hidden"
              )}
            />
            
            {error && (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground text-center">{error}</p>
              </Card>
            )}

            {!isScanning && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Position QR code within the frame or upload an image
                </p>
              </Card>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file-upload"
            />
            
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-qr"
            >
              <Upload className="h-5 w-5 mr-2" />
              Upload QR Image
            </Button>
          </div>
        ) : (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-chart-2" />
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 text-center">QR Code Detected</h3>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm break-all" data-testid="text-decoded-url">{scanResult}</p>
              </div>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleOpenLink}
              data-testid="button-open-link"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Open Link & Save
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
