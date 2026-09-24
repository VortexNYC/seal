import { describe, expect, it } from "vitest";

import {
  isPlaceholderSelfhostUrl,
  selfhostUrlConfigError,
} from "./selfhost-urls.js";

describe("isPlaceholderSelfhostUrl", () => {
  it("flags bare selfhost workers.dev hosts", () => {
    expect(isPlaceholderSelfhostUrl("https://seal-selfhost-web.workers.dev")).toBe(
      true
    );
    expect(isPlaceholderSelfhostUrl("https://seal-selfhost-api.workers.dev/")).toBe(
      true
    );
    expect(isPlaceholderSelfhostUrl("https://seal-web.workers.dev")).toBe(true);
  });

  it("allows account-scoped and custom hosts", () => {
    expect(
      isPlaceholderSelfhostUrl(
        "https://seal-selfhost-web.shlomo-31b.workers.dev"
      )
    ).toBe(false);
    expect(isPlaceholderSelfhostUrl("https://app.seal.nyc")).toBe(false);
    expect(isPlaceholderSelfhostUrl("http://localhost:5180")).toBe(false);
  });
});

describe("selfhostUrlConfigError", () => {
  it("returns null when URLs are real", () => {
    expect(
      selfhostUrlConfigError({
        APP_URL: "https://seal-selfhost-web.shlomo-31b.workers.dev",
        BETTER_AUTH_URL: "https://seal-selfhost-api.shlomo-31b.workers.dev",
      })
    ).toBeNull();
  });

  it("explains bare APP_URL", () => {
    const err = selfhostUrlConfigError({
      APP_URL: "https://seal-selfhost-web.workers.dev",
      BETTER_AUTH_URL: "https://seal-selfhost-api.shlomo-31b.workers.dev",
    });
    expect(err).toContain("APP_URL");
    expect(err).toContain("pnpm selfhost");
  });
});
