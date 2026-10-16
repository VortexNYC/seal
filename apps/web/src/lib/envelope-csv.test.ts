import { describe, expect, it } from "vitest";

import { envelopeCsv, envelopeCsvFilename } from "./envelope-csv";

describe("envelopeCsv", () => {
  it("writes one row per recipient and escapes commas", () => {
    const csv = envelopeCsv({
      document: {
        name: "Offer, final",
        workflowStatus: "sent",
        sentAt: Date.parse("2026-10-16T12:00:00.000Z"),
        deadline: null,
      },
      recipients: [
        {
          name: "Ada",
          email: "ada@example.com",
          role: "signer",
          status: "signed",
          signedAt: Date.parse("2026-10-16T13:00:00.000Z"),
        },
      ],
    });

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain('"Offer, final"');
    expect(csv).toContain("ada@example.com");
    expect(csv).toContain("2026-10-16T13:00:00.000Z");
  });

  it("still emits the document when nobody is on it", () => {
    const csv = envelopeCsv({
      document: { name: "Draft", workflowStatus: "draft" },
      recipients: [],
    });
    expect(csv).toContain("Draft,draft,,,");
  });

  it("names the file from the document", () => {
    expect(envelopeCsvFilename("Offer, final")).toBe("offer-final.csv");
    expect(envelopeCsvFilename("...")).toBe("envelope.csv");
  });
});
