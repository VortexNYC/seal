import { describe, expect, it } from "vitest";

import { rememberCreatedOrganization } from "./remember-created-organization";

describe("rememberCreatedOrganization", () => {
  it("keeps a new workspace in the list the layout already has", () => {
    expect(
      rememberCreatedOrganization([], {
        id: "org_1",
        name: "Pay Test",
        slug: "pay-test",
      })
    ).toEqual([{ id: "org_1", name: "Pay Test", slug: "pay-test" }]);
  });

  it("does not add the same slug twice", () => {
    const existing = [{ id: "org_1", name: "Pay Test", slug: "pay-test" }];
    expect(
      rememberCreatedOrganization(existing, {
        id: "org_1",
        name: "Pay Test",
        slug: "pay-test",
      })
    ).toEqual(existing);
  });
});
