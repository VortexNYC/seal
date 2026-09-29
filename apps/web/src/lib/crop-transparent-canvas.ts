/**
 * Crop fully-transparent (and optionally near-white) margins from a canvas.
 * DocuSeal crop_canvas pattern — keeps ink flush so PDF burn-in sits on the line.
 */

export type CropTransparentOptions = {
  minWidth?: number;
  minHeight?: number;
  padding?: number;
  /** Treat near-white opaque pixels as empty (JPG uploads on white paper). */
  treatNearWhiteAsEmpty?: boolean;
  nearWhiteThreshold?: number;
};

export type InkBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function isEmptyPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: CropTransparentOptions = {}
): boolean {
  if (a === 0) return true;
  if (!options.treatNearWhiteAsEmpty) return false;
  const threshold = options.nearWhiteThreshold ?? 250;
  return r >= threshold && g >= threshold && b >= threshold;
}

/** Pure ink-bounds finder over RGBA pixel buffer (row-major). */
export function findInkBounds(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: CropTransparentOptions = {}
): InkBounds | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const a = pixels[i + 3] ?? 0;
      if (!isEmptyPixel(r, g, b, a, options)) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom < 0 || right < 0) return null;
  return { left, top, right, bottom };
}

export function cropTransparentCanvas(
  source: HTMLCanvasElement,
  options: CropTransparentOptions = {}
): HTMLCanvasElement {
  const minWidth = options.minWidth ?? 1;
  const minHeight = options.minHeight ?? 1;
  const padding = Math.max(0, options.padding ?? 0);
  const ctx = source.getContext("2d");
  if (!ctx) return source;

  const { width, height } = source;
  if (width <= 0 || height <= 0) return source;

  const imageData = ctx.getImageData(0, 0, width, height);
  const bounds = findInkBounds(imageData.data, width, height, options);
  if (!bounds) return source;

  let { top, left, bottom, right } = bounds;
  top = Math.max(0, top - padding);
  left = Math.max(0, left - padding);
  bottom = Math.min(height - 1, bottom + padding);
  right = Math.min(width - 1, right + padding);

  const croppedWidth = Math.max(minWidth, right - left + 1);
  const croppedHeight = Math.max(minHeight, bottom - top + 1);

  const cropped = document.createElement("canvas");
  cropped.width = croppedWidth;
  cropped.height = croppedHeight;
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) return source;

  // For near-white sources, punch white to transparent so burn-in doesn't draw a white box.
  if (options.treatNearWhiteAsEmpty) {
    const slice = ctx.getImageData(left, top, croppedWidth, croppedHeight);
    const threshold = options.nearWhiteThreshold ?? 250;
    for (let i = 0; i < slice.data.length; i += 4) {
      const r = slice.data[i] ?? 0;
      const g = slice.data[i + 1] ?? 0;
      const b = slice.data[i + 2] ?? 0;
      if (r >= threshold && g >= threshold && b >= threshold) {
        slice.data[i + 3] = 0;
      }
    }
    croppedCtx.putImageData(slice, 0, 0);
  } else {
    croppedCtx.drawImage(
      source,
      left,
      top,
      croppedWidth,
      croppedHeight,
      0,
      0,
      croppedWidth,
      croppedHeight
    );
  }
  return cropped;
}

/** Load a data URL into a canvas, crop empty margins, return PNG data URL. */
export async function cropTransparentDataUrl(
  dataUrl: string,
  options: CropTransparentOptions = {}
): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  if (!dataUrl.startsWith("data:image/")) return dataUrl;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode signature image"));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width);
  canvas.height = Math.max(1, image.naturalHeight || image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0);

  const isJpeg = /^data:image\/jpe?g/i.test(dataUrl);
  return cropTransparentCanvas(canvas, {
    treatNearWhiteAsEmpty: options.treatNearWhiteAsEmpty ?? isJpeg,
    ...options,
  }).toDataURL("image/png");
}
