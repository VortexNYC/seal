import { ActionRetrier } from "@convex-dev/action-retrier";

import { components } from "./_generated/api";

/** Max retries before the retrier gives up on an action. */
export const ACTION_RETRY_MAX_ATTEMPTS = 5 as const;

export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: ACTION_RETRY_MAX_ATTEMPTS - 1,
  logLevel: "WARN",
});
