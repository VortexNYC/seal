import { describe, expect, test } from "vitest";

import { formatSlackMessage } from "../slack_formatter";

type SlackBlock = ReturnType<typeof formatSlackMessage>["blocks"][number];
type SlackSectionBlock = Extract<SlackBlock, { type: "section" }>;
type SlackContextBlock = Extract<SlackBlock, { type: "context" }>;

function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function expectSectionBlock(block: SlackBlock | undefined): SlackSectionBlock {
  const present = sealAssertPresent(block);
  expect(present.type).toBe("section");
  if (present.type !== "section") {
    throw new Error("Expected Slack section block.");
  }
  return present;
}

function expectContextBlock(block: SlackBlock | undefined): SlackContextBlock {
  const present = sealAssertPresent(block);
  expect(present.type).toBe("context");
  if (present.type !== "context") {
    throw new Error("Expected Slack context block.");
  }
  return present;
}

describe("formatSlackMessage", () => {
  // ---------------------------------------------------------------------------
  // Basic structure
  // ---------------------------------------------------------------------------
  test("returns text fallback and blocks array", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "document.sent",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: { document_title: "NDA" },
    });

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.blocks).toBeInstanceOf(Array);
    expect(result.blocks.length).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Header block contains emoji and label
  // ---------------------------------------------------------------------------
  test("header block contains emoji and human-readable label", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "document.completed",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: {},
    });

    const headerBlock = result.blocks[0];
    expect(expectSectionBlock(headerBlock).text.text).toContain(":white_check_mark:");
    expect(expectSectionBlock(headerBlock).text.text).toContain("Document Completed");
  });

  // ---------------------------------------------------------------------------
  // Document data fields
  // ---------------------------------------------------------------------------
  test("includes document title and ID in detail block", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "document.sent",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: { document_title: "Service Agreement", document_id: "doc_abc" },
    });

    const detailBlock = result.blocks[1];
    expect(expectSectionBlock(detailBlock).text.text).toContain("Service Agreement");
    expect(expectSectionBlock(detailBlock).text.text).toContain("doc_abc");
  });

  // ---------------------------------------------------------------------------
  // Recipient data fields
  // ---------------------------------------------------------------------------
  test("includes recipient name and email", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "recipient.signed",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: { recipient_name: "Jane Doe", recipient_email: "jane@example.com" },
    });

    const detailBlock = result.blocks[1];
    expect(expectSectionBlock(detailBlock).text.text).toContain("Jane Doe");
    expect(expectSectionBlock(detailBlock).text.text).toContain("jane@example.com");
  });

  // ---------------------------------------------------------------------------
  // Decline reason
  // ---------------------------------------------------------------------------
  test("includes decline reason when present", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "recipient.declined",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: { reason: "Terms unacceptable" },
    });

    const detailBlock = result.blocks[1];
    expect(expectSectionBlock(detailBlock).text.text).toContain("Terms unacceptable");
  });

  // ---------------------------------------------------------------------------
  // Context block (footer)
  // ---------------------------------------------------------------------------
  test("last block is a context block with event type and timestamp", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "document.sent",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: {},
    });

    const lastBlock = result.blocks[result.blocks.length - 1];
    const firstElement = sealAssertPresent(expectContextBlock(lastBlock).elements[0]);
    expect(firstElement.text).toContain("document.sent");
    expect(firstElement.text).toContain("Seal");
  });

  // ---------------------------------------------------------------------------
  // Unknown event type falls back gracefully
  // ---------------------------------------------------------------------------
  test("unknown event type uses bell emoji and raw type as label", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "custom.unknown_event",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: {},
    });

    const headerBlock = result.blocks[0];
    expect(expectSectionBlock(headerBlock).text.text).toContain(":bell:");
    expect(expectSectionBlock(headerBlock).text.text).toContain("custom.unknown_event");
  });

  // ---------------------------------------------------------------------------
  // Test ping event
  // ---------------------------------------------------------------------------
  test("test.ping includes message from data", () => {
    const result = formatSlackMessage({
      id: "evt_test_123",
      type: "test.ping",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: { message: "This is a test webhook from Seal" },
    });

    const headerBlock = result.blocks[0];
    expect(expectSectionBlock(headerBlock).text.text).toContain(":wave:");

    const detailBlock = result.blocks[1];
    expect(expectSectionBlock(detailBlock).text.text).toContain("This is a test webhook from Seal");
  });

  // ---------------------------------------------------------------------------
  // No data fields — only header and context blocks
  // ---------------------------------------------------------------------------
  test("event with empty data produces header and context blocks only", () => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: "document.created",
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: {},
    });

    // Header + context, no detail block
    expect(result.blocks).toHaveLength(2);
    expect(sealAssertPresent(result.blocks[0]).type).toBe("section");
    expect(sealAssertPresent(result.blocks[1]).type).toBe("context");
  });

  // ---------------------------------------------------------------------------
  // All event types have valid emoji/label mappings
  // ---------------------------------------------------------------------------
  const knownEvents = [
    "document.created",
    "document.sent",
    "document.viewed",
    "document.completed",
    "document.voided",
    "document.expired",
    "document.declined",
    "recipient.added",
    "recipient.viewed",
    "recipient.signed",
    "recipient.approved",
    "recipient.declined",
    "recipient.reminded",
    "template.created",
    "template.updated",
    "template.used",
    "test.ping",
  ];

  test.each(knownEvents)("event %s produces a valid message without bell fallback", (eventType) => {
    const result = formatSlackMessage({
      id: "evt_123",
      type: eventType,
      api_version: "2025-01-01",
      created_at: "2026-03-12T00:00:00.000Z",
      organization_id: "org_123",
      data: {},
    });

    const headerBlock = result.blocks[0];
    // Should NOT use the fallback :bell: emoji for known events
    expect(expectSectionBlock(headerBlock).text.text).not.toContain(":bell:");
  });
});
