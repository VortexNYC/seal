import actionRetrierComponent from "@convex-dev/action-retrier/test";
import migrationsComponent from "@convex-dev/migrations/test";
import presenceComponent from "@convex-dev/presence/test";
import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import resendComponent from "@convex-dev/resend/test";
import workflowComponent from "@convex-dev/workflow/test";
import vortexAuthComponent from "@vortexnyc/auth/test";
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import timelineComponent from "convex-timeline/test";

import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export function createTestContext() {
  const t = convexTest(schema, modules);
  actionRetrierComponent.register(t);
  resendComponent.register(t);
  migrationsComponent.register(t);
  rateLimiterComponent.register(t);
  workflowComponent.register(t);
  presenceComponent.register(t);
  timelineComponent.register(t);
  vortexAuthComponent.register(t);
  return t;
}

export function createAuthenticatedContext(userId: string) {
  const t = createTestContext();
  return t.withIdentity({ subject: userId });
}
