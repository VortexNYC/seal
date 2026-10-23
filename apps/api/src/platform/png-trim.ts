/**
 * Crop fully-transparent margins from PNG bytes (DocuSeal find_trim / crop_canvas).
 * Used at burn-in so saved/uploaded signatures with padding still sit on the line.
 */

import { deflateSync, inflateSync } from "node:zlib";

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function writeUint32(view: Uint8Array, offset: number, value: number): void {
  view[offset] = (value >>> 24) & 0xff;
  view[offset + 1] = (value >>> 16) & 0xff;
  view[offset + 2] = (value >>> 8) & 0xff;
  view[offset + 3] = value & 0xff;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(4 + 4 + data.length + 4);
  writeUint32(out, 0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcBuf = new Uint8Array(typeBytes.length + data.length);
  crcBuf.set(typeBytes, 0);
  crcBuf.set(data, typeBytes.length);
  writeUint32(out, 8 + data.length, crc32(crcBuf));
  return out;
}

function decodePngRgba(
  png: Uint8Array
): { width: number; height: number; rgba: Uint8Array } | null {
  if (
    png.length < 8 ||
    png[0] !== 0x89 ||
    png[1] !== 0x50 ||
    png[2] !== 0x4e ||
    png[3] !== 0x47
  ) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  const idatParts: Uint8Array[] = [];

  while (offset + 8 <= png.length) {
    const length = readUint32(png, offset);
    const type = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) return null;
    const data = png.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      if (data.length < 13) return null;
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  // Only 8-bit RGBA or RGB (+ optional tRNS handled as opaque RGB)
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || width <= 0 || height <= 0) {
    return null;
  }

  const compressedLength = idatParts.reduce((n, p) => n + p.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let w = 0;
  for (const part of idatParts) {
    compressed.set(part, w);
    w += part.length;
  }

  let inflated: Uint8Array;
  try {
    inflated = inflateSync(compressed);
  } catch {
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (inflated.length < expected) return null;

  const rgba = new Uint8Array(width * height * 4);
  let src = 0;
  let dst = 0;
  const prev = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = inflated[src++]!;
    const row = inflated.subarray(src, src + stride);
    src += stride;
    const recon = new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const x = row[i]!;
      const a = i >= channels ? recon[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (x + pr) & 0xff;
      } else if (filter !== 0) {
        return null;
      }
      recon[i] = val;
    }

    if (colorType === 6) {
      rgba.set(recon, dst);
      dst += stride;
    } else {
      for (let i = 0; i < width; i++) {
        const si = i * 3;
        rgba[dst++] = recon[si]!;
        rgba[dst++] = recon[si + 1]!;
        rgba[dst++] = recon[si + 2]!;
        rgba[dst++] = 255;
      }
    }
    prev.set(recon);
  }

  return { width, height, rgba };
}

function encodePngRgba(
  width: number,
  height: number,
  rgba: Uint8Array
): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", deflateSync(raw));
  const iendChunk = chunk("IEND", new Uint8Array(0));

  const out = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let o = 0;
  out.set(signature, o);
  o += signature.length;
  out.set(ihdrChunk, o);
  o += ihdrChunk.length;
  out.set(idatChunk, o);
  o += idatChunk.length;
  out.set(iendChunk, o);
  return out;
}

/**
 * Returns a cropped PNG (transparent margins removed). If decode fails, returns input.
 */
export function trimTransparentPng(png: Uint8Array): Uint8Array {
  const decoded = decodePngRgba(png);
  if (!decoded) return png;

  const { width, height, rgba } = decoded;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3] ?? 0;
      if (alpha !== 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom < 0 || right < 0) return png;
  if (top === 0 && left === 0 && bottom === height - 1 && right === width - 1) {
    return png;
  }

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const cropped = new Uint8Array(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const src = ((top + y) * width + left) * 4;
    cropped.set(rgba.subarray(src, src + cropW * 4), y * cropW * 4);
  }

  return encodePngRgba(cropW, cropH, cropped);
}
