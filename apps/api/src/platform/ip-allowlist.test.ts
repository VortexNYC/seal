import { describe, expect, it } from "vitest";

import { ipMatchesAllowlist } from "./ip-allowlist.js";

describe("ipMatchesAllowlist", () => {
  it("allows every address when the list is empty", () => {
    expect(ipMatchesAllowlist("203.0.113.4", [])).toBe(true);
    expect(ipMatchesAllowlist(null, [])).toBe(true);
  });

  it("matches an address inside a CIDR and rejects one outside it", () => {
    expect(ipMatchesAllowlist("192.168.1.20", ["192.168.1.0/24"])).toBe(true);
    expect(ipMatchesAllowlist("192.168.2.1", ["192.168.1.0/24"])).toBe(false);
    expect(ipMatchesAllowlist("203.0.113.4", ["203.0.113.4"])).toBe(true);
  });

  it("rejects a missing address when a range is set", () => {
    expect(ipMatchesAllowlist(null, ["10.0.0.0/8"])).toBe(false);
  });
});
