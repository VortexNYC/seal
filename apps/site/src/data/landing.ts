import { z } from "zod";

const navLinkSchema = z.object({ label: z.string(), href: z.string() });

const endpointSchema = z.object({
  method: z.enum(["GET", "POST", "DELETE"]),
  path: z.string(),
  desc: z.string(),
});

const pricingTierSchema = z.object({
  name: z.string(),
  price: z.string(),
  unit: z.string(),
  blurb: z.string(),
  features: z.array(z.string()),
  cta: navLinkSchema,
  featured: z.boolean().default(false),
});

const comparisonRowSchema = z.object({
  them: z.string(),
  seal: z.string(),
});

const landingSchema = z.object({
  title: z.string(),
  description: z.string(),
  nav: z.object({
    links: z.array(navLinkSchema),
    signIn: navLinkSchema,
    cta: navLinkSchema,
  }),
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    headlineEmphasis: z.string(),
    subheadline: z.string(),
    primaryCta: navLinkSchema,
    secondaryCta: navLinkSchema,
    proof: z.array(z.string()),
    codeFile: z.string(),
    codeSnippet: z.string(),
  }),
  api: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    endpoints: z.array(endpointSchema),
    footer: z.string(),
  }),
  pricing: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string(),
    tiers: z.array(pricingTierSchema),
    note: z.string(),
  }),
  developer: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    endpoints: z.array(z.string()),
  }),
  comparison: z.object({
    title: z.string(),
    subtitle: z.string(),
    rows: z.array(comparisonRowSchema),
  }),
  finalCta: z.object({
    headline: z.string(),
    sub: z.string(),
    cta: navLinkSchema,
    note: z.string(),
  }),
  footer: z.object({
    tagline: z.string(),
    columns: z.array(
      z.object({
        title: z.string(),
        links: z.array(navLinkSchema),
      })
    ),
  }),
});

export const landing = landingSchema.parse({
  title: "Seal — the e-signature API",
  description:
    "Seal is the e-signature API. Upload a PDF, add signers, get it back signed — from your code or your agent. Free developer tier, per-document pricing, real docs.",

  nav: {
    links: [
      { label: "API Documentation", href: "https://docs.seal.nyc" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
    signIn: { label: "Sign in", href: "https://app.seal.nyc" },
    cta: { label: "Get an API key", href: "https://app.seal.nyc/sign-up" },
  },

  hero: {
    eyebrow: "The e-signature API",
    headline: "Documents in,",
    headlineEmphasis: "signatures out.",
    subheadline:
      "Upload a PDF, add signers, get it back signed — with an audit trail. A REST API, typed SDK, and MCP server. No seat licenses, no demo call, no envelope quota designed to be hit in month eleven.",
    primaryCta: {
      label: "Get an API key",
      href: "https://app.seal.nyc/sign-up",
    },
    secondaryCta: { label: "API Documentation", href: "https://docs.seal.nyc" },
    proof: [
      "Free developer tier",
      "First signature in minutes",
      "10 documents/month on us",
    ],
    codeFile: "send-for-signature.ts",
    codeSnippet: `import { SealClient } from "@seal/client";

const seal = new SealClient({ apiKey: process.env.SEAL_API_KEY });

// Get an upload URL and push the PDF
const { upload_url, storage_id } =
  await seal.request("POST", "/uploads/generate-url");
await fetch(upload_url, { method: "POST", body: pdf });

// Create the document and add a signer
const { id } = await seal.request("POST", "/documents", {
  title: "Mutual NDA",
  storage_id,
  file_size: pdf.byteLength,
});
await seal.request("POST", \`/recipients?document_id=\${id}\`, {
  email: "jane@acme.com",
  name: "Jane Smith",
  role: "signer",
});

// Send. She gets a link, signs in the browser. Done.
await seal.request("POST", \`/documents/send?id=\${id}\`);`,
  },

  api: {
    eyebrow: "The whole product is an API",
    title: "Every verb, documented and typed.",
    body: "No features hiding behind a UI you have to click through. If Seal can do it, the endpoint exists — and the SDK is generated from the same spec the docs render.",
    endpoints: [
      {
        method: "POST",
        path: "/uploads/generate-url",
        desc: "Pre-signed upload for the PDF",
      },
      { method: "POST", path: "/documents", desc: "Create a draft document" },
      {
        method: "POST",
        path: "/recipients",
        desc: "Add signers with order and roles",
      },
      { method: "POST", path: "/documents/send", desc: "Send for signature" },
      { method: "GET", path: "/documents", desc: "List and filter by status" },
      { method: "GET", path: "/signatures/audit", desc: "Full audit trail" },
      {
        method: "POST",
        path: "/signatures/verify",
        desc: "Verify a signed document",
      },
      { method: "POST", path: "/documents/void", desc: "Cancel and notify" },
      {
        method: "POST",
        path: "/recipients/remind",
        desc: "Nudge the stragglers",
      },
    ],
    footer:
      "Plus webhooks for every lifecycle event — sent, viewed, signed, declined, expired.",
  },

  pricing: {
    eyebrow: "Pricing",
    title: "Pay for documents, not seats.",
    subtitle:
      "The incumbents charge per person per month whether or not anyone signs anything. We charge for the thing you actually use.",
    tiers: [
      {
        name: "Developer",
        price: "$0",
        unit: "forever",
        blurb: "For building, prototyping, and side projects.",
        features: [
          "10 documents / month",
          "Full API + MCP access",
          "Uploads, webhooks, audit trail",
          "No credit card",
        ],
        cta: { label: "Get an API key", href: "https://app.seal.nyc/sign-up" },
        featured: false,
      },
      {
        name: "Pro",
        price: "$0.40",
        unit: "per document",
        blurb: "For production workloads that sign real contracts.",
        features: [
          "500 documents / month included",
          "Then metered per document",
          "White-label signing chrome",
          "Sequential signing + templates",
          "Priority support",
        ],
        cta: { label: "Start with Pro", href: "https://app.seal.nyc/sign-up" },
        featured: true,
      },
      {
        name: "Enterprise",
        price: "Custom",
        unit: "volume",
        blurb: "For volume, compliance, and procurement realities.",
        features: [
          "Volume pricing",
          "SSO / SAML",
          "Custom data retention",
          "Dedicated support channel",
        ],
        cta: { label: "Contact us", href: "mailto:hello@seal.nyc" },
        featured: false,
      },
    ],
    note: "A document is one envelope: uploaded, sent, signed, sealed. Recipients are always free.",
  },

  developer: {
    eyebrow: "For humans and their agents",
    title: "An API your AI can drive.",
    body: "First-class REST API, typed SDKs generated from the OpenAPI spec, a CLI, and a hosted MCP server. Your agent can draft, send, and chase signatures without a human opening a tab.",
    endpoints: ["api.seal.nyc", "mcp.seal.nyc", "@seal/client on npm"],
  },

  comparison: {
    title: "The incumbents had twenty years.",
    subtitle: "We read their pricing pages so you don't have to.",
    rows: [
      {
        them: "Per-seat pricing that multiplies as your team grows",
        seal: "Per-document pricing. Seats don't sign things — documents do.",
      },
      {
        them: "Envelope quotas designed to be hit in month eleven",
        seal: "Metered usage you'd have to try to abuse.",
      },
      {
        them: '"Contact sales" where the price should be',
        seal: "The price is on the page. Scroll up.",
      },
      {
        them: "Agents bolted on in 2025 press releases",
        seal: "MCP server and typed SDKs since day one.",
      },
      {
        them: "An interface that remembers Internet Explorer",
        seal: "An API on Cloudflare Workers. Fast everywhere, by default.",
      },
    ],
  },

  finalCta: {
    headline: "Sign something today.",
    sub: "Create an account, get an API key, send a document. That's the whole onboarding.",
    cta: { label: "Get an API key", href: "https://app.seal.nyc/sign-up" },
    note: "Free tier · No card · No demo call · Your documents stay yours",
  },

  footer: {
    tagline: "The e-signature API. Made in New York City.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Pricing", href: "#pricing" },
          { label: "Changelog", href: "/changelog" },
          { label: "API Documentation", href: "https://docs.seal.nyc" },
        ],
      },
      {
        title: "Developers",
        links: [
          { label: "API reference", href: "https://docs.seal.nyc" },
          { label: "MCP server", href: "https://mcp.seal.nyc" },
          { label: "Status", href: "https://status.seal.nyc" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "Blog", href: "/blog" },
          { label: "Contact", href: "mailto:hello@seal.nyc" },
        ],
      },
    ],
  },
});
