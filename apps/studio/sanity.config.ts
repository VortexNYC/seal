import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "@seal/sanity-config";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { schemaTypes } from "./sanity/schemas";

export default defineConfig({
  name: "seal-studio",
  title: "Seal Studio",
  basePath: "/studio",
  projectId,
  dataset,
  plugins: [structureTool(), visionTool({ defaultApiVersion: apiVersion })],
  schema: {
    types: schemaTypes,
  },
});
