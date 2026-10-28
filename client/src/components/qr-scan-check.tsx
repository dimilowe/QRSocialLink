import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Result = "checking" | "passed" | "small-failed" | "failed" | "mismatch" | "error";
interface Props {
  imageUrl: string;
  expectedUrl: string;
  generating: boolean;
  animated?: boolean;
  transparent?: boolean;
}

// Decode the composed image rather than the original QR matrix: photos and styling matter.
export function QRScanCheck({ imageUrl, expectedUrl, generating, animated, transparent }: Props) {
  const [state, setState] = useState<{ image: string; expected: string; result: Result } | null>(null);
  useEffect(() => {
    if (!imageUrl || generating) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [{ default: jsQR }, image] = await Promise.all([
          import("jsqr"),
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Unable to load preview"));
            image.src = imageUrl;
          }),
        ]);
        if (cancelled) return;
        const decode = (width: number) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth));
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("Canvas unavailable");
          // Standalone transparent PNGs need a backing color for the test.
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data;
        };
        const small = decode(Math.min(320, image.naturalWidth));
        const large = decode(Math.min(1200, image.naturalWidth));
        const mismatch = [small, large].some(value => value !== undefined && value !== expectedUrl);
        const result: Result = mismatch ? "mismatch" : small === expectedUrl && large === expectedUrl ? "passed" : large === expectedUrl ? "small-failed" : "failed";
        if (!cancelled) setState({ image: imageUrl, expected: expectedUrl, result });
      } catch {
        if (!cancelled) setState({ image: imageUrl, expected: expectedUrl, result: "error" });
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [imageUrl, expectedUrl, generating]);
  if (!imageUrl) return null;
  const result = generating || state?.image !== imageUrl || state?.expected !== expectedUrl ? "checking" : state.result;
  const passed = result === "passed";
  const checking = result === "checking";
  const Icon = checking ? Loader2 : passed ? CheckCircle2 : AlertTriangle;
  const messages: Record<Result, [string, string]> = {
    checking: ["Checking scan readability…", "Testing the finished preview, including its background and colors."],
    passed: ["Preview decodes successfully", "The destination matches at 320px and a larger test size. Scan with your phone before publishing; camera results can vary."],
    "small-failed": ["May be difficult to scan at small sizes", "The larger image decodes, but the 320px preview does not. Try a larger code, stronger contrast, or a simpler background."],
    failed: ["Preview did not decode", "Try dark marks and corners on a lighter image, or turn off transparency for a solid background. Keep the space around the code clear, then test again."],
    mismatch: ["Decoded destination does not match", "This composition appears to contain a different QR destination. Check the background image and regenerate before sharing."],
    error: ["Scan check unavailable", "The preview could not be checked. Test the finished design with a phone camera before sharing."],
  };
  return <div role="status" aria-live="polite" data-testid="qr-scan-check" data-scan-result={result}
    className={`rounded-xl border p-3 text-sm ${passed ? "border-emerald-500/30 bg-emerald-500/5" : checking ? "bg-muted/30" : "border-amber-500/40 bg-amber-500/5"}`}>
    <div className="flex items-center gap-2 font-medium"><Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${checking ? "animate-spin" : ""}`} />{messages[result][0]}</div>
    <p className="mt-1 text-xs text-muted-foreground">{messages[result][1]}</p>
    {transparent && <p className="mt-1 text-xs text-muted-foreground">Transparent areas were tested against white. Retest after placing this PNG on another background.</p>}
    {animated && <p className="mt-1 text-xs text-muted-foreground">This checks a still frame. Test the downloaded animation too; changing frames can affect scanning.</p>}
  </div>;
}
