import { afterEach, describe, expect, test, vi } from "vitest";

import {
  capitalizeFirst,
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getInitials,
  getStatusLabel,
} from "./formatting";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns 'Just now' for less than 1 minute ago", () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-23T12:00:00Z");
    vi.setSystemTime(now);

    expect(formatRelativeTime(now.getTime())).toBe("Just now");
    expect(formatRelativeTime(now.getTime() - 30_000)).toBe("Just now");
    expect(formatRelativeTime(now.getTime() - 59_999)).toBe("Just now");
  });

  test("returns minutes ago for 1-59 minutes", () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-23T12:00:00Z");
    vi.setSystemTime(now);

    expect(formatRelativeTime(now.getTime() - 60_000)).toBe("1m ago");
    expect(formatRelativeTime(now.getTime() - 5 * 60_000)).toBe("5m ago");
    expect(formatRelativeTime(now.getTime() - 59 * 60_000)).toBe("59m ago");
  });

  test("returns hours ago for 1-23 hours", () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-23T12:00:00Z");
    vi.setSystemTime(now);

    expect(formatRelativeTime(now.getTime() - 3_600_000)).toBe("1h ago");
    expect(formatRelativeTime(now.getTime() - 12 * 3_600_000)).toBe("12h ago");
    expect(formatRelativeTime(now.getTime() - 23 * 3_600_000)).toBe("23h ago");
  });

  test("returns days ago for 1-6 days", () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-23T12:00:00Z");
    vi.setSystemTime(now);

    expect(formatRelativeTime(now.getTime() - 86_400_000)).toBe("1d ago");
    expect(formatRelativeTime(now.getTime() - 3 * 86_400_000)).toBe("3d ago");
    expect(formatRelativeTime(now.getTime() - 6 * 86_400_000)).toBe("6d ago");
  });

  test("returns formatted date for 7+ days", () => {
    vi.useFakeTimers();
    const now = new Date("2026-02-23T12:00:00Z");
    vi.setSystemTime(now);

    const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
    const result = formatRelativeTime(sevenDaysAgo);
    // Should be a formatted date string like "Feb 16"
    expect(result).toMatch(/\w{3}\s+\d{1,2}/);
    expect(result).not.toContain("ago");
  });

  test("returns formatted date for timestamps far in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-23T12:00:00Z"));

    const oldDate = new Date(2025, 0, 15); // Jan 15 2025 in local timezone
    const result = formatRelativeTime(oldDate.getTime());
    expect(result).toMatch(/Jan\s+15/);
  });
});

describe("formatFileSize", () => {
  test("returns '0 Bytes' for 0", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
  });

  test("formats bytes correctly", () => {
    expect(formatFileSize(1)).toBe("1 Bytes");
    expect(formatFileSize(500)).toBe("500 Bytes");
    expect(formatFileSize(1023)).toBe("1023 Bytes");
  });

  test("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10 KB");
  });

  test("formats megabytes correctly", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  test("formats gigabytes correctly", () => {
    expect(formatFileSize(1024 ** 3)).toBe("1 GB");
    expect(formatFileSize(2.5 * 1024 ** 3)).toBe("2.5 GB");
  });

  test("rounds to 2 decimal places", () => {
    // 1234 bytes = 1.205078125 KB -> rounds to 1.21
    expect(formatFileSize(1234)).toBe("1.21 KB");
  });
});

describe("formatDate", () => {
  test("formats timestamp as full date string", () => {
    const timestamp = new Date(2026, 0, 15).getTime(); // Jan 15 2026 local
    const result = formatDate(timestamp);
    expect(result).toContain("January");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  test("formats a different date correctly", () => {
    const timestamp = new Date("2025-12-25T00:00:00Z").getTime();
    const result = formatDate(timestamp);
    expect(result).toContain("December");
    expect(result).toContain("25");
    expect(result).toContain("2025");
  });

  test("handles a known local date", () => {
    const timestamp = new Date(2024, 6, 4).getTime(); // Jul 4 2024 local
    const result = formatDate(timestamp);
    expect(result).toContain("July");
    expect(result).toContain("4");
    expect(result).toContain("2024");
  });
});

describe("getInitials", () => {
  test("returns first letters of first and last name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  test("returns first letter of single name", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  test("returns at most 2 characters for multi-word names", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  test("uppercases initials", () => {
    expect(getInitials("john doe")).toBe("JD");
  });

  test("falls back to first letter of email when no name", () => {
    expect(getInitials(undefined, "alice@example.com")).toBe("A");
    expect(getInitials("", "bob@example.com")).toBe("B");
  });

  test("returns '?' when no name and no email", () => {
    expect(getInitials()).toBe("?");
    expect(getInitials(undefined, undefined)).toBe("?");
    expect(getInitials("", undefined)).toBe("?");
    expect(getInitials("", "")).toBe("?");
  });
});

describe("capitalizeFirst", () => {
  test("capitalizes the first character", () => {
    expect(capitalizeFirst("hello")).toBe("Hello");
    expect(capitalizeFirst("Hello")).toBe("Hello");
    expect(capitalizeFirst("world")).toBe("World");
  });

  test("handles single character strings", () => {
    expect(capitalizeFirst("a")).toBe("A");
    expect(capitalizeFirst("A")).toBe("A");
  });

  test("handles empty strings", () => {
    expect(capitalizeFirst("")).toBe("");
  });

  test("does not lowercase existing uppercase letters", () => {
    expect(capitalizeFirst("hELLO")).toBe("HELLO");
    expect(capitalizeFirst("mIxEd")).toBe("MIxEd");
  });

  test("preserves leading spaces", () => {
    expect(capitalizeFirst(" hello")).toBe(" hello");
  });
});

describe("getStatusLabel", () => {
  test("maps all known statuses correctly", () => {
    expect(getStatusLabel("draft")).toBe("Draft");
    expect(getStatusLabel("sent")).toBe("Sent");
    expect(getStatusLabel("in_progress")).toBe("In Progress");
    expect(getStatusLabel("waiting_for_payment")).toBe("Awaiting Payment");
    expect(getStatusLabel("completed")).toBe("Completed");
    expect(getStatusLabel("cancelled")).toBe("Cancelled");
    expect(getStatusLabel("declined")).toBe("Declined");
  });

  test("defaults to 'Draft' when status is undefined", () => {
    expect(getStatusLabel(undefined)).toBe("Draft");
  });
});
