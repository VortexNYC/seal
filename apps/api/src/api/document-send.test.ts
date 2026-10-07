import { describe, expect, it } from "vitest";

import {
  bulkSendDocumentIds,
  documentSigningPatch,
  invitationMessage,
  nextSequentialInviteIds,
  recipientsDueInvitation,
  signingProgress,
} from "./document-send.js";

const people = [
  { id: "a", role: "signer", order: 0, status: "pending" },
  { id: "b", role: "signer", order: 1, status: "pending" },
  { id: "c", role: "viewer", order: 2, status: "pending" },
];

describe("invitation message", () => {
  it("uses a recipient note, then the default, then nothing", () => {
    expect(
      invitationMessage("rec_1", {
        recipientMessages: { rec_1: " For you " },
        defaultMessage: "For everyone",
      })
    ).toBe("For you");
    expect(
      invitationMessage("rec_2", {
        recipientMessages: { rec_1: "For you" },
        defaultMessage: " For everyone ",
      })
    ).toBe("For everyone");
    expect(invitationMessage("rec_2", { defaultMessage: "  " })).toBeUndefined();
  });
});

describe("bulk send ids", () => {
  it("accepts the live field and the OpenAPI field", () => {
    expect(bulkSendDocumentIds({ document_ids: ["a"] })).toEqual(["a"]);
    expect(bulkSendDocumentIds({ ids: ["b"] })).toEqual(["b"]);
    expect(bulkSendDocumentIds({ document_ids: ["a"], ids: ["b"] })).toEqual([
      "a",
    ]);
    expect(bulkSendDocumentIds({})).toBeNull();
    expect(bulkSendDocumentIds({ ids: [] })).toBeNull();
  });
});

describe("who gets an invitation", () => {
  it("invites everyone still open when signing is parallel", () => {
    expect(recipientsDueInvitation("parallel", people)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("invites only the first open signer group when signing is sequential", () => {
    expect(recipientsDueInvitation("sequential", people)).toEqual(["a"]);
  });

  it("waits to invite the next group until the current order is finished", () => {
    const afterFirstStillOpen = people.map((person) =>
      person.id === "a" ? { ...person, status: "signed" } : person
    );
    expect(nextSequentialInviteIds("sequential", people, 0)).toEqual([]);
    expect(
      nextSequentialInviteIds("sequential", afterFirstStillOpen, 0)
    ).toEqual(["b"]);
    expect(nextSequentialInviteIds("parallel", afterFirstStillOpen, 0)).toEqual(
      []
    );
  });
});

describe("signing progress", () => {
  const parties = [
    {
      id: "a",
      role: "signer",
      order: 0,
      status: "signed",
      name: "Alex Chen",
      email: "alex@seal.nyc",
    },
    {
      id: "b",
      role: "signer",
      order: 1,
      status: "pending",
      name: "  ",
      email: "jordan@seal.nyc",
    },
    {
      id: "c",
      role: "viewer",
      order: 2,
      status: "pending",
      name: "Copy",
      email: "copy@seal.nyc",
    },
  ];

  it("names the next sequential signer and ignores viewers", () => {
    expect(signingProgress("sequential", parties)).toEqual({
      signed: 1,
      total: 2,
      waitingOn: "jordan@seal.nyc",
    });
  });

  it("names everyone still open when signing is parallel", () => {
    expect(
      signingProgress("parallel", [
        parties[1]!,
        {
          id: "d",
          role: "approver",
          order: 0,
          status: "viewed",
          name: "Sam Lee",
          email: "sam@seal.nyc",
        },
        {
          id: "e",
          role: "signer",
          order: 2,
          status: "pending",
          name: "Riley",
          email: "riley@seal.nyc",
        },
      ])
    ).toEqual({
      signed: 0,
      total: 3,
      waitingOn: "jordan@seal.nyc and 2 others",
    });
  });

  it("names the person who declined", () => {
    expect(
      signingProgress("parallel", [
        { ...parties[0]!, status: "declined", name: "Alex Chen" },
      ])
    ).toEqual({ signed: 0, total: 1, waitingOn: "Alex Chen" });
  });

  it("is empty when nobody has to sign", () => {
    expect(signingProgress("parallel", [])).toBeNull();
  });
});

describe("signing order on send", () => {
  it("writes sequential order only when the caller sets it", () => {
    expect(documentSigningPatch({})).toBeNull();
    expect(
      documentSigningPatch({
        signingMode: "sequential",
        allowDictateNextSigner: false,
      })
    ).toEqual({
      signingMode: "sequential",
      allowDictateNextSigner: false,
    });
    expect(documentSigningPatch({ signingMode: "parallel" })).toEqual({
      signingMode: "parallel",
    });
  });
});
