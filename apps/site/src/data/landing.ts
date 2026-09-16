import { z } from "zod";

const featureSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  body: z.string(),
  bullets: z.array(z.string()),
});

const comparisonRowSchema = z.object({
  them: z.string(),
  seal: z.string(),
});

const navLinkSchema = z.object({ label: z.string(), href: z.string() });

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
  }),
  features: z.array(featureSchema),
  developer: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    endpoints: z.array(z.string()),
    codeSnippet: z.string(),
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
  title: "Seal — e-signatures that don't waste your time",
  description:
    "Seal is a fast, API-first e-signature platform. Send, sign, and track documents in minutes — with an MCP server so your agents can sign too.",

  nav: {
    links: [
      { label: "Product", href: "#product" },
      { label: "Developers", href: "#developers" },
      { label: "Pricing", href: "/pricing" },
      { label: "Docs", href: "https://seal.nyc/docs" },
    ],
    signIn: { label: "Sign in", href: "https://app.seal.nyc" },
    cta: { label: "Start free", href: "https://app.seal.nyc" },
  },

  hero: {
    eyebrow: "E-signature, rebuilt for this decade",
    headline: "Put a seal on it —",
    headlineEmphasis: "in minutes, not seat licenses.",
    subheadline:
      "Send a document, get it signed, move on. No per-envelope math, no renewal-call pricing, no interface from the Acrobat era. API, MCP, and a signing flow recipients actually finish.",
    primaryCta: { label: "Start signing free", href: "https://app.seal.nyc" },
    secondaryCta: { label: "Read the docs", href: "https://seal.nyc/docs" },
    proof: [
      "No card required",
      "First envelope in under 5 minutes",
      "Free tier that isn't a demo",
    ],
  },

  features: [
    {
      eyebrow: "Send",
      title: "From upload to signed, without the ceremony.",
      body: "Drop a PDF, place fields where they belong, send. Recipients get a link that opens the document — not an account-creation funnel.",
      bullets: [
        "Drag-and-drop field placement on a real document canvas",
        "Signing order, reminders, and expiration handled for you",
        "Signers need nothing but a browser",
      ],
    },
    {
      eyebrow: "Track",
      title: "Know exactly where every signature stands.",
      body: "Per-recipient status, view events, and a full audit trail. Nudge the stragglers with one click instead of a follow-up email thread.",
      bullets: [
        "Live status: sent, viewed, signed, declined",
        "Automatic reminders and expiration alerts",
        "Tamper-evident audit log on every document",
      ],
    },
    {
      eyebrow: "Embed",
      title: "Signing inside your product, not beside it.",
      body: "The same canvas and components that power Seal ship as an SDK. Embed the signer experience in your app with a few lines.",
      bullets: [
        "@seal/react components and @seal/client SDK",
        "White-label signing chrome on paid plans",
        "Webhooks for every lifecycle event",
      ],
    },
  ],

  developer: {
    eyebrow: "For developers — and their agents",
    title: "An API your AI can drive.",
    body: "Seal ships a first-class REST API, typed SDKs, a CLI, and a hosted MCP server. Your agent can draft, send, and chase signatures without a human opening a tab.",
    endpoints: ["api.seal.nyc", "mcp.seal.nyc", "seal-cli on npm"],
    codeSnippet: `import { Seal } from "@seal/client";

const seal = new Seal({ apiKey: process.env.SEAL_API_KEY });

await seal.documents.send({
  file: "./msa.pdf",
  recipients: [{ email: "cfo@acme.com", role: "signer" }],
  fields: [{ type: "signature", page: 2, x: 120, y: 640 }],
});`,
  },

  comparison: {
    title: "The incumbents had twenty years.",
    subtitle: "We read their pricing pages so you don't have to.",
    rows: [
      {
        them: "Per-seat pricing that multiplies as your team grows",
        seal: "Flat plans. Your tenth teammate costs the same as your first.",
      },
      {
        them: "Envelope quotas designed to be hit in month eleven",
        seal: "Generous limits you'd have to try to exceed.",
      },
      {
        them: '"Contact sales" where the price should be',
        seal: "The price is on the pricing page. Novel concept.",
      },
      {
        them: "Agents bolted on in 2025 press releases",
        seal: "MCP server and typed SDKs since day one.",
      },
      {
        them: "An interface that remembers Internet Explorer",
        seal: "Built on Cloudflare Workers. Fast everywhere, by default.",
      },
    ],
  },

  finalCta: {
    headline: "Sign something today.",
    sub: "Free to start. No demo call, no card, no procurement cycle.",
    cta: { label: "Start free", href: "https://app.seal.nyc" },
    note: "Set up in minutes · Cancel anytime · Your documents stay yours",
  },

  footer: {
    tagline: "Documents worth signing, sealed properly.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Pricing", href: "/pricing" },
          { label: "Changelog", href: "/changelog" },
          { label: "Docs", href: "https://seal.nyc/docs" },
        ],
      },
      {
        title: "Developers",
        links: [
          { label: "API reference", href: "https://seal.nyc/reference" },
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
