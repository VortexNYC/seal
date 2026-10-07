import { describe, expect, it } from "vitest";

import {
  documentHeaderAction,
  listRowDate,
  recipientFacingStatus,
  recipientMarkClass,
  signedPdfFilename,
  signerProgressLine,
  toWorkflowStatus,
} from "./document-status";

describe("workflow status", () => {
  it("reads an agent void as cancelled", () => {
    expect(toWorkflowStatus("voided")).toBe("cancelled");
    expect(toWorkflowStatus("cancelled")).toBe("cancelled");
    expect(toWorkflowStatus("sent")).toBe("sent");
  });

  it("stops showing open recipients as still waiting after a void", () => {
    expect(recipientFacingStatus("cancelled", "pending")).toBe("voided");
    expect(recipientFacingStatus("cancelled", "viewed")).toBe("voided");
    expect(recipientFacingStatus("cancelled", "signed")).toBe("signed");
    expect(recipientFacingStatus("cancelled", "declined")).toBe("declined");
    expect(recipientFacingStatus("sent", "pending")).toBe("pending");
  });

  it("offers the signed file once the envelope is finished", () => {
    expect(documentHeaderAction("completed")).toBe("download");
    expect(documentHeaderAction("sent")).toBe("send");
    expect(documentHeaderAction("draft")).toBe("send");
    expect(documentHeaderAction(undefined)).toBe("send");
    expect(signedPdfFilename("seal-markup.pdf")).toBe("seal-markup.pdf");
    expect(signedPdfFilename("Offer")).toBe("Offer.pdf");
    expect(signedPdfFilename("  ")).toBe("document.pdf");
  });

  it("says who the list row is waiting on", () => {
    const progress = { signed: 1, total: 3, waitingOn: "Alex Chen" };
    expect(signerProgressLine("sent", progress)).toBe(
      "Alex Chen · 1 of 3 signed"
    );
    expect(signerProgressLine("draft", progress)).toBe("3 signers");
    expect(signerProgressLine("completed", progress)).toBe("1 of 3 signed");
    expect(signerProgressLine("declined", progress)).toBe(
      "Declined by Alex Chen"
    );
    expect(signerProgressLine("cancelled", progress)).toBeNull();
    expect(signerProgressLine("sent", null)).toBeNull();
  });

  it("shows the sent date once a document has gone out, and the deadline while it is open", () => {
    const now = Date.parse("2026-10-06T12:00:00Z");
    expect(
      listRowDate({
        status: "draft",
        createdAt: 1,
        sentAt: null,
        deadline: 5,
        now,
      })
    ).toEqual({ at: 1, sent: false, dueAt: null, overdue: false });
    expect(
      listRowDate({
        status: "sent",
        createdAt: 1,
        sentAt: 2,
        deadline: now - 1,
        now,
      })
    ).toEqual({ at: 2, sent: true, dueAt: now - 1, overdue: true });
    expect(
      listRowDate({
        status: "completed",
        createdAt: 1,
        sentAt: 2,
        deadline: now - 1,
        now,
      }).dueAt
    ).toBeNull();
  });

  it("keeps signed and viewed in the same ink as the rest of the rail", () => {
    expect(recipientMarkClass("signed")).toBe(recipientMarkClass("viewed"));
    expect(recipientMarkClass("pending")).toBe(recipientMarkClass("signed"));
    expect(recipientMarkClass("declined")).not.toBe(recipientMarkClass("signed"));
  });
});