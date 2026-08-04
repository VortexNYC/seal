import { describe, expect, test } from "vitest";

import { getBucket, msToHumanReadable } from "../analytics_queries";
import type { TimingBucket } from "../analytics_queries";

// ─── msToHumanReadable ──────────────────────────

describe("msToHumanReadable", () => {
  test("returns dash for negative values", () => {
    expect(msToHumanReadable(-1)).toBe("—");
    expect(msToHumanReadable(-1000)).toBe("—");
  });

  test("returns 0m for zero", () => {
    expect(msToHumanReadable(0)).toBe("0m");
  });

  test("returns minutes for sub-hour durations", () => {
    // 5 minutes
    expect(msToHumanReadable(5 * 60 * 1000)).toBe("5m");
    // 30 minutes
    expect(msToHumanReadable(30 * 60 * 1000)).toBe("30m");
    // 59 minutes
    expect(msToHumanReadable(59 * 60 * 1000)).toBe("59m");
  });

  test("returns hours for sub-day durations", () => {
    // 1 hour
    expect(msToHumanReadable(1 * 60 * 60 * 1000)).toBe("1h");
    // 6 hours
    expect(msToHumanReadable(6 * 60 * 60 * 1000)).toBe("6h");
    // 23 hours
    expect(msToHumanReadable(23 * 60 * 60 * 1000)).toBe("23h");
  });

  test("returns days for 24h+ durations", () => {
    // 1 day
    expect(msToHumanReadable(24 * 60 * 60 * 1000)).toBe("1.0d");
    // 2.5 days
    expect(msToHumanReadable(60 * 60 * 60 * 1000)).toBe("2.5d");
    // 7 days
    expect(msToHumanReadable(7 * 24 * 60 * 60 * 1000)).toBe("7.0d");
  });

  test("rounds minutes correctly", () => {
    // 90 seconds = 1.5 min → rounds to 2m
    expect(msToHumanReadable(90 * 1000)).toBe("2m");
    // 30 seconds = 0.5 min → rounds to 1m (Math.round of 0.5 = 1)
    expect(msToHumanReadable(30 * 1000)).toBe("1m");
  });

  test("rounds hours correctly", () => {
    // 1.5 hours → 2h
    expect(msToHumanReadable(1.5 * 60 * 60 * 1000)).toBe("2h");
    // 23.7 hours → 24h (rounds to 24, but 24 >= 24 so it falls to days)
    // Actually 23.7 < 24, so it stays in hours: Math.round(23.7) = 24
    expect(msToHumanReadable(23.7 * 60 * 60 * 1000)).toBe("24h");
  });
});

// ─── getBucket ─────────────────────────────────

describe("getBucket", () => {
  const HOUR = 60 * 60 * 1000;

  test("returns <1h for sub-hour durations", () => {
    expect(getBucket(0)).toBe("<1h");
    expect(getBucket(30 * 60 * 1000)).toBe("<1h"); // 30 min
    expect(getBucket(59 * 60 * 1000)).toBe("<1h"); // 59 min
  });

  test("returns 1-6h for 1-6 hour durations", () => {
    expect(getBucket(1 * HOUR)).toBe("1-6h");
    expect(getBucket(3 * HOUR)).toBe("1-6h");
    expect(getBucket(5.9 * HOUR)).toBe("1-6h");
  });

  test("returns 6-24h for 6-24 hour durations", () => {
    expect(getBucket(6 * HOUR)).toBe("6-24h");
    expect(getBucket(12 * HOUR)).toBe("6-24h");
    expect(getBucket(23 * HOUR)).toBe("6-24h");
  });

  test("returns 1-3d for 1-3 day durations", () => {
    expect(getBucket(24 * HOUR)).toBe("1-3d");
    expect(getBucket(48 * HOUR)).toBe("1-3d");
    expect(getBucket(71 * HOUR)).toBe("1-3d");
  });

  test("returns 3-7d for 3-7 day durations", () => {
    expect(getBucket(72 * HOUR)).toBe("3-7d");
    expect(getBucket(120 * HOUR)).toBe("3-7d"); // 5 days
    expect(getBucket(167 * HOUR)).toBe("3-7d");
  });

  test("returns 7d+ for 7+ day durations", () => {
    expect(getBucket(168 * HOUR)).toBe("7d+"); // 7 days
    expect(getBucket(336 * HOUR)).toBe("7d+"); // 14 days
    expect(getBucket(720 * HOUR)).toBe("7d+"); // 30 days
  });

  test("covers all bucket types", () => {
    const buckets: TimingBucket[] = [
      "<1h",
      "1-6h",
      "6-24h",
      "1-3d",
      "3-7d",
      "7d+",
    ];
    const testValues = [
      0,
      2 * HOUR,
      12 * HOUR,
      48 * HOUR,
      120 * HOUR,
      200 * HOUR,
    ];

    for (let i = 0; i < testValues.length; i++) {
      expect(getBucket(testValues[i])).toBe(buckets[i]);
    }
  });

  test("boundary values fall into the correct next bucket", () => {
    // Exactly at boundary should fall into the next bucket
    expect(getBucket(1 * HOUR)).toBe("1-6h"); // exactly 1h → 1-6h
    expect(getBucket(6 * HOUR)).toBe("6-24h"); // exactly 6h → 6-24h
    expect(getBucket(24 * HOUR)).toBe("1-3d"); // exactly 24h → 1-3d
    expect(getBucket(72 * HOUR)).toBe("3-7d"); // exactly 72h → 3-7d
    expect(getBucket(168 * HOUR)).toBe("7d+"); // exactly 168h → 7d+
  });
});
