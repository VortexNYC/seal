import { ActionRetrier } from "@convex-dev/action-retrier";

import { components } from "./_generated/api";

/** Shared action retrier instance with exponential backoff. */
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: 4,
  logLevel: "WARN",
});
