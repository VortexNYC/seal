import { z } from "zod";

const linkSchema = z.object({ label: z.string(), href: z.string() });

const installTabSchema = z.object({
  label: z.string(),
  command: z.string(),
});

const endpointSchema = z.object({
  method: z.enum(["GET", "POST", "DELETE"]),
  path: z.string(),
  desc: z.string(),
});

const tierSchema = z.object({
  name: z.string(),
  price: z.string(),
  unit: z.string(),
  blurb: z.string(),
  features: z.array(z.string()),
  cta: linkSchema,
  featured: z.boolean(),
});

const compareRowSchema = z.object({
  them: z.string(),
  seal: z.string(),
});

export const landing = z
  .object({
    title: z.string(),
    description: z.string(),
    nav: z.object({
      links: z.array(linkSchema),
      signIn: linkSchema,
      cta: linkSchema,
    }),
    hero: z.object({
      eyebrow: z.string(),
      headline: z.string(),
      subheadline: z.string(),
      primaryCta: linkSchema,
      secondaryCta: linkSchema,
      installTabs: z.array(installTabSchema),
      codeFile: z.string(),
      codeSnippet: z.string(),
    }),
    api: z.object({
      index: z.string(),
      eyebrow: z.string(),
      title: z.string(),
      body: z.string(),
      endpoints: z.array(endpointSchema),
      footer: z.string(),
    }),
    manifesto: z.object({
      index: z.string(),
      eyebrow: z.string(),
      title: z.string(),
      definition: z.object({
        term: z.string(),
        phonetic: z.string(),
        pos: z.string(),
        gloss: z.string(),
      }),
      lines: z.array(z.string()),
    }),
    pricing: z.object({
      index: z.string(),
      eyebrow: z.string(),
      title: z.string(),
      subtitle: z.string(),
      tiers: z.array(tierSchema),
      note: z.string(),
    }),
    developer: z.object({
      index: z.string(),
      eyebrow: z.string(),
      title: z.string(),
      body: z.string(),
      points: z.array(z.string()),
      clients: z.string(),
    }),
    comparison: z.object({
      index: z.string(),
      title: z.string(),
      subtitle: z.string(),
      rows: z.array(compareRowSchema),
    }),
    finalCta: z.object({
      headline: z.string(),
      sub: z.string(),
      cta: linkSchema,
      note: z.string(),
    }),
    footer: z.object({
      tagline: z.string(),
      columns: z.array(
        z.object({ title: z.string(), links: z.array(linkSchema) })
      ),
    }),
  })
  .parse({
    title: "Seal — Contracts, as an API",
    description:
      "Seal is contract infrastructure for your code and your agents. Upload, send, sign, audit — signing is free, the platform is the point.",
    nav: {
      links: [
        { label: "API", href: "#api" },
        { label: "Docs", href: "https://docs.seal.nyc" },
        { label: "Pricing", href: "#pricing" },
      ],
      signIn: { label: "Sign in", href: "https://app.seal.nyc" },
      cta: {
        label: "Get an API key",
        href: "https://app.seal.nyc/sign-up?next=developer",
      },
    },
    hero: {
      eyebrow: "Seal — Contract Infrastructure",
      headline: "Where deals get done.",
      subheadline:
        "Seal is the contract API — upload, send, sign, audit. Built for your code, designed for your agents. And signing is free, because paying for a primitive is over.",
      primaryCta: {
        label: "Get an API key",
        href: "https://app.seal.nyc/sign-up?next=developer",
      },
      secondaryCta: { label: "Read the docs", href: "https://docs.seal.nyc" },
      installTabs: [
        { label: "TypeScript", command: "npm install @vortex-api/seal" },
        { label: "Python", command: "pip install vortex-api-seal" },
        {
          label: "Go",
          command: "go get github.com/VortexNYC/seal/packages/sdk-go",
        },
        { label: "MCP", command: "mcp.seal.nyc" },
      ],
      codeFile: "send-contract.ts",
      codeSnippet: `import { createSealClient } from "@vortex-api/seal";

const seal = createSealClient({ apiKey: process.env.SEAL_API_KEY });

const { url } = await seal.request("POST", "/uploads/generate-url", {
  filename: "mutual-nda.pdf",
});
// …upload the PDF to url…

const { id } = await seal.request("POST", "/documents", {
  title: "Mutual NDA",
  source: { uploadedUrl: url },
});

await seal.request("POST", \`/recipients?document_id=\${id}\`, {
  email: "jane@acme.com",
  role: "signer",
});

await seal.request("POST", \`/documents/send?id=\${id}\`);`,
    },
    api: {
      index: "01 / 04",
      eyebrow: "The contract API",
      title: "Every step of a deal, one endpoint away.",
      body: "Documents, recipients, signatures, audit — the full lifecycle of a contract as REST calls, generated from a single OpenAPI spec into typed SDKs.",
      endpoints: [
        {
          method: "POST",
          path: "/uploads/generate-url",
          desc: "Signed upload URL for a document",
        },
        {
          method: "POST",
          path: "/documents",
          desc: "Create a document from the upload",
        },
        {
          method: "GET",
          path: "/documents",
          desc: "List documents with filters",
        },
        {
          method: "POST",
          path: "/recipients",
          desc: "Add a signer, viewer, or approver",
        },
        {
          method: "POST",
          path: "/documents/send",
          desc: "Dispatch signing requests",
        },
        {
          method: "POST",
          path: "/recipients/remind",
          desc: "Nudge an unsigned recipient",
        },
        {
          method: "POST",
          path: "/documents/void",
          desc: "Void an in-flight document",
        },
        {
          method: "GET",
          path: "/signatures/audit",
          desc: "Tamper-evident audit trail",
        },
        {
          method: "POST",
          path: "/templates/use",
          desc: "Document from a template",
        },
      ],
      footer:
        "Full reference at docs.seal.nyc — same spec generates every SDK.",
    },
    manifesto: {
      index: "02 / 04",
      eyebrow: "The thesis",
      title: "Paying for signatures is over.",
      definition: {
        term: "seal",
        phonetic: "/sēl/",
        pos: "n.",
        gloss:
          "a device stamped in wax to authenticate a document — the original signing primitive",
      },
      lines: [
        "A signature is a primitive, not a product. Incumbents charge per seat per month for a bit of ink — then charge again when your team grows.",
        "Seal gives signing away. What you pay for is the platform around it: the API surface, the audit trail, the agent that prepares and chases the contract for you.",
        "Contracts are where deals happen. This is where they get done.",
      ],
    },
    pricing: {
      index: "03 / 04",
      eyebrow: "Pricing",
      title: "Signing is free.",
      subtitle:
        "The incumbents charge per person per month whether or not anyone signs anything. We charge for the platform you actually use.",
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
          cta: {
            label: "Get an API key",
            href: "https://app.seal.nyc/sign-up?next=developer",
          },
          featured: false,
        },
        {
          name: "Platform",
          price: "Metered",
          unit: "per document",
          blurb: "For production deal flow at any volume.",
          features: [
            "500 documents / month included",
            "Then metered per document",
            "White-label signing chrome",
            "Sequential signing + templates",
            "Priority support",
          ],
          cta: {
            label: "Start on Platform",
            href: "https://app.seal.nyc/sign-up?next=developer",
          },
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
      note: "Every tier includes the full API, audit trail, and MCP access.",
    },
    developer: {
      index: "04 / 04",
      eyebrow: "Agent-first",
      title: "Your agent can close the loop.",
      body: "Seal ships a real MCP server, not a marketing claim. Agents can draft documents, add recipients, send for signature, and read the audit trail — with scoped API keys you control.",
      points: [
        "mcp.seal.nyc — remote MCP, OAuth + scoped tokens",
        "Typed SDKs: TypeScript, Python, Go — one OpenAPI spec",
        "Every action lands in the audit trail, agent or human",
      ],
      clients:
        "Works with Claude Code, Cursor, Codex — any MCP client. Your agent already speaks Seal.",
    },
    comparison: {
      index: "",
      title: "Them vs. Seal",
      subtitle: "We read their pricing pages so you don't have to.",
      rows: [
        {
          them: "Per-seat pricing that multiplies as your team grows",
          seal: "Signing is free. You pay for platform usage, not people.",
        },
        {
          them: "Envelope quotas designed to be hit in month eleven",
          seal: "Metered usage you'd have to try to abuse.",
        },
        {
          them: '"Contact sales" where the price should be',
          seal: "A free developer tier and metered usage. No sales call required.",
        },
        {
          them: "Agents bolted on in 2025 press releases",
          seal: "MCP server and typed SDKs since day one.",
        },
        {
          them: "A UI built for administrators",
          seal: "An API built for the thing doing the work.",
        },
      ],
    },
    finalCta: {
      headline: "Ship the deal.",
      sub: "One API key to a signed contract in minutes.",
      cta: {
        label: "Get an API key",
        href: "https://app.seal.nyc/sign-up?next=developer",
      },
      note: "Free tier · No credit card · docs.seal.nyc",
    },
    footer: {
      tagline: "Contract infrastructure for code and agents.",
      columns: [
        {
          title: "Product",
          links: [
            { label: "API Documentation", href: "https://docs.seal.nyc" },
            { label: "Pricing", href: "#pricing" },
            { label: "MCP Server", href: "https://mcp.seal.nyc" },
          ],
        },
        {
          title: "Developers",
          links: [
            {
              label: "TypeScript SDK",
              href: "https://www.npmjs.com/package/@vortex-api/seal",
            },
            { label: "API Reference", href: "https://docs.seal.nyc" },
            { label: "Status", href: "/status" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "App", href: "https://app.seal.nyc" },
            { label: "Contact", href: "mailto:hello@seal.nyc" },
          ],
        },
      ],
    },
  });
