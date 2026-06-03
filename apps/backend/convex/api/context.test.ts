import { describe, expect, test } from "vitest";

import {
  API_SCOPES,
  type ApiAuthContext,
  canUserUseScope,
  requireScope,
  SCOPE_PERMISSION_MAP,
} from "./context";
import { ApiError } from "./errors";

describe("SCOPE_PERMISSION_MAP", () => {
  test("WEBHOOKS_MANAGE maps to settings:integrations", () => {
    expect(SCOPE_PERMISSION_MAP[API_SCOPES.WEBHOOKS_MANAGE]).toEqual(["settings:integrations"]);
  });

  test("all scopes have at least one mapped permission", () => {
    for (const scope of Object.values(API_SCOPES)) {
      const perms = SCOPE_PERMISSION_MAP[scope];
      expect(perms, `scope ${scope} should have permissions`).toBeDefined();
      expect(perms.length).toBeGreaterThan(0);
    }
  });
});

describe("canUserUseScope", () => {
  describe("WEBHOOKS_MANAGE scope", () => {
    test("grants access when user has settings:integrations", () => {
      const permissions = ["settings:view", "settings:integrations"];
      expect(canUserUseScope(permissions, API_SCOPES.WEBHOOKS_MANAGE)).toBe(true);
    });

    test("denies access when user only has settings:view", () => {
      const permissions = ["settings:view", "documents:view"];
      expect(canUserUseScope(permissions, API_SCOPES.WEBHOOKS_MANAGE)).toBe(false);
    });

    test("denies access when user has no settings permissions", () => {
      const permissions = ["documents:view", "documents:create"];
      expect(canUserUseScope(permissions, API_SCOPES.WEBHOOKS_MANAGE)).toBe(false);
    });

    test("denies access with empty permissions", () => {
      expect(canUserUseScope([], API_SCOPES.WEBHOOKS_MANAGE)).toBe(false);
    });

    test("denies access with old webhooks:manage permission (no longer mapped)", () => {
      const permissions = ["webhooks:manage"];
      expect(canUserUseScope(permissions, API_SCOPES.WEBHOOKS_MANAGE)).toBe(false);
    });

    test("denies access with granular webhook permissions (not mapped)", () => {
      const permissions = [
        "webhooks:read",
        "webhooks:create",
        "webhooks:update",
        "webhooks:delete",
      ];
      expect(canUserUseScope(permissions, API_SCOPES.WEBHOOKS_MANAGE)).toBe(false);
    });
  });

  describe("other scopes for comparison", () => {
    test("DOCUMENTS_READ grants access with documents:view", () => {
      expect(canUserUseScope(["documents:view"], API_SCOPES.DOCUMENTS_READ)).toBe(true);
    });

    test("DOCUMENTS_WRITE grants access with any write permission", () => {
      expect(canUserUseScope(["documents:create"], API_SCOPES.DOCUMENTS_WRITE)).toBe(true);
      expect(canUserUseScope(["documents:edit"], API_SCOPES.DOCUMENTS_WRITE)).toBe(true);
      expect(canUserUseScope(["documents:delete"], API_SCOPES.DOCUMENTS_WRITE)).toBe(true);
    });
  });
});

describe("requireScope", () => {
  // The OAuth token's granted scopes are a HARD CEILING for mcp_oauth: a missing
  // scope is denied regardless of role/permission (least-privilege consent).
  test("denies when the token lacks the scope, even for owner (scope is the ceiling)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "owner",
      permissions: [],
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).toThrow(ApiError);
  });

  test("denies when the token lacks the scope, even with the mapped permission", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: ["settings:integrations"],
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).toThrow(ApiError);
  });

  test("allows owner within a granted scope", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "owner",
      permissions: [],
      hasScope: (scope: string) => scope === API_SCOPES.WEBHOOKS_MANAGE,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("allows member with the granted scope AND the mapped permission", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: ["settings:integrations"],
      hasScope: (scope: string) => scope === API_SCOPES.WEBHOOKS_MANAGE,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("denies member with the granted scope but no mapped permission", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: ["settings:view", "documents:view"],
      hasScope: (scope: string) => scope === API_SCOPES.WEBHOOKS_MANAGE,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).toThrow(ApiError);
  });

  test("uses hasScope for API key auth", () => {
    const auth = {
      authType: "api_key" as const,
      role: "owner",
      permissions: [],
      hasScope: (scope: string) => scope === API_SCOPES.WEBHOOKS_MANAGE,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("rejects API key without matching scope", () => {
    const auth = {
      authType: "api_key" as const,
      role: "owner",
      permissions: [],
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).toThrow(ApiError);
  });
});
