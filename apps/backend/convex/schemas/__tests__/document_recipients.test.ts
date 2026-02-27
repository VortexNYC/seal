import { describe, expect, test } from "vitest";

import {
  isRecipientComplete,
  isRecipientTerminal,
  getRecipientRoleLabel,
  getRecipientStatusLabel,
} from "../document_recipients";

describe("isRecipientComplete", () => {
  test("signer is complete only when signed", () => {
    expect(isRecipientComplete("signer", "signed")).toBe(true);
    expect(isRecipientComplete("signer", "pending")).toBe(false);
    expect(isRecipientComplete("signer", "viewed")).toBe(false);
  });

  test("approver is complete only when approved", () => {
    expect(isRecipientComplete("approver", "approved")).toBe(true);
    expect(isRecipientComplete("approver", "signed")).toBe(false);
  });

  test("viewer is complete only when viewed", () => {
    expect(isRecipientComplete("viewer", "viewed")).toBe(true);
    expect(isRecipientComplete("viewer", "pending")).toBe(false);
  });
});

describe("isRecipientTerminal", () => {
  test("signed, approved, and declined are terminal", () => {
    expect(isRecipientTerminal("signed")).toBe(true);
    expect(isRecipientTerminal("approved")).toBe(true);
    expect(isRecipientTerminal("declined")).toBe(true);
  });

  test("pending and viewed are not terminal", () => {
    expect(isRecipientTerminal("pending")).toBe(false);
    expect(isRecipientTerminal("viewed")).toBe(false);
  });
});

describe("getRecipientRoleLabel", () => {
  test("returns correct labels for all roles", () => {
    expect(getRecipientRoleLabel("signer")).toBe("Signer");
    expect(getRecipientRoleLabel("viewer")).toBe("Viewer");
    expect(getRecipientRoleLabel("approver")).toBe("Approver");
  });
});

describe("getRecipientStatusLabel", () => {
  test("returns correct labels for all statuses", () => {
    expect(getRecipientStatusLabel("pending")).toBe("Pending");
    expect(getRecipientStatusLabel("viewed")).toBe("Viewed");
    expect(getRecipientStatusLabel("signed")).toBe("Signed");
    expect(getRecipientStatusLabel("approved")).toBe("Approved");
    expect(getRecipientStatusLabel("declined")).toBe("Declined");
  });
});
