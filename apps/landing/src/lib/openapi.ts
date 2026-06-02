import path from "node:path";

import { createOpenAPI } from "fumadocs-openapi/server";

// process.cwd() is apps/landing when running dev or build scripts
const specPath = path.resolve(process.cwd(), "openapi.yaml");

export const openapi = createOpenAPI({
  input: [specPath],
});
