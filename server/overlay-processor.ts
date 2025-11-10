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
        qrXOffset = 0,
        qrYOffset = 0,
        qrSizeModifier = 1,
        textColor = "#ffffff",
        textFont = "Arial",
        textSize = 48,
        borderRadius = 24,
      } = renderConfig;

      const safeArea = typeof frame.safeArea === 'string' 
        ? JSON.parse(frame.safeArea) 
        : frame.safeArea;
      
      const frameWidth = 1080;
      const frameHeight = 1920;

      console.log(`[OverlayProcessor] Rendering ${frameWidth}x${frameHeight} overlay for ${frame.name}`);

      if (!scan.qrImageUrl) {
        throw new Error("QR code image not found on scan");
      }

      const qrData = scan.qrImageUrl.startsWith('data:') 
        ? scan.qrImageUrl.split(',')[1]
        : scan.qrImageUrl;
      const qrBuffer = Buffer.from(qrData, 'base64');
      await fs.writeFile(qrPath, qrBuffer);

      const qrScale = 200 * qrSizeModifier;
      const qrX = (overlayWidth / 2) - (qrScale / 2) + qrXOffset;
      const qrY = (overlayHeight / 2) - (qrScale / 2) + qrYOffset;
      
      const overlayX = (frameWidth - overlayWidth) / 2;
      const overlayY = safeArea?.bottom 
        ? (frameHeight - safeArea.bottom - overlayHeight - 50)
        : (frameHeight - overlayHeight - 100);

      const overlayHex = overlayColor.replace('#', '');
      let filterComplex = `color=c=black:s=${frameWidth}x${frameHeight}[bg];`;
      filterComplex += `color=c=0x${overlayHex}:s=${overlayWidth}x${overlayHeight}[overlay];`;
      filterComplex += `[1:v]scale=${qrScale}:${qrScale}[qr];`;
      filterComplex += `[overlay][qr]overlay=${qrX}:${qrY}[overlay_with_qr];`;
      filterComplex += `[bg][overlay_with_qr]overlay=${overlayX}:${overlayY}`;

      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=${frameWidth}x${frameHeight} -i "${qrPath}" -filter_complex "${filterComplex}" -frames:v 1 -y "${outputPath}"`;

      console.log(`[OverlayProcessor] Generating static PNG overlay`);
      await execAsync(ffmpegCommand, { maxBuffer: 50 * 1024 * 1024 });

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
    const outputPath = path.join(this.OUTPUT_DIR, `${renditionId}.mp4`);
    
    try {
      await fs.access(outputPath);
      return outputPath;
    } catch {
      return null;
    }
  }
}
