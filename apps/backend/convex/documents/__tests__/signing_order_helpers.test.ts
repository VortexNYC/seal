import { describe, expect, test } from "vitest";

import type { Doc, Id } from "../../_generated/dataModel";
import {
  findFirstIncompleteGroup,
  getNextPendingGroup,
  groupRecipientsByOrder,
  isRecipientGroupActive,
} from "../recipient_helpers";

// ---------------------------------------------------------------------------
// Factory helper — creates minimal mock recipient docs for testing
// ---------------------------------------------------------------------------
let idCounter = 0;
function makeRecipient(
  overrides: Partial<Doc<"document_recipients">> & {
    order?: number;
    status?: Doc<"document_recipients">["status"];
  } = {}
): Doc<"document_recipients"> {
  idCounter++;
  return {
    _id: `recipient_${idCounter}` as Id<"document_recipients">,
    _creationTime: Date.now(),
    documentId: "doc_1" as Id<"documents">,
    email: `user${idCounter}@test.com`,
    name: `User ${idCounter}`,
    role: "signer",
    status: "pending",
    order: 0,
    signingToken: `token-${idCounter}`,
    tokenExpiresAt: Date.now() + 86_400_000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Doc<"document_recipients">;
}

// ---------------------------------------------------------------------------
// groupRecipientsByOrder
// ---------------------------------------------------------------------------
describe("groupRecipientsByOrder", () => {
  test("groups recipients by their order value", () => {
    const recipients = [
      makeRecipient({ order: 1 }),
      makeRecipient({ order: 2 }),
      makeRecipient({ order: 1 }),
    ];

    const groups = groupRecipientsByOrder(recipients);

    expect(groups.size).toBe(2);
    expect(groups.get(1)?.length).toBe(2);
    expect(groups.get(2)?.length).toBe(1);
  });

  test("treats undefined order as 0", () => {
    const recipients = [
      makeRecipient({ order: undefined }),
      makeRecipient({ order: 0 }),
      makeRecipient({ order: 1 }),
    ];

    const groups = groupRecipientsByOrder(recipients);

    expect(groups.size).toBe(2);
    expect(groups.get(0)?.length).toBe(2);
    expect(groups.get(1)?.length).toBe(1);
  });

  test("returns groups sorted ascending by order", () => {
    const recipients = [
      makeRecipient({ order: 3 }),
      makeRecipient({ order: 1 }),
      makeRecipient({ order: 2 }),
    ];

    const groups = groupRecipientsByOrder(recipients);
    const keys = [...groups.keys()];

    expect(keys).toEqual([1, 2, 3]);
  });

  test("returns empty map for empty recipient list", () => {
    const groups = groupRecipientsByOrder([]);
    expect(groups.size).toBe(0);
  });

  test("handles single recipient", () => {
    const groups = groupRecipientsByOrder([makeRecipient({ order: 5 })]);
    expect(groups.size).toBe(1);
    expect(groups.get(5)?.length).toBe(1);
  });

  test("handles all recipients in same order group", () => {
    const recipients = [
      makeRecipient({ order: 1 }),
      makeRecipient({ order: 1 }),
      makeRecipient({ order: 1 }),
    ];

    const groups = groupRecipientsByOrder(recipients);
    expect(groups.size).toBe(1);
    expect(groups.get(1)?.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isRecipientGroupActive
// ---------------------------------------------------------------------------
describe("isRecipientGroupActive", () => {
  test("returns true when no previous groups exist (order 0)", () => {
    const recipient = makeRecipient({ order: 0 });
    const all = [recipient, makeRecipient({ order: 1 })];

    expect(isRecipientGroupActive(recipient, all)).toBe(true);
  });

  test("returns true when all previous groups are in terminal state", () => {
    const prev1 = makeRecipient({ order: 1, status: "signed" });
    const prev2 = makeRecipient({ order: 1, status: "approved" });
    const current = makeRecipient({ order: 2, status: "pending" });

    expect(isRecipientGroupActive(current, [prev1, prev2, current])).toBe(true);
  });

  test("returns false when a previous recipient is still pending", () => {
    const prev = makeRecipient({ order: 1, status: "pending" });
    const current = makeRecipient({ order: 2, status: "pending" });

    expect(isRecipientGroupActive(current, [prev, current])).toBe(false);
  });

  test("returns false when a previous recipient has only viewed", () => {
    const prev = makeRecipient({ order: 1, status: "viewed", role: "signer" });
    const current = makeRecipient({ order: 2, status: "pending" });

    expect(isRecipientGroupActive(current, [prev, current])).toBe(false);
  });

  test("treats declined as terminal (allows next group to proceed)", () => {
    const prev = makeRecipient({ order: 1, status: "declined" });
    const current = makeRecipient({ order: 2, status: "pending" });

    expect(isRecipientGroupActive(current, [prev, current])).toBe(true);
  });

  test("checks all previous groups, not just the immediately preceding one", () => {
    const group1 = makeRecipient({ order: 1, status: "signed" });
    const group2 = makeRecipient({ order: 2, status: "pending" }); // Not terminal!
    const group3 = makeRecipient({ order: 3, status: "pending" });

    expect(isRecipientGroupActive(group3, [group1, group2, group3])).toBe(
      false
    );
  });

  test("handles recipient with undefined order (treated as 0)", () => {
    const recipient = makeRecipient({ order: undefined });
    const all = [recipient, makeRecipient({ order: 1 })];

    expect(isRecipientGroupActive(recipient, all)).toBe(true);
  });

  test("handles mixed terminal states in previous group", () => {
    const prev1 = makeRecipient({ order: 1, status: "signed" });
    const prev2 = makeRecipient({ order: 1, status: "declined" });
    const current = makeRecipient({ order: 2, status: "pending" });

    // Both are terminal, so group 2 is active
    expect(isRecipientGroupActive(current, [prev1, prev2, current])).toBe(true);
  });

  test("returns false when one of multiple previous recipients is not terminal", () => {
    const prev1 = makeRecipient({ order: 1, status: "signed" });
    const prev2 = makeRecipient({ order: 1, status: "pending" });
    const current = makeRecipient({ order: 2, status: "pending" });

    expect(isRecipientGroupActive(current, [prev1, prev2, current])).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// findFirstIncompleteGroup
// ---------------------------------------------------------------------------
describe("findFirstIncompleteGroup", () => {
  test("returns first group with non-terminal recipients", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2 = makeRecipient({ order: 2, status: "pending" });
    const r3 = makeRecipient({ order: 3, status: "pending" });

    const result = findFirstIncompleteGroup([r1, r2, r3]);

    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r2._id);
  });

  test("returns empty array when all groups are complete", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2 = makeRecipient({
      order: 2,
      status: "approved",
      role: "approver",
    });

    const result = findFirstIncompleteGroup([r1, r2]);
    expect(result).toEqual([]);
  });

  test("returns all recipients in the first incomplete group", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2a = makeRecipient({ order: 2, status: "pending" });
    const r2b = makeRecipient({ order: 2, status: "pending" });

    const result = findFirstIncompleteGroup([r1, r2a, r2b]);
    expect(result.length).toBe(2);
  });

  test("returns first group when it is incomplete", () => {
    const r1 = makeRecipient({ order: 1, status: "pending" });
    const r2 = makeRecipient({ order: 2, status: "pending" });

    const result = findFirstIncompleteGroup([r1, r2]);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r1._id);
  });

  test("returns empty array for empty recipient list", () => {
    expect(findFirstIncompleteGroup([])).toEqual([]);
  });

  test("treats declined as terminal (skips group with all declined)", () => {
    const r1 = makeRecipient({ order: 1, status: "declined" });
    const r2 = makeRecipient({ order: 2, status: "pending" });

    const result = findFirstIncompleteGroup([r1, r2]);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r2._id);
  });

  test("returns group if partially complete (one signed, one pending)", () => {
    const r1a = makeRecipient({ order: 1, status: "signed" });
    const r1b = makeRecipient({ order: 1, status: "pending" });

    const result = findFirstIncompleteGroup([r1a, r1b]);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getNextPendingGroup
// ---------------------------------------------------------------------------
describe("getNextPendingGroup", () => {
  test("returns pending recipients in the next group after completed order", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2 = makeRecipient({ order: 2, status: "pending" });
    const r3 = makeRecipient({ order: 3, status: "pending" });

    const result = getNextPendingGroup([r1, r2, r3], 1);

    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r2._id);
  });

  test("returns empty array when no groups remain after completed order", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });

    const result = getNextPendingGroup([r1], 1);
    expect(result).toEqual([]);
  });

  test("skips groups that have no pending recipients", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2 = makeRecipient({ order: 2, status: "signed" }); // Already done
    const r3 = makeRecipient({ order: 3, status: "pending" });

    const result = getNextPendingGroup([r1, r2, r3], 1);

    // Should skip group 2 (no pending) and return group 3
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r3._id);
  });

  test("returns multiple pending recipients from the same group", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2a = makeRecipient({ order: 2, status: "pending" });
    const r2b = makeRecipient({ order: 2, status: "pending" });

    const result = getNextPendingGroup([r1, r2a, r2b], 1);
    expect(result.length).toBe(2);
  });

  test("only returns pending recipients from the next group (not signed ones)", () => {
    const r1 = makeRecipient({ order: 1, status: "signed" });
    const r2a = makeRecipient({ order: 2, status: "signed" });
    const r2b = makeRecipient({ order: 2, status: "pending" });

    const result = getNextPendingGroup([r1, r2a, r2b], 1);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe(r2b._id);
  });

  test("returns empty array for empty recipient list", () => {
    expect(getNextPendingGroup([], 0)).toEqual([]);
  });
});
