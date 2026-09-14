import "@testing-library/jest-dom/vitest";

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
