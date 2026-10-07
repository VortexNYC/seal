import { describe, expect, test } from "vitest";

import { calendarDate } from "@/lib/field-date";

import { signerFieldDraft } from "./field-input-manager";

const now = new Date(2026, 9, 6, 20, 30, 0);

describe("signerFieldDraft", () => {
  test("date signed starts as today so a required field can be saved", () => {
    const draft = signerFieldDraft("date_signed", undefined, undefined, now);

    expect(draft.value).toBe("2026-10-06");
    expect(draft.value).toBe(calendarDate(now));
    expect(draft.validWhenRequired).toBe(true);
  });

  test("a stored value wins over the date-signed default", () => {
    const draft = signerFieldDraft(
      "date_signed",
      "2026-01-02T00:00:00.000Z",
      undefined,
      now
    );

    expect(draft.value).toBe("2026-01-02T00:00:00.000Z");
  });

  test("a required text field starts empty and invalid", () => {
    const draft = signerFieldDraft("text", undefined, undefined, now);

    expect(draft.value).toBe("");
    expect(draft.validWhenRequired).toBe(false);
  });
});
