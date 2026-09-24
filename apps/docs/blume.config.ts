import { defineConfig } from "blume";

export default defineConfig({
  title: "Seal",
  description: "Documentation for the Seal document signing platform.",

  logo: {
    text: "Seal",
  },

  theme: {
    accent: "#2c271f",
    background: {
      light: "#fbfaf9",
      dark: "#17130e",
    },
    fonts: {
      display: {
        name: "Hedvig Letters Serif",
        fallback: "serif",
        variants: [
          {
            src: "../../packages/tokens/src/fonts/hedvig-letters-serif.woff2",
            weight: 400,
          },
        ],
      },
      body: {
        name: "Hedvig Letters Sans",
        fallback: "sans",
        variants: [
          {
            src: "../../packages/tokens/src/fonts/hedvig-letters-sans.woff2",
            weight: 400,
          },
        ],
      },
      mono: {
        name: "JetBrains Mono",
        fallback: "mono",
        variants: [
          {
            src: "../../packages/tokens/src/fonts/jetbrains-mono-var.woff2",
            weight: "100..800",
          },
        ],
      },
    },
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
