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
  test("grants access from the token's own scope (MCP OAuth)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: [], // no permission, no full-access role
      hasScope: (scope: string) => scope === API_SCOPES.WEBHOOKS_MANAGE,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("bypasses check for owner role (MCP OAuth)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "owner",
      permissions: [], // empty - should still pass
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("bypasses check for admin role (MCP OAuth)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "admin",
      permissions: [], // empty - should still pass
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("checks permissions for member role (MCP OAuth)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: ["settings:integrations"],
      hasScope: () => false,
    } as unknown as ApiAuthContext;

    expect(() => requireScope(auth, API_SCOPES.WEBHOOKS_MANAGE)).not.toThrow();
  });

  test("rejects member without settings:integrations (MCP OAuth)", () => {
    const auth = {
      authType: "mcp_oauth" as const,
      role: "member",
      permissions: ["settings:view", "documents:view"],
      hasScope: () => false,
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
