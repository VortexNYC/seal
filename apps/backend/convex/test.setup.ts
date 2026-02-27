import migrationsComponent from "@convex-dev/migrations/test";
import resendComponent from "@convex-dev/resend/test";
/// <reference types="vite/client" />
import { convexTest } from "convex-test";

import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export function createTestContext() {
  const t = convexTest(schema, modules);
  resendComponent.register(t);
  migrationsComponent.register(t);
  return t;
}

export function createAuthenticatedContext(userId: string) {
  const t = createTestContext();
  return t.withIdentity({ subject: userId });
}
