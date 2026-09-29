import { describe, expect, test } from "vitest";

import {
  isGuestAnalyticsSurface,
  rewritePosthogIngestPath,
} from "./posthog-proxy";

describe("rewritePosthogIngestPath", () => {
  test("maps static assets onto us-assets /static (not bare root)", () => {
    expect(
      rewritePosthogIngestPath("/ingest/static/posthog-recorder.js")
    ).toEqual({
      targetHost: "https://us-assets.i.posthog.com",
      targetPath: "/static/posthog-recorder.js",
    });
    expect(
      rewritePosthogIngestPath("/ingest/static/surveys.js")
    ).toEqual({
      targetHost: "https://us-assets.i.posthog.com",
      targetPath: "/static/surveys.js",
    });
    expect(
      rewritePosthogIngestPath("/ingest/static/array.js")
    ).toEqual({
      targetHost: "https://us-assets.i.posthog.com",
      targetPath: "/static/array.js",
    });
  });

  test("maps API ingest onto us.i.posthog.com without /ingest prefix", () => {
    expect(rewritePosthogIngestPath("/ingest/e/")).toEqual({
      targetHost: "https://us.i.posthog.com",
      targetPath: "/e/",
    });
    expect(rewritePosthogIngestPath("/ingest/decide/")).toEqual({
      targetHost: "https://us.i.posthog.com",
      targetPath: "/decide/",
    });
  });
});

describe("isGuestAnalyticsSurface", () => {
  test("treats sign and verify as guest", () => {
    expect(isGuestAnalyticsSurface("/sign/abc")).toBe(true);
    expect(isGuestAnalyticsSurface("/verify/qr")).toBe(true);
    expect(isGuestAnalyticsSurface("/vortex/documents")).toBe(false);
  });
});
