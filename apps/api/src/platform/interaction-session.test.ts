import { describe, expect, it } from "vitest";

import {
  buildSigningInteraction,
  mapDocumentStatusToInteraction,
} from "./interaction-session.js";

describe("interaction-session", () => {
  it("maps document statuses", () => {
    expect(mapDocumentStatusToInteraction("sent")).toBe("pending");
    expect(mapDocumentStatusToInteraction("completed")).toBe("completed");
    expect(mapDocumentStatusToInteraction("voided")).toBe("cancelled");
    expect(mapDocumentStatusToInteraction("declined")).toBe("declined");
  });

  it("builds a signing InteractionSession", () => {
    const session = buildSigningInteraction({
      documentId: "doc_1",
      documentStatus: "sent",
      title: "NDA",
      signingUrl: "https://app.seal.nyc/sign/abc",
      expiresAt: null,
    });
    expect(session.id).toBe("sign:doc_1");
    expect(session.kind).toBe("sign");
    expect(session.status).toBe("pending");
    expect(session.url).toContain("/sign/");
    expect(session.poll.path).toContain("documents/interaction");
    expect(session.message).toContain("Sign");
  });
});
