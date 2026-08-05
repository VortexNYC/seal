import { describe, expect, test } from "vitest";

import { buildActiveOrganizationUserPatch } from "../resolveActiveOrganization";
import type { Doc, Id } from "../../_generated/dataModel";

describe("buildActiveOrganizationUserPatch", () => {
  test("writes Seal id and Vortex Auth id when anchored", () => {
    const organization = {
      _id: "org_local" as Id<"organizations">,
      vortexAuthOrganizationId: "vortex_org_1",
    } as Doc<"organizations">;

    const patch = buildActiveOrganizationUserPatch(organization, 1_700_000_000_000);

    expect(patch).toEqual({
      activeOrganizationId: "org_local",
      activeVortexAuthOrganizationId: "vortex_org_1",
      updatedAt: 1_700_000_000_000,
    });
  });

  test("omits Vortex Auth id when org is not anchored", () => {
    const organization = {
      _id: "org_local" as Id<"organizations">,
    } as Doc<"organizations">;

    const patch = buildActiveOrganizationUserPatch(organization, 42);

    expect(patch).toEqual({
      activeOrganizationId: "org_local",
      updatedAt: 42,
    });
  });
});
