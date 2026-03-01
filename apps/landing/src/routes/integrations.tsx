import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Code2, Webhook } from "lucide-react";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations - Seal" },
      {
        name: "description",
        content:
          "Connect Seal with your stack. Full REST API, real-time webhooks, MCP server for AI agents, and built-in Stripe payments.",
      },
    ],
  }),
  component: IntegrationsPage,
});

interface Integration {
  icon: typeof Code2;
  title: string;
  description: string;
  docsPath: string;
}

const integrations: Integration[] = [
  {
    icon: Code2,
    title: "REST API",
    description:
      "Full CRUD for documents, recipients, templates, and signatures. Typed responses, OpenAPI spec, and scoped API keys for secure programmatic access.",
    docsPath: "/docs/api-reference",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description:
      "Real-time notifications for every document event — sent, viewed, signed, completed, declined. HMAC-SHA256 signed payloads with automatic retries.",
    docsPath: "/docs/webhooks",
  },
  {
    icon: Bot,
    title: "MCP Server",
    description:
      "AI-native integration for Claude, GPT, and other agents. Create documents, manage recipients, and check signing status from any MCP-compatible assistant.",
    docsPath: "/docs/mcp",
  },
];

function IntegrationsPage() {
  return (
    <div className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <FadeIn>
          <div className="mx-auto mb-20 max-w-3xl text-center">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Integrations
            </p>
            <h1 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Built to connect
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
              Seal is API-first from day one. Build document signing into your product, automate
              workflows with webhooks, or let AI agents handle it through MCP.
            </p>
          </div>
        </FadeIn>

        {/* Integration cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {integrations.map((integration, i) => (
            <FadeIn delay={i * 0.1} key={integration.title}>
              <div className="border-border bg-card flex h-full flex-col rounded-2xl border p-8 sm:p-10">
                <integration.icon aria-hidden="true" className="text-primary mb-6 size-8" />
                <h2 className="text-foreground mb-3 text-xl font-semibold">{integration.title}</h2>
                <p className="text-muted-foreground mb-8 flex-1 text-sm leading-relaxed text-pretty">
                  {integration.description}
                </p>
                <Button asChild className="group w-fit" variant="outline">
                  <a href={integration.docsPath}>
                    Read the docs
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </a>
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Payments — Powered by Stripe */}
        <FadeIn delay={0.3}>
          <div className="border-border bg-card mt-6 rounded-2xl border p-8 sm:p-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
              <img
                alt="Stripe"
                className="h-8 shrink-0 opacity-60 invert dark:invert-0"
                height={32}
                src="/stripe-wordmark-white.svg"
                width={80}
              />
              <div>
                <h2 className="text-foreground mb-3 text-xl font-semibold">
                  Payments powered by Stripe
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  Collect payments alongside signatures. Attach a payment request to any document
                  and recipients pay with Stripe&apos;s secure checkout before or after signing. No
                  separate invoicing tool needed.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Bottom CTA */}
        <FadeIn delay={0.4}>
          <div className="mt-20 text-center">
            <h2 className="text-foreground font-serif text-3xl tracking-tight sm:text-4xl">
              Ready to build?
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-pretty">
              Get started with the API in minutes. Create an account, generate an API key, and send
              your first document.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild className="group">
                <a href="/docs/getting-started/quick-start">
                  Quick start guide
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/docs/api-reference">API reference</a>
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
