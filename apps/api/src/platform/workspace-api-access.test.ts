import { describe, expect, it } from "vitest";

import { workspaceApiAccessAllows } from "./org-settings.js";

describe("workspaceApiAccessAllows", () => {
  it("allows every address when nothing is saved", () => {
    expect(workspaceApiAccessAllows(null, null)).toBe(true);
    expect(workspaceApiAccessAllows(null, "203.0.113.4")).toBe(true);
  });

  it("rejects an address outside the settings-screen list", () => {
    const metadata = JSON.stringify({
      securitySettings: { ipAllowlist: ["203.0.113.0/24"], allowApiAccess: true },
    });
    expect(workspaceApiAccessAllows(metadata, "203.0.113.9")).toBe(true);
    expect(workspaceApiAccessAllows(metadata, "198.51.100.8")).toBe(false);
    expect(workspaceApiAccessAllows(metadata, null)).toBe(false);
  });

  it("rejects API access when the settings screen turns it off", () => {
    const metadata = JSON.stringify({
      securitySettings: { ipAllowlist: [], allowApiAccess: false },
    });
    expect(workspaceApiAccessAllows(metadata, "203.0.113.9")).toBe(false);
  });

  it("rejects an address outside the settings API list", () => {
    const metadata = JSON.stringify({
      seal_settings: {
        security: { ip_allowlist: ["10.0.0.0/8"], allow_api_access: true },
      },
    });
    expect(workspaceApiAccessAllows(metadata, "10.1.2.3")).toBe(true);
    expect(workspaceApiAccessAllows(metadata, "203.0.113.9")).toBe(false);
  });

  it("requires both saved lists to allow the address", () => {
    const metadata = JSON.stringify({
      securitySettings: { ipAllowlist: ["203.0.113.0/24"] },
      seal_settings: {
        security: { ip_allowlist: ["198.51.100.0/24"] },
      },
    });
    expect(workspaceApiAccessAllows(metadata, "203.0.113.9")).toBe(false);
    expect(workspaceApiAccessAllows(metadata, "198.51.100.8")).toBe(false);
  });

  it("rejects a corrupt allowlist instead of ignoring it", () => {
    const metadata = JSON.stringify({
      securitySettings: { ipAllowlist: ["203.0.113.0/24", 1] },
    });
    expect(workspaceApiAccessAllows(metadata, "203.0.113.9")).toBe(false);
  });
});
