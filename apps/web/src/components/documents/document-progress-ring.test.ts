import { describe, expect, it } from "vitest";

import { progressStatColumns, progressStats } from "./document-progress-ring";

const progress = {
  percentComplete: 100,
  byStatus: { signed: 1, pending: 0, viewed: 0, declined: 0 },
};

describe("progress stats", () => {
  it("keeps signed, pending, and viewed on one row", () => {
    const stats = progressStats(progress);
    expect(stats.map((stat) => stat.label)).toEqual([
      "Signed",
      "Pending",
      "Viewed",
    ]);
    expect(progressStatColumns(stats.length)).toBe(3);
  });

  it("adds declined as a full second row", () => {
    const stats = progressStats({
      ...progress,
      byStatus: { ...progress.byStatus, declined: 1 },
    });
    expect(stats.map((stat) => stat.label)).toEqual([
      "Signed",
      "Pending",
      "Viewed",
      "Declined",
    ]);
    expect(progressStatColumns(stats.length)).toBe(2);
  });
});
