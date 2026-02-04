/// <reference types="vite/client" />
import { convexTest } from "convex-test";

import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export function createTestContext() {
  return convexTest(schema, modules);
}

export function createAuthenticatedContext(userId: string) {
  const t = createTestContext();
  return t.withIdentity({ subject: userId });
}
