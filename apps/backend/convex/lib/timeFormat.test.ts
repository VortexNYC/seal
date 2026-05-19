import { describe, expect, test } from "vitest";

import { formatDurationMs } from "./timeFormat";

describe("formatDurationMs", () => {
  test("returns milliseconds for sub-second durations", () => {
    expect(formatDurationMs(250)).toBe("250ms");
    expect(formatDurationMs(0)).toBe("0ms");
    expect(formatDurationMs(999)).toBe("999ms");
  });

  test("returns seconds for durations under a minute", () => {
    expect(formatDurationMs(1000)).toBe("1s");
    expect(formatDurationMs(12_000)).toBe("12s");
    expect(formatDurationMs(59_000)).toBe("59s");
  });

  test("returns minutes and seconds for durations under an hour", () => {
    expect(formatDurationMs(60_000)).toBe("1m");
    expect(formatDurationMs(90_000)).toBe("1m 30s");
    expect(formatDurationMs(330_000)).toBe("5m 30s");
    expect(formatDurationMs(3_599_000)).toBe("59m 59s");
  });

  test("returns hours and minutes for durations of an hour or more", () => {
    expect(formatDurationMs(3_600_000)).toBe("1h");
    expect(formatDurationMs(8_100_000)).toBe("2h 15m");
    expect(formatDurationMs(72_000_000)).toBe("20h");
    expect(formatDurationMs(86_399_000)).toBe("23h 59m");
  });

  test("clamps negative values to 0ms", () => {
    expect(formatDurationMs(-1)).toBe("0ms");
    expect(formatDurationMs(-500)).toBe("0ms");
  });
});
