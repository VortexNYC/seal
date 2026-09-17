import { defineConfig } from "blume";

export default defineConfig({
  title: "Seal",
  description: "Documentation for the Seal document signing platform.",

  logo: {
    text: "Seal",
  },

  navigation: {
    tabs: [
      { label: "Docs", path: "/" },
      { label: "API Reference", path: "/reference" },
    ],
  },

  openapi: {
    enabled: true,
    route: "/reference",
    spec: "./openapi.yaml",
  },

  deployment: {
    output: "static",
    site: "https://docs.seal.nyc",
  },

  seo: {
    sitemap: true,
    robots: true,
  },
});
