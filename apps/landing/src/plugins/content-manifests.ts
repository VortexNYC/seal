import path from "node:path";

import type { Plugin, ViteDevServer } from "vite";

const appRoot = path.resolve(import.meta.dirname, "../..");
const docsContentRoot = path.join(appRoot, "content", "docs");
const changelogContentRoot = path.join(appRoot, "content", "changelog");
const sourceConfigPath = path.join(appRoot, "source.config.ts");
const manifestModuleId = "/tools/generate-content-manifests.ts";

function shouldRegenerateManifest(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);

  return (
    normalizedPath.startsWith(docsContentRoot) ||
    normalizedPath.startsWith(changelogContentRoot) ||
    normalizedPath === sourceConfigPath
  );
}

async function generateContentManifests(server: ViteDevServer): Promise<void> {
  const module = (await server.ssrLoadModule(manifestModuleId)) as {
    generateContentManifests?: () => Promise<void>;
  };

  if (typeof module.generateContentManifests !== "function") {
    throw new TypeError(`Expected ${manifestModuleId} to export generateContentManifests()`);
  }

  await module.generateContentManifests();
}

export function contentManifestsPlugin(): Plugin {
  if (process.env.SEAL_SKIP_DEV_MANIFEST_PLUGIN === "1") {
    return {
      name: "seal-content-manifests",
    };
  }

  let pendingGeneration = Promise.resolve();

  const queueGeneration = (server: ViteDevServer): Promise<void> => {
    pendingGeneration = pendingGeneration
      .catch(() => undefined)
      .then(() => generateContentManifests(server));
    return pendingGeneration;
  };

  return {
    name: "seal-content-manifests",
    configureServer(server) {
      const initialGeneration = queueGeneration(server);

      server.middlewares.use(async (_req, _res, next) => {
        try {
          await initialGeneration;
          next();
        } catch (error) {
          next(error as Error);
        }
      });
    },
    async handleHotUpdate(ctx) {
      if (!shouldRegenerateManifest(ctx.file)) {
        return;
      }

      await queueGeneration(ctx.server);
      ctx.server.ws.send({ type: "full-reload" });
    },
  };
}
