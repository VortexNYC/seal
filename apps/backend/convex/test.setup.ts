import actionRetrierComponent from "@convex-dev/action-retrier/test";
import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import workflowComponent from "@convex-dev/workflow/test";
import betterAuthComponent from "@vortexnyc/auth/test";
/// <reference types="vite/client" />
import { convexTest } from "convex-test";

import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export function createTestContext() {
  const t = convexTest(schema, modules);
  actionRetrierComponent.register(t);
  rateLimiterComponent.register(t);
  workflowComponent.register(t);
  betterAuthComponent.register(t, "betterAuthConsumer");
  return t;
}

export function createAuthenticatedContext(userId: string) {
  const t = createTestContext();
  return t.withIdentity({ subject: userId });
}
