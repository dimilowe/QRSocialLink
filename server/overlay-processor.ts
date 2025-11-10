import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { exec } from "child_process";
import type { IStorage } from "./storage";
import type { OverlayRendition } from "@shared/schema";

const execAsync = promisify(exec);

export class OverlayProcessor {
  private storage: IStorage;
  private isProcessing = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5000;
  private readonly OUTPUT_DIR = path.join(process.cwd(), "server", "output", "overlays");

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async start() {
    await this.ensureOutputDir();
    
    console.log("[OverlayProcessor] Starting overlay processor...");
    
    await this.processQueue();
    
    this.pollingInterval = setInterval(() => {
      this.processQueue();
    }, this.POLL_INTERVAL_MS);
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("[OverlayProcessor] Stopped overlay processor");
    }
  }

  private async ensureOutputDir() {
    try {
      await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error("[OverlayProcessor] Failed to create output directory:", error);
    }
  }

  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const overlay = await this.storage.claimQueuedOverlayRendition();
      
      if (overlay) {
        console.log(`[OverlayProcessor] Claimed overlay ${overlay.id} for processing`);
        await this.processOverlay(overlay);
        
        await this.processQueue();
      }
    } catch (error) {
      console.error("[OverlayProcessor] Error processing queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOverlay(overlay: OverlayRendition) {
    let tempDir: string | null = null;

    try {
      console.log(`[OverlayProcessor] Processing overlay ${overlay.id}`);

      const scan = await this.storage.getScan(overlay.scanId);
      if (!scan) {
        throw new Error("Scan not found");
      }

      const frame = await this.storage.getFrame(overlay.frameId);
      if (!frame) {
        throw new Error("Frame template not found");
      }

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `overlay-${overlay.id}-`));
      
      const qrPath = path.join(tempDir, "qr.png");
      const outputFilename = `${overlay.id}.png`;
      const outputPath = path.join(this.OUTPUT_DIR, outputFilename);

      const renderConfig = overlay.renderConfig || {};
      const {
        overlayWidth = 800,
        overlayHeight = 300,
        overlayColor = "#9333ea",
        overlayBackgroundImage = "",
        overlayImageFit = "cover",
        qrXOffset = 0,
        qrYOffset = 0,
        qrSizeModifier = 1,
        textColor = "#ffffff",
        textFont = "Arial",
        textSize = 48,
        borderRadius = 24,
      } = renderConfig;
      const ctaText = overlay.ctaText || "";

      console.log(`[OverlayProcessor] Rendering ${overlayWidth}x${overlayHeight} overlay banner for ${frame.name}`);

      if (!scan.qrImageUrl) {
        throw new Error("QR code image not found on scan");
      }

      if (scan.qrImageUrl.startsWith('http://') || scan.qrImageUrl.startsWith('https://')) {
        const response = await fetch(scan.qrImageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch QR image: ${response.statusText}`);
        }
        const qrBuffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(qrPath, qrBuffer);
      } else {
        const qrData = scan.qrImageUrl.startsWith('data:') 
          ? scan.qrImageUrl.split(',')[1]
          : scan.qrImageUrl;
        const qrBuffer = Buffer.from(qrData, 'base64');
        await fs.writeFile(qrPath, qrBuffer);
      }

      const qrScale = Math.min(Math.max(200 * qrSizeModifier, 50), 800);
      const qrX = (overlayWidth / 2) - (qrScale / 2) + qrXOffset;
      const qrY = (overlayHeight / 2) - (qrScale / 2) + qrYOffset;

      const overlayPanelPath = path.join(tempDir, "panel.png");
      
      if (overlayBackgroundImage && overlayBackgroundImage.trim()) {
        const bgImagePath = path.join(tempDir, "bg-image.png");
        
        if (overlayBackgroundImage.startsWith('http://') || overlayBackgroundImage.startsWith('https://')) {
          const bgResponse = await fetch(overlayBackgroundImage);
          if (!bgResponse.ok) {
            throw new Error(`Failed to fetch background image: ${bgResponse.statusText}`);
          }
          const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
          await fs.writeFile(bgImagePath, bgBuffer);
        } else {
          const bgData = overlayBackgroundImage.startsWith('data:') 
            ? overlayBackgroundImage.split(',')[1]
            : overlayBackgroundImage;
          const bgBuffer = Buffer.from(bgData, 'base64');
          await fs.writeFile(bgImagePath, bgBuffer);
        }
        
        let resizeMode = "";
        if (overlayImageFit === "cover") {
          resizeMode = `${overlayWidth}x${overlayHeight}^ -gravity center -extent ${overlayWidth}x${overlayHeight}`;
        } else if (overlayImageFit === "contain") {
          resizeMode = `${overlayWidth}x${overlayHeight}`;
        } else {
          resizeMode = `${overlayWidth}x${overlayHeight}!`;
        }
        
        const resizeBgCmd = `convert "${bgImagePath}" -resize ${resizeMode} "${overlayPanelPath}"`;
        await execAsync(resizeBgCmd, { maxBuffer: 50 * 1024 * 1024 });
      } else {
        const createPanelCmd = `convert -size ${overlayWidth}x${overlayHeight} xc:"${overlayColor}" -alpha set -channel RGBA -background none -fill "${overlayColor}" -draw "roundrectangle 0,0 ${overlayWidth},${overlayHeight} ${borderRadius},${borderRadius}" "${overlayPanelPath}"`;
        await execAsync(createPanelCmd, { maxBuffer: 50 * 1024 * 1024 });
      }
      
      const resizeQrCmd = `convert "${qrPath}" -resize ${qrScale}x${qrScale}! "${qrPath}"`;
      await execAsync(resizeQrCmd, { maxBuffer: 50 * 1024 * 1024 });
      
      const overlayQrCmd = `convert "${overlayPanelPath}" "${qrPath}" -geometry +${qrX}+${qrY} -composite "${overlayPanelPath}"`;
      await execAsync(overlayQrCmd, { maxBuffer: 50 * 1024 * 1024 });
      
      if (ctaText && ctaText.trim()) {
        const textY = qrY + qrScale + 40;
        const addTextCmd = `convert "${overlayPanelPath}" -font DejaVu-Sans-Bold -pointsize ${textSize} -fill "${textColor}" -gravity North -annotate +0+${textY} "${ctaText.replace(/"/g, '\\"')}" "${overlayPanelPath}"`;
        await execAsync(addTextCmd, { maxBuffer: 50 * 1024 * 1024 });
      }
      
      const copyToOutputCmd = `cp "${overlayPanelPath}" "${outputPath}"`;
      
      console.log(`[OverlayProcessor] Generating ${overlayWidth}x${overlayHeight} overlay banner with${ctaText ? '' : 'out'} CTA text and ${borderRadius}px border radius`);
      await execAsync(copyToOutputCmd, { maxBuffer: 50 * 1024 * 1024 });

      await this.storage.updateOverlayRendition(overlay.id, {
        status: "completed",
        outputPath: `/api/overlays/${overlay.id}/download`,
        errorMessage: null,
        completedAt: new Date(),
      });

      console.log(`[OverlayProcessor] Successfully processed overlay ${overlay.id}`);
    } catch (error: any) {
      console.error(`[OverlayProcessor] Failed to process overlay ${overlay.id}:`, error);
      
      await this.storage.updateOverlayRendition(overlay.id, {
        status: "failed",
        outputPath: null,
        errorMessage: error.message || "Unknown error occurred during rendering",
        completedAt: new Date(),
      });
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error(`[OverlayProcessor] Cleanup error:`, cleanupError);
        }
      }
    }
  }

  async getOutputPath(renditionId: string): Promise<string | null> {
    const outputPath = path.join(this.OUTPUT_DIR, `${renditionId}.png`);
    
    try {
      await fs.access(outputPath);
      return outputPath;
    } catch {
      return null;
    }
  }
}
