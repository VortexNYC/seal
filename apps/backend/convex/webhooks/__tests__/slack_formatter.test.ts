import { describe, expect, test } from "vitest";

import { formatSlackMessage } from "../slack_formatter";

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
    expect(headerBlock).toBeDefined();
    expect(headerBlock!.type).toBe("section");
    if (headerBlock!.type === "section") {
      expect(headerBlock!.text.text).toContain(":white_check_mark:");
      expect(headerBlock!.text.text).toContain("Document Completed");
    }
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
    expect(detailBlock).toBeDefined();
    if (detailBlock!.type === "section") {
      expect(detailBlock!.text.text).toContain("Service Agreement");
      expect(detailBlock!.text.text).toContain("doc_abc");
    }
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
    expect(detailBlock).toBeDefined();
    if (detailBlock!.type === "section") {
      expect(detailBlock!.text.text).toContain("Jane Doe");
      expect(detailBlock!.text.text).toContain("jane@example.com");
    }
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
    expect(detailBlock).toBeDefined();
    if (detailBlock!.type === "section") {
      expect(detailBlock!.text.text).toContain("Terms unacceptable");
    }
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
    expect(lastBlock).toBeDefined();
    expect(lastBlock!.type).toBe("context");
    if (lastBlock!.type === "context") {
      expect(lastBlock!.elements[0]!.text).toContain("document.sent");
      expect(lastBlock!.elements[0]!.text).toContain("Seal");
    }
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
    expect(headerBlock).toBeDefined();
    if (headerBlock!.type === "section") {
      expect(headerBlock!.text.text).toContain(":bell:");
      expect(headerBlock!.text.text).toContain("custom.unknown_event");
    }
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
    expect(headerBlock).toBeDefined();
    if (headerBlock!.type === "section") {
      expect(headerBlock!.text.text).toContain(":wave:");
    }

    const detailBlock = result.blocks[1];
    expect(detailBlock).toBeDefined();
    if (detailBlock!.type === "section") {
      expect(detailBlock!.text.text).toContain("This is a test webhook from Seal");
    }
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
    expect(result.blocks[0]!.type).toBe("section");
    expect(result.blocks[1]!.type).toBe("context");
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
    expect(headerBlock).toBeDefined();
    if (headerBlock!.type === "section") {
      // Should NOT use the fallback :bell: emoji for known events
      expect(headerBlock!.text.text).not.toContain(":bell:");
    }
  });
});
