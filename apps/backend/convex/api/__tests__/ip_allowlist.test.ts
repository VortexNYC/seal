import { describe, expect, test } from "vitest";

import { isIpAllowed } from "../context";

describe("isIpAllowed", () => {
  test("empty allowlist allows all IPs", () => {
    expect(isIpAllowed("1.2.3.4", [])).toBe(true);
    expect(isIpAllowed("255.255.255.255", [])).toBe(true);
    expect(isIpAllowed("0.0.0.0", [])).toBe(true);
  });

  // --- Exact IP matching (implicit /32) ---

  test("exact IP match returns true", () => {
    expect(isIpAllowed("10.0.0.1", ["10.0.0.1"])).toBe(true);
  });

  test("exact IP mismatch returns false", () => {
    expect(isIpAllowed("10.0.0.2", ["10.0.0.1"])).toBe(false);
  });

  // --- CIDR range matching ---

  test("/24 matches IPs in the same subnet", () => {
    const allowlist = ["192.168.1.0/24"];
    expect(isIpAllowed("192.168.1.0", allowlist)).toBe(true);
    expect(isIpAllowed("192.168.1.1", allowlist)).toBe(true);
    expect(isIpAllowed("192.168.1.254", allowlist)).toBe(true);
    expect(isIpAllowed("192.168.1.255", allowlist)).toBe(true);
  });

  test("/24 rejects IPs outside the subnet", () => {
    const allowlist = ["192.168.1.0/24"];
    expect(isIpAllowed("192.168.2.1", allowlist)).toBe(false);
    expect(isIpAllowed("192.168.0.255", allowlist)).toBe(false);
    expect(isIpAllowed("10.0.0.1", allowlist)).toBe(false);
  });

  test("/16 matches broader range", () => {
    const allowlist = ["10.20.0.0/16"];
    expect(isIpAllowed("10.20.0.1", allowlist)).toBe(true);
    expect(isIpAllowed("10.20.255.255", allowlist)).toBe(true);
    expect(isIpAllowed("10.21.0.1", allowlist)).toBe(false);
  });

  test("/32 is equivalent to exact match", () => {
    const allowlist = ["172.16.0.5/32"];
    expect(isIpAllowed("172.16.0.5", allowlist)).toBe(true);
    expect(isIpAllowed("172.16.0.6", allowlist)).toBe(false);
  });

  test("/0 matches everything", () => {
    const allowlist = ["0.0.0.0/0"];
    expect(isIpAllowed("1.2.3.4", allowlist)).toBe(true);
    expect(isIpAllowed("255.255.255.255", allowlist)).toBe(true);
  });

  test("/8 matches first-octet range", () => {
    const allowlist = ["10.0.0.0/8"];
    expect(isIpAllowed("10.0.0.1", allowlist)).toBe(true);
    expect(isIpAllowed("10.255.255.255", allowlist)).toBe(true);
    expect(isIpAllowed("11.0.0.1", allowlist)).toBe(false);
  });

  // --- Multiple allowlist entries (OR logic) ---

  test("matches any entry in the allowlist", () => {
    const allowlist = ["10.0.0.0/8", "192.168.1.0/24", "172.16.0.5"];
    expect(isIpAllowed("10.50.0.1", allowlist)).toBe(true);
    expect(isIpAllowed("192.168.1.100", allowlist)).toBe(true);
    expect(isIpAllowed("172.16.0.5", allowlist)).toBe(true);
    expect(isIpAllowed("8.8.8.8", allowlist)).toBe(false);
  });

  // --- Edge cases ---

  test("invalid IP returns false", () => {
    expect(isIpAllowed("not-an-ip", ["10.0.0.0/8"])).toBe(false);
    expect(isIpAllowed("", ["10.0.0.0/8"])).toBe(false);
    expect(isIpAllowed("256.0.0.1", ["10.0.0.0/8"])).toBe(false);
    expect(isIpAllowed("10.0.0", ["10.0.0.0/8"])).toBe(false);
  });

  test("invalid CIDR in allowlist is safely skipped", () => {
    expect(isIpAllowed("10.0.0.1", ["invalid-cidr"])).toBe(false);
    expect(isIpAllowed("10.0.0.1", ["10.0.0.0/33"])).toBe(false);
    expect(isIpAllowed("10.0.0.1", ["10.0.0.0/-1"])).toBe(false);
  });

  test("CIDR entry with whitespace is trimmed", () => {
    expect(isIpAllowed("10.0.0.1", ["  10.0.0.0/8  "])).toBe(true);
  });

  test("high-value octets work correctly (bitwise edge case)", () => {
    // 255.255.255.255 is 0xFFFFFFFF — tests unsigned 32-bit handling
    expect(isIpAllowed("255.255.255.255", ["255.255.255.255"])).toBe(true);
    expect(isIpAllowed("255.255.255.254", ["255.255.255.255"])).toBe(false);
    expect(isIpAllowed("128.0.0.0", ["128.0.0.0/1"])).toBe(true);
    expect(isIpAllowed("127.255.255.255", ["128.0.0.0/1"])).toBe(false);
  });

  test("IPv6 addresses are not supported (returns false)", () => {
    expect(isIpAllowed("::1", ["::1"])).toBe(false);
    expect(isIpAllowed("2001:db8::1", ["2001:db8::/32"])).toBe(false);
  });
});
