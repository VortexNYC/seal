import { describe, expect, test, vi } from "vitest";

import {
  muteGuestAnalytics,
  unmuteAuthenticatedAnalytics,
} from "./guest-analytics";

describe("guest-analytics", () => {
  test("mute opts out and stops session recording", () => {
    const client = {
      opt_out_capturing: vi.fn(),
      stopSessionRecording: vi.fn(),
    };
    muteGuestAnalytics(client);
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    expect(client.stopSessionRecording).toHaveBeenCalledOnce();
  });

  test("unmute opts back in for authenticated app", () => {
    const client = { opt_in_capturing: vi.fn() };
    unmuteAuthenticatedAnalytics(client);
    expect(client.opt_in_capturing).toHaveBeenCalledOnce();
  });
});
