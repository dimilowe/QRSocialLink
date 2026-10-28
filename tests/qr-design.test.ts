import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import jsQR from "jsqr";
import { QR_PRESETS, renderQRSvg } from "../client/src/lib/qr-design";
import { insertScanSchema } from "../shared/schema";

for (const preset of QR_PRESETS) {
  test(`${preset.name} decodes at export and phone-preview sizes`, async () => {
    for (const url of ["https://qrsocial.io/q/Ab3Xy7", "https://example.com/catalog/summer-collection?campaign=launch&source=poster&variant=botanical"]) {
      const svg = renderQRSvg(url, preset.foreground, preset.background, {
        moduleStyle: preset.moduleStyle, eyeStyle: preset.eyeStyle, eyeColor: preset.accent,
      });
      for (const width of [320, 1600]) {
        const { data, info } = await sharp(Buffer.from(svg)).resize(width).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
        assert.equal(decoded?.data, url, `${preset.name} at ${width}px`);
      }
    }
  });
}
test("all pattern and eye combinations decode", async () => {
  for (const moduleStyle of ["square", "rounded", "dots"] as const) {
    for (const eyeStyle of ["square", "rounded", "circle"] as const) {
      const url = "https://qrsocial.io/q/test-design";
      const svg = renderQRSvg(url, "#182333", "#FFFFFF", { moduleStyle, eyeStyle, eyeColor: "#522D73" });
      const { data, info } = await sharp(Buffer.from(svg)).resize(400).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, url);
    }
  }
});
test("design fields are retained and unknown styles rejected", () => {
  const value = { userId: "00000000-0000-4000-8000-000000000000", qrImageUrl: "data:image/png;base64,test", decodedUrl: "https://example.com", moduleStyle: "dots", eyeStyle: "circle", eyeColor: "#123456" };
  const parsed = insertScanSchema.parse(value);
  assert.equal(parsed.moduleStyle, "dots");
  assert.equal(parsed.eyeStyle, "circle");
  assert.equal(parsed.eyeColor, "#123456");
  assert.equal(insertScanSchema.safeParse({ ...value, moduleStyle: "unknown" }).success, false);
});

test("transparent backgrounds and corner openings preserve alpha and decode over a light image", async () => {
  for (const eyeStyle of ["square", "rounded", "circle"] as const) {
    const url = "https://qrsocial.io/q/transparent";
    const svg = renderQRSvg(url, "#182333", "transparent", { moduleStyle: "rounded", eyeStyle, eyeColor: "#182333" });
    const image = sharp(Buffer.from(svg));
    const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, "quiet zone must be transparent");
    const viewBox = svg.match(/viewBox="0 0 (\d+)/)!;
    const unit = info.width / Number(viewBox[1]);
    const alphaAt = (x: number, y: number) => data[(Math.floor(y * unit) * info.width + Math.floor(x * unit)) * 4 + 3];
    assert.equal(alphaAt(5.5, 7.5), 0, `${eyeStyle} corner opening must be transparent`);
    assert.equal(alphaAt(7.5, 7.5), 255, "corner center remains opaque");
    const composed = await image.clone().flatten({ background: "#F1F6ED" }).resize(400).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(jsQR(new Uint8ClampedArray(composed.data), composed.info.width, composed.info.height)?.data, url);
  }
});
