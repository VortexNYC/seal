import { createFromSource } from "fumadocs-core/search/server";
import { loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
});

export const searchAPI = createFromSource(source);
