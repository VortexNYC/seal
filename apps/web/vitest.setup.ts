import { afterEach, beforeEach, vi } from "vitest";
import "vitest-dom/extend-expect";

// Kumo components such as Tabs rely on ResizeObserver being present.
// jsdom does not implement it, so provide a minimal stub for tests.
// vortex-allow-dom-mock: ResizeObserver is not available in the jsdom environment.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Kumo tab buttons call scrollIntoView on click.
// vortex-allow-dom-mock: scrollIntoView is not available in the jsdom environment.
if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
  HTMLElement.prototype.scrollIntoView = () => {};
}

/**
 * Unit tests must never touch the network. An unmocked fetch in CI can sit on a
 * blackholed TCP connect until the OS gives up (~15–17min). Reject immediately
 * so a missing mock fails the test in milliseconds instead.
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return Promise.reject(
        new Error(
          `Unexpected fetch in unit test (${url}). Mock the API/auth boundary.`
        )
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
