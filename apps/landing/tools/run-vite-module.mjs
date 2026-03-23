import path from "node:path";

import { createServer } from "vite";

/**
 * @param {string} root
 * @param {string} entryPath
 * @returns {string}
 */
function toModuleId(root, entryPath) {
  const relativePath = path.relative(root, entryPath);
  return `/${relativePath.split(path.sep).join("/")}`;
}

const [entryArg, exportNameArg] = process.argv.slice(2);

if (!entryArg) {
  throw new Error("Missing module path. Usage: node tools/run-vite-module.mjs <module> [exportName]");
}

const root = path.resolve(import.meta.dirname, "..");
const entryPath = path.resolve(root, entryArg);
const exportName = exportNameArg || "default";

process.env.SEAL_SKIP_DEV_MANIFEST_PLUGIN = "1";

const server = await createServer({
  appType: "custom",
  clearScreen: false,
  logLevel: "error",
  root,
  server: {
    hmr: false,
    middlewareMode: true,
  },
});

try {
  const module = await server.ssrLoadModule(toModuleId(root, entryPath));
  const run = exportName === "default" ? module.default : module[exportName];

  if (typeof run !== "function") {
    throw new TypeError(`Expected ${entryArg} to export a function named "${exportName}"`);
  }

  await run();
} finally {
  await server.close();
}
