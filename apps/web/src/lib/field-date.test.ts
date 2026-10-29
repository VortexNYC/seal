import { describe, expect, test } from "vitest";

import { calendarDate, parseCalendarDate } from "./field-date";

describe("calendarDate", () => {
  test("uses the local calendar day, not a UTC timestamp", () => {
    const evening = new Date(2026, 9, 6, 20, 43, 19);

    expect(calendarDate(evening)).toBe("2026-10-06");
  });
});

describe("parseCalendarDate", () => {
  test("reads a date prefix without shifting the day", () => {
    const date = parseCalendarDate("2026-10-06T04:00:00.000Z");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(6);
  });
});
