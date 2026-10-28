import { renderQRSvg, type ModuleStyle, type EyeStyle } from "./qr-design";
type BorderShape = "square" | "circle" | "star" | "polaroid" | "diamond" | "heart";
type ImageFit = "cover" | "contain" | "stretch";

export interface GenerateQRParams {
  moduleStyle?: ModuleStyle;
  eyeStyle?: EyeStyle;
  eyeColor?: string;
  targetUrl: string;
  foregroundColor: string;
  backgroundColor: string;
  borderColor: string;
  topText: string;
  bottomText: string;
  enableBranding: boolean;
  backgroundImage: string | null;
  backgroundImageType: string | null;
  imageFit: ImageFit;
  borderShape: BorderShape;
  polaroidText: string;
  canvasFillEnabled: boolean;
  canvasFillColor: string;
}

export interface GenerateQRResult {
  qrImageUrl: string;
  qrOverlayUrl?: string;
}

function getShapeDimensions(shape: BorderShape) {
  const borderSize = shape === "circle" ? 90 : 60;
  const qrSize = shape === "circle" ? 340 : 400;
  
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
}

function createShapePath(ctx: CanvasRenderingContext2D, shape: BorderShape, width: number, height: number) {
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
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
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
      ctx.rect(0, 0, width, height);
      break;
    case "square":
    default:
      ctx.rect(0, 0, width, height);
      break;
  }
}

export async function generateBrandedQR(params: GenerateQRParams): Promise<GenerateQRResult> {
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

  const svg = renderQRSvg(targetUrl, foregroundColor, backgroundColor, {
    moduleStyle: params.moduleStyle ?? "square",
    eyeStyle: params.eyeStyle ?? "square",
    eyeColor: params.eyeColor || foregroundColor,
  });
  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error("Unable to render QR code"));
    qrImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = rawCanvas.height = 1600;
  const rawCtx = rawCanvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas not supported");
  rawCtx.drawImage(qrImage, 0, 0, 1600, 1600);
  const qrDataUrl = rawCanvas.toDataURL("image/png");

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

  const drawQROverlay = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    const isPolaroid = borderShape === "polaroid";

    if (enableBranding && !isPolaroid) {
      if (topText) {
        ctx.fillStyle = backgroundImage ? "#FFFFFF" : foregroundColor;
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(topText, canvasWidth / 2, 35, canvasWidth - 48);
      }

      if (bottomText) {
        ctx.fillStyle = backgroundImage ? "#FFFFFF" : foregroundColor;
        ctx.font = "16px Inter, sans-serif";
        ctx.textAlign = "center";
        const bottomY = isPolaroid ? canvasHeight - 125 : canvasHeight - 25;
        ctx.fillText(bottomText, canvasWidth / 2, bottomY, canvasWidth - 48);
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

    overlayCanvas.width = totalWidth * 3;
    overlayCanvas.height = totalHeight * 3;
    overlayCtx.scale(3, 3);

    drawQROverlay(overlayCtx, totalWidth, totalHeight);

    const transparentQRUrl = overlayCanvas.toDataURL("image/png");

    const compositeCanvas = document.createElement("canvas");
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) throw new Error("Canvas not supported");

    compositeCanvas.width = totalWidth * 3;
    compositeCanvas.height = totalHeight * 3;
    compositeCtx.scale(3, 3);

    const compositeDataUrl = await new Promise<string>((resolve, reject) => {
      const bgImg = new Image();
      bgImg.onload = () => {
        if (canvasFillEnabled) {
          compositeCtx.fillStyle = canvasFillColor;
          compositeCtx.fillRect(0, 0, totalWidth, totalHeight);
        } else {
          compositeCtx.clearRect(0, 0, totalWidth, totalHeight);
        }
        
        compositeCtx.save();
        createShapePath(compositeCtx, borderShape, totalWidth, totalHeight);
        compositeCtx.clip();
        drawImageOnCanvas(compositeCtx, bgImg, bgImg.width, bgImg.height, totalWidth, totalHeight);
        compositeCtx.restore();
        
        drawQROverlay(compositeCtx, totalWidth, totalHeight);

        if (borderShape !== "square") {
          compositeCtx.save();
          compositeCtx.lineWidth = 8;
          compositeCtx.strokeStyle = borderColor;
          createShapePath(compositeCtx, borderShape, totalWidth, totalHeight);
          compositeCtx.stroke();
          compositeCtx.restore();
        }
        
        resolve(compositeCanvas.toDataURL("image/png"));
      };
      bgImg.onerror = () => reject(new Error("Unable to load background image"));
      bgImg.src = backgroundImage;
    });

    return { 
      qrImageUrl: compositeDataUrl, 
      qrOverlayUrl: transparentQRUrl 
    };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  canvas.width = totalWidth * 3;
  canvas.height = totalHeight * 3;
  ctx.scale(3, 3);

  if (canvasFillEnabled) {
    ctx.fillStyle = canvasFillColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);
  } else {
    ctx.clearRect(0, 0, totalWidth, totalHeight);
  }

  ctx.save();
  createShapePath(ctx, borderShape, totalWidth, totalHeight);
  ctx.clip();
  
  if (backgroundImage) {
    const bgImg = new Image();
    await new Promise<void>((resolve, reject) => {
      bgImg.onload = () => resolve();
      bgImg.onerror = () => reject(new Error("Unable to load background image"));
      bgImg.src = backgroundImage;
    });
    drawImageOnCanvas(ctx, bgImg, bgImg.width, bgImg.height, totalWidth, totalHeight);
  } else {
    ctx.fillStyle = borderColor;
    ctx.fill();
  }
  
  ctx.restore();

  if (borderShape !== "square") {
    ctx.save();
    ctx.lineWidth = 8;
    ctx.strokeStyle = borderColor;
    createShapePath(ctx, borderShape, totalWidth, totalHeight);
    ctx.stroke();
    ctx.restore();
  }

  drawQROverlay(ctx, totalWidth, totalHeight);

  return { qrImageUrl: canvas.toDataURL("image/png") };
}
