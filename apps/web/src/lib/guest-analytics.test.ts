import { describe, expect, test, vi } from "vitest";

import {
  muteGuestAnalytics,
  unmuteAuthenticatedAnalytics,
} from "./guest-analytics";

describe("guest-analytics", () => {
  test("mute stops recording and surveys without opting out of capture", () => {
    const client = {
      opt_out_capturing: vi.fn(),
      stopSessionRecording: vi.fn(),
      set_config: vi.fn(),
    };
    muteGuestAnalytics(client);
    expect(client.set_config).toHaveBeenCalledWith({
      disable_session_recording: true,
      disable_surveys: true,
      enable_heatmaps: false,
    });
    expect(client.stopSessionRecording).toHaveBeenCalledOnce();
    expect(client.opt_out_capturing).not.toHaveBeenCalled();
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
      enable_heatmaps: true,
    });
    expect(client.startSessionRecording).toHaveBeenCalledOnce();
  });
});
