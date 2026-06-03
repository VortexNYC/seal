import { cp } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.dirname(path.dirname(require.resolve("tslib/modules/index.js")));
const destinationRoot = path.join(projectRoot, ".output/server/node_modules/tslib");

await cp(sourceRoot, destinationRoot, {
  force: true,
  recursive: true,
});

console.log(`Copied tslib runtime files to ${destinationRoot}`);
