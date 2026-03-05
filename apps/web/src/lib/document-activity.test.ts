import { describe, expect, test } from "vitest";

import { buildActivityEvents } from "./document-activity";

const BASE_TIME = 1_700_000_000_000; // fixed reference point

describe("buildActivityEvents", () => {
  test("returns a 'created' event from document data", () => {
    const events = buildActivityEvents({ name: "NDA", createdAt: BASE_TIME }, []);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].description).toContain("NDA");
    expect(events[0].timestamp).toBe(BASE_TIME);
  });

  test("adds recipient_added event for each recipient", () => {
    const events = buildActivityEvents({ name: "NDA", createdAt: BASE_TIME }, [
      { email: "alice@test.com", name: "Alice", role: "signer", createdAt: BASE_TIME + 1000 },
      { email: "bob@test.com", name: "Bob", role: "viewer", createdAt: BASE_TIME + 2000 },
    ]);
    const added = events.filter((e) => e.type === "recipient_added");
    expect(added).toHaveLength(2);
    expect(added[0].description).toContain("Bob");
    expect(added[0].description).toContain("viewer");
    expect(added[1].description).toContain("Alice");
    expect(added[1].description).toContain("signer");
  });

  test("falls back to email when name is null/undefined", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      { email: "noname@test.com", name: null, role: "signer", createdAt: BASE_TIME + 1000 },
    ]);
    const added = events.find((e) => e.type === "recipient_added");
    expect(added?.description).toContain("noname@test.com");
  });

  test("includes viewed event when viewedAt is set", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        viewedAt: BASE_TIME + 5000,
      },
    ]);
    const viewed = events.find((e) => e.type === "viewed");
    expect(viewed).toBeDefined();
    expect(viewed?.description).toContain("Alice");
    expect(viewed?.timestamp).toBe(BASE_TIME + 5000);
  });

  test("includes signed event when signedAt is set", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        signedAt: BASE_TIME + 10000,
      },
    ]);
    const signed = events.find((e) => e.type === "signed");
    expect(signed).toBeDefined();
    expect(signed?.description).toContain("Alice");
  });

  test("includes approved event when approvedAt is set", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "approver",
        createdAt: BASE_TIME + 1000,
        approvedAt: BASE_TIME + 8000,
      },
    ]);
    expect(events.find((e) => e.type === "approved")).toBeDefined();
  });

  test("includes declined event when declinedAt is set", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        declinedAt: BASE_TIME + 6000,
      },
    ]);
    const declined = events.find((e) => e.type === "declined");
    expect(declined).toBeDefined();
    expect(declined?.description).toContain("declined");
  });

  test("does NOT include viewed/signed/approved/declined when timestamps are null", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        viewedAt: null,
        signedAt: null,
        approvedAt: null,
        declinedAt: null,
      },
    ]);
    expect(events.filter((e) => e.type === "viewed")).toHaveLength(0);
    expect(events.filter((e) => e.type === "signed")).toHaveLength(0);
    expect(events.filter((e) => e.type === "approved")).toHaveLength(0);
    expect(events.filter((e) => e.type === "declined")).toHaveLength(0);
  });

  test("sorts events newest-first", () => {
    const events = buildActivityEvents({ name: "Doc", createdAt: BASE_TIME }, [
      {
        email: "a@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        viewedAt: BASE_TIME + 5000,
        signedAt: BASE_TIME + 10000,
      },
    ]);
    const timestamps = events.map((e) => e.timestamp);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  test("full lifecycle produces correct event count and order", () => {
    const events = buildActivityEvents({ name: "Contract", createdAt: BASE_TIME }, [
      {
        email: "alice@test.com",
        name: "Alice",
        role: "signer",
        createdAt: BASE_TIME + 1000,
        viewedAt: BASE_TIME + 5000,
        signedAt: BASE_TIME + 10000,
      },
      {
        email: "bob@test.com",
        name: "Bob",
        role: "signer",
        createdAt: BASE_TIME + 2000,
        viewedAt: BASE_TIME + 7000,
        signedAt: BASE_TIME + 15000,
      },
    ]);
    // 1 created + 2 recipient_added + 2 viewed + 2 signed = 7
    expect(events).toHaveLength(7);
    // Most recent event should be Bob's signing
    expect(events[0].type).toBe("signed");
    expect(events[0].description).toContain("Bob");
    // Oldest event should be document creation
    expect(events[events.length - 1].type).toBe("created");
  });
});
