import { test as setup } from "@playwright/test";

import { prepareBackendState } from "../fixtures/backend-setup";
import { assertBackendEnv } from "../fixtures/preflight";

setup.describe.configure({ mode: "serial" });

setup("prepare backend-backed e2e state", async () => {
  setup.setTimeout(60000);
  assertBackendEnv();
  await prepareBackendState();
});
