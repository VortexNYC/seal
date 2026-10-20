import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";

const flags = new Map<string, boolean>();
let flagsListener: (() => void) | null = null;
let clientMock: {
  isFeatureEnabled: (k: string) => boolean | undefined;
  onFeatureFlags: (cb: () => void) => () => void;
} | null = null;

vi.mock("../lib/posthog-client", () => ({
  usePostHog: () => clientMock,
}));

import { useFlag } from "./use-flag";

describe("useFlag", () => {
  beforeEach(() => {
    flags.clear();
    flagsListener = null;
    clientMock = {
      isFeatureEnabled: (k) => flags.get(k),
      onFeatureFlags: (cb) => {
        flagsListener = cb;
        return () => {
          flagsListener = null;
        };
      },
    };
  });

  test("returns undefined before the client boots", () => {
    clientMock = null;
    const { result } = renderHook(() => useFlag("new-dash"));
    expect(result.current).toBeUndefined();
  });

  test("resolves the flag value from the client", () => {
    flags.set("new-dash", true);
    const { result } = renderHook(() => useFlag("new-dash"));
    expect(result.current).toBe(true);
  });

  test("updates when flags reload", () => {
    flags.set("new-dash", false);
    const { result } = renderHook(() => useFlag("new-dash"));
    expect(result.current).toBe(false);
    flags.set("new-dash", true);
    act(() => flagsListener?.());
    expect(result.current).toBe(true);
  });
});
