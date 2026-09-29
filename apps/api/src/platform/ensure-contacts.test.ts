import { describe, expect, it } from "vitest";

import { splitRecipientName } from "./ensure-contacts.js";

describe("splitRecipientName", () => {
  it("splits a full name", () => {
    expect(splitRecipientName("Ada Lovelace", "ada@example.com")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
    });
  });

  it("falls back to email local-part", () => {
    expect(splitRecipientName(null, "bob@example.com")).toEqual({
      firstName: "bob",
      lastName: "",
      fullName: "bob",
    });
  });
});
