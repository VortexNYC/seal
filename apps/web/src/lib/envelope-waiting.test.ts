import { describe, expect, it } from "vitest";

import { envelopeWaitingDetail } from "./envelope-waiting";

const lenore = {
  id: "lenore",
  name: "Lenore",
  email: "lenore@example.com",
  role: "signer",
  order: 1,
  status: "pending",
};

const kai = {
  id: "kai",
  name: "Kai",
  email: "kai@example.com",
  role: "signer",
  order: 2,
  status: "pending",
};

describe("envelopeWaitingDetail", () => {
  it("names everyone who can sign now when the envelope is parallel", () => {
    expect(envelopeWaitingDetail("parallel", [lenore, kai])).toBe(
      "Waiting on Lenore and Kai."
    );
  });

  it("names the current person and who gets the email next", () => {
    expect(
      envelopeWaitingDetail("sequential", [
        { ...lenore, status: "signed" },
        kai,
        {
          id: "ada",
          name: "Ada",
          email: "ada@example.com",
          role: "approver",
          order: 3,
          status: "pending",
        },
      ])
    ).toBe("Waiting on Kai. Ada gets the email after that.");
  });

  it("says who declined", () => {
    expect(
      envelopeWaitingDetail("parallel", [{ ...lenore, status: "declined" }])
    ).toBe("Lenore declined.");
  });
});
