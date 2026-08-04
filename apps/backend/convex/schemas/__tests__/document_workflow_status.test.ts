import { describe, expect, test } from "vitest";

import {
  isValidWorkflowTransition,
  getWorkflowStatusLabel,
  WORKFLOW_TRANSITIONS,
} from "../document_workflow_status";
import type { DocumentWorkflowStatus } from "../document_workflow_status";

const ALL_STATUSES: DocumentWorkflowStatus[] = [
  "draft",
  "sent",
  "in_progress",
  "waiting_for_payment",
  "completed",
  "cancelled",
  "declined",
  "expired",
];

describe("WORKFLOW_TRANSITIONS", () => {
  test("covers all 8 statuses as keys", () => {
    const keys = Object.keys(WORKFLOW_TRANSITIONS);
    expect(keys).toHaveLength(8);
    for (const status of ALL_STATUSES) {
      expect(WORKFLOW_TRANSITIONS).toHaveProperty(status);
    }
  });
});

describe("isValidWorkflowTransition", () => {
  describe("valid transitions", () => {
    const validCases: [DocumentWorkflowStatus, DocumentWorkflowStatus][] = [
      ["draft", "sent"],
      ["draft", "cancelled"],
      ["sent", "in_progress"],
      ["sent", "cancelled"],
      ["sent", "declined"],
      ["in_progress", "completed"],
      ["in_progress", "waiting_for_payment"],
      ["in_progress", "cancelled"],
      ["in_progress", "declined"],
      ["waiting_for_payment", "completed"],
      ["waiting_for_payment", "cancelled"],
      ["sent", "expired"],
      ["in_progress", "expired"],
      ["expired", "sent"],
    ];

    test.each(validCases)("%s -> %s is valid", (from, to) => {
      expect(isValidWorkflowTransition(from, to)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    const invalidCases: [DocumentWorkflowStatus, DocumentWorkflowStatus][] = [
      ["draft", "completed"],
      ["draft", "in_progress"],
      ["draft", "declined"],
      ["draft", "waiting_for_payment"],
      ["sent", "draft"],
      ["sent", "completed"],
      ["sent", "waiting_for_payment"],
      ["in_progress", "draft"],
      ["in_progress", "sent"],
      ["waiting_for_payment", "draft"],
      ["waiting_for_payment", "sent"],
      ["waiting_for_payment", "declined"],
      ["completed", "draft"],
      ["completed", "sent"],
      ["completed", "cancelled"],
      ["cancelled", "sent"],
      ["cancelled", "draft"],
      ["cancelled", "completed"],
      ["declined", "sent"],
      ["declined", "draft"],
      ["declined", "completed"],
      ["expired", "draft"],
      ["expired", "completed"],
      ["expired", "cancelled"],
    ];

    test.each(invalidCases)("%s -> %s is invalid", (from, to) => {
      expect(isValidWorkflowTransition(from, to)).toBe(false);
    });
  });

  describe("terminal states have no valid transitions", () => {
    const terminalStatuses: DocumentWorkflowStatus[] = [
      "completed",
      "cancelled",
      "declined",
    ];

    test.each(terminalStatuses)(
      "%s has no valid outgoing transitions",
      (terminal) => {
        expect(WORKFLOW_TRANSITIONS[terminal]).toEqual([]);
        for (const target of ALL_STATUSES) {
          expect(isValidWorkflowTransition(terminal, target)).toBe(false);
        }
      }
    );
  });
});

describe("getWorkflowStatusLabel", () => {
  const labelCases: [DocumentWorkflowStatus, string][] = [
    ["draft", "Draft"],
    ["sent", "Sent"],
    ["in_progress", "In Progress"],
    ["waiting_for_payment", "Awaiting Payment"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
    ["declined", "Declined"],
    ["expired", "Expired"],
  ];

  test.each(labelCases)(
    'returns "%s" for status "%s"',
    (status, expectedLabel) => {
      expect(getWorkflowStatusLabel(status)).toBe(expectedLabel);
    }
  );

  test("returns a non-empty string for every status", () => {
    for (const status of ALL_STATUSES) {
      const label = getWorkflowStatusLabel(status);
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
    }
  });
});
