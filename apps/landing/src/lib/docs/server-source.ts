import { createFromSource } from "fumadocs-core/search/server";
import { loader, multiple } from "fumadocs-core/source";
import { openapiPlugin, openapiSource } from "fumadocs-openapi/server";

import { docs, developer } from "../../../.source/server";
import { openapi } from "../openapi";

export const docsSource = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
});

export const developerSource = loader(
  multiple({
    docs: developer.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: "openapi",
    }),
  }),
  {
    baseUrl: "/developer",
    plugins: [openapiPlugin()],
  }
);

// Keep legacy export so manifest generator and other callers still work
export const source = developerSource;

export const searchAPI = createFromSource(developerSource);
