import QRCode from "qrcode";

export type ModuleStyle = "square" | "rounded" | "dots";
export type EyeStyle = "square" | "rounded" | "circle";
export interface QRDesign {
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  eyeColor: string;
}
export const QR_PRESETS = [
  { name: "Porcelain", foreground: "#182333", background: "#FAF8F3", accent: "#182333", moduleStyle: "rounded", eyeStyle: "rounded" },
  { name: "Botanical", foreground: "#164B3B", background: "#F1F6ED", accent: "#24634D", moduleStyle: "dots", eyeStyle: "rounded" },
  { name: "Cobalt", foreground: "#1739A8", background: "#F1F4FF", accent: "#1739A8", moduleStyle: "rounded", eyeStyle: "circle" },
  { name: "Terracotta", foreground: "#713823", background: "#FFF3E8", accent: "#963D27", moduleStyle: "dots", eyeStyle: "rounded" },
  { name: "Orchid", foreground: "#522D73", background: "#FAF1FF", accent: "#74389B", moduleStyle: "rounded", eyeStyle: "circle" },
  { name: "Editorial", foreground: "#161616", background: "#FFFFFF", accent: "#161616", moduleStyle: "square", eyeStyle: "square" },
] as const;

// Render the encoded matrix directly, preserving functional modules and a four-module quiet zone.
export function renderQRSvg(url: string, foreground: string, background: string, design: QRDesign) {
  for (const color of [foreground, design.eyeColor, ...(background === "transparent" ? [] : [background])]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose an opaque six-digit hex color for the QR code");
  }
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const margin = 4;
  const paths: string[] = [];
  const eyes = [[0, 0], [size - 7, 0], [0, size - 7]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!qr.modules.get(y, x) || eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7)) continue;
    const px = x + margin, py = y + margin;
    // Timing, alignment and format patterns remain square for dependable decoding.
    const style = qr.modules.isReserved(y, x) ? "square" : design.moduleStyle;
    paths.push(style === "dots"
      ? `<circle cx="${px + .5}" cy="${py + .5}" r=".46"/>`
      : `<rect x="${px}" y="${py}" width="1" height="1" rx="${style === "rounded" ? .28 : 0}"/>`);
  }
  const eyeMarkup = eyes.map(([x, y], index) => {
    x += margin; y += margin;
    const r = design.eyeStyle === "rounded" ? 1.8 : design.eyeStyle === "circle" ? 3.5 : 0;
    if (background === "transparent") {
      return `<defs><mask id="eye-${index}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="7" height="7"><rect x="${x}" y="${y}" width="7" height="7" rx="${r}" fill="white"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${Math.max(0, r - 1)}" fill="black"/></mask></defs><rect x="${x}" y="${y}" width="7" height="7" fill="${design.eyeColor}" mask="url(#eye-${index})"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${Math.max(0, r - 2)}" fill="${design.eyeColor}"/>`;
    }
    return `<rect x="${x}" y="${y}" width="7" height="7" rx="${r}" fill="${design.eyeColor}"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${Math.max(0, r - 1)}" fill="${background}"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${Math.max(0, r - 2)}" fill="${design.eyeColor}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 ${size + margin * 2} ${size + margin * 2}">${background === "transparent" ? "" : `<rect width="100%" height="100%" fill="${background}"/>`}<g fill="${foreground}">${paths.join("")}</g>${eyeMarkup}</svg>`;
}
