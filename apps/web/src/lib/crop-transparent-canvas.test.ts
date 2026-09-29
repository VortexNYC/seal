import { describe, expect, it } from "vitest";

import {
  findInkBounds,
  isEmptyPixel,
} from "./crop-transparent-canvas";

function rgba(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number]
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

describe("crop-transparent-canvas", () => {
  it("treats alpha 0 as empty and near-white when opted in", () => {
    expect(isEmptyPixel(0, 0, 0, 0)).toBe(true);
    expect(isEmptyPixel(0, 0, 0, 255)).toBe(false);
    expect(
      isEmptyPixel(255, 255, 255, 255, { treatNearWhiteAsEmpty: true })
    ).toBe(true);
    expect(
      isEmptyPixel(200, 200, 200, 255, { treatNearWhiteAsEmpty: true })
    ).toBe(false);
  });

  it("finds ink bounds ignoring transparent margins", () => {
    const pixels = rgba(10, 8, (x, y) =>
      x >= 2 && x <= 5 && y >= 1 && y <= 3 ? [0, 0, 0, 255] : [0, 0, 0, 0]
    );
    expect(findInkBounds(pixels, 10, 8)).toEqual({
      left: 2,
      top: 1,
      right: 5,
      bottom: 3,
    });
  });

  it("finds ink bounds treating white JPG paper as empty", () => {
    const pixels = rgba(8, 6, (x, y) =>
      x >= 3 && x <= 4 && y >= 2 && y <= 3
        ? [10, 10, 10, 255]
        : [255, 255, 255, 255]
    );
    expect(
      findInkBounds(pixels, 8, 6, { treatNearWhiteAsEmpty: true })
    ).toEqual({
      left: 3,
      top: 2,
      right: 4,
      bottom: 3,
    });
  });

  it("returns null when the buffer is empty", () => {
    const pixels = rgba(4, 4, () => [0, 0, 0, 0]);
    expect(findInkBounds(pixels, 4, 4)).toBeNull();
  });
});
