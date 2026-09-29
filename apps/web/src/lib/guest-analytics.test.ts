import { describe, expect, test, vi } from "vitest";

import {
  muteGuestAnalytics,
  unmuteAuthenticatedAnalytics,
} from "./guest-analytics";

describe("guest-analytics", () => {
  test("mute opts out, stops recording, and disables surveys", () => {
    const client = {
      opt_out_capturing: vi.fn(),
      stopSessionRecording: vi.fn(),
      set_config: vi.fn(),
    };
    muteGuestAnalytics(client);
    expect(client.set_config).toHaveBeenCalledWith({
      disable_session_recording: true,
      disable_surveys: true,
    });
    expect(client.stopSessionRecording).toHaveBeenCalledOnce();
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
  });

  test("unmute opts in and starts session recording for authenticated app", () => {
    const client = {
      opt_in_capturing: vi.fn(),
      set_config: vi.fn(),
      startSessionRecording: vi.fn(),
    };
    unmuteAuthenticatedAnalytics(client);
    expect(client.opt_in_capturing).toHaveBeenCalledOnce();
    expect(client.set_config).toHaveBeenCalledWith({
      disable_session_recording: false,
      disable_surveys: false,
    });
    expect(client.startSessionRecording).toHaveBeenCalledOnce();
  });
});
