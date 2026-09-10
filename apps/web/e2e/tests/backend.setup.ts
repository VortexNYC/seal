import { test as setup } from "@playwright/test";

import { prepareBackendState } from "../fixtures/backend-setup";
import { assertBackendEnv } from "../fixtures/preflight";

setup.describe.configure({ mode: "serial" });

setup("prepare backend-backed e2e state", async () => {
  setup.setTimeout(60000);

  if (!process.env.CONVEX_DEPLOY_KEY) {
    console.info(
      "[setup] CONVEX_DEPLOY_KEY is not set — skipping Convex-backed backend seeding."
    );
    return;
  }

  assertBackendEnv();
  await prepareBackendState();
});
