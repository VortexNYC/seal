import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { APP_URL } from "~/lib/constants";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Seal vs DocuSign, HelloSign, PandaDoc, Agree — Compare" },
      {
        name: "description",
        content:
          "See how Seal compares to DocuSign, HelloSign, PandaDoc, and Agree. AI-powered document review, built-in payments, and a full REST API — at a fraction of the cost.",
      },
      { property: "og:title", content: "Seal vs DocuSign, HelloSign, PandaDoc, Agree" },
      {
        property: "og:description",
        content:
          "AI document review, built-in payments, and a developer API — at $15/mo instead of $599/mo.",
      },
      { property: "og:url", content: "https://seal.co/compare" },
    ],
  }),
  component: ComparePage,
});

interface Feature {
  name: string;
  seal: boolean | string;
  docusign: boolean | string;
  hellosign: boolean | string;
  pandadoc: boolean | string;
  agree: boolean | string;
  highlight?: boolean;
}

const features: Feature[] = [
  {
    name: "E-signatures",
    seal: true,
    docusign: true,
    hellosign: true,
    pandadoc: true,
    agree: true,
  },
  {
    name: "No per-envelope fees",
    seal: true,
    docusign: false,
    hellosign: false,
    pandadoc: false,
    agree: true,
    highlight: true,
  },
  {
    name: "Free plan available",
    seal: true,
    docusign: false,
    hellosign: false,
    pandadoc: false,
    agree: false,
  },
  {
    name: "Built-in payment collection",
    seal: true,
    docusign: false,
    hellosign: false,
    pandadoc: "Add-on",
    agree: true,
    highlight: true,
  },
  {
    name: "Recurring & installment billing",
    seal: true,
    docusign: false,
    hellosign: false,
    pandadoc: false,
    agree: true,
    highlight: true,
  },
  {
    name: "AI clause review",
    seal: true,
    docusign: "Enterprise only",
    hellosign: false,
    pandadoc: false,
    agree: false,
    highlight: true,
  },
  {
    name: "AI field detection",
    seal: true,
    docusign: "Enterprise only",
    hellosign: false,
    pandadoc: false,
    agree: false,
    highlight: true,
  },
  {
    name: "Full REST API",
    seal: true,
    docusign: "Enterprise only",
    hellosign: "Paid plans",
    pandadoc: "Paid plans",
    agree: "Growth+",
    highlight: true,
  },
  {
    name: "Webhooks",
    seal: true,
    docusign: "Enterprise only",
    hellosign: "Paid plans",
    pandadoc: "Paid plans",
    agree: "Growth+",
  },
  {
    name: "Audit trail",
    seal: true,
    docusign: true,
    hellosign: true,
    pandadoc: true,
    agree: true,
  },
  {
    name: "Reusable templates",
    seal: true,
    docusign: true,
    hellosign: "Paid plans",
    pandadoc: true,
    agree: true,
  },
  {
    name: "Custom branding",
    seal: true,
    docusign: "Enterprise only",
    hellosign: "Paid plans",
    pandadoc: "Paid plans",
    agree: "Growth+",
  },
  {
    name: "ESIGN & UETA compliant",
    seal: true,
    docusign: true,
    hellosign: true,
    pandadoc: true,
    agree: true,
  },
  {
    name: "Starts at",
    seal: "$0 / Free",
    docusign: "$15/user/mo",
    hellosign: "$20/user/mo",
    pandadoc: "$35/user/mo",
    agree: "$599/mo",
    highlight: true,
  },
];

const competitors = ["Seal", "DocuSign", "HelloSign", "PandaDoc", "Agree"] as const;

function CellValue({ value, isSeal }: { value: boolean | string; isSeal?: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check
          aria-hidden="true"
          className={`size-5 ${isSeal ? "text-primary" : "text-primary/60"}`}
        />
        <span className="sr-only">Yes</span>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <X aria-hidden="true" className="text-muted-foreground/40 size-5" />
        <span className="sr-only">No</span>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <span className={`text-xs ${isSeal ? "text-primary font-medium" : "text-muted-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

const alternativesData = [
  {
    name: "DocuSign",
    tagline: "The incumbent. Expensive, inflexible, no AI.",
    pricing: "From $15/user/mo + per-envelope fees",
    verdict:
      "DocuSign built its business before AI existed and before payments mattered. You're paying a legacy tax — bloated enterprise pricing, no built-in payments, and AI features gated behind plans that start at $65/user/month. If you just need basic e-signatures, it works. If you need anything more, you're duct-taping third-party tools together.",
    weaknesses: [
      "Per-envelope fees on most plans",
      "API access requires Enterprise contract",
      "No payment collection — you'll need Stripe separately",
      "AI features cost 4× more than Seal Pro",
    ],
  },
  {
    name: "HelloSign (Dropbox Sign)",
    tagline: "Simpler than DocuSign. Still missing the same things.",
    pricing: "From $20/user/mo",
    verdict:
      "HelloSign was a decent lightweight alternative until Dropbox acquired it and raised prices. It's cleaner than DocuSign, but still has no payments, no AI, and a limited API. The Dropbox integration is useful if you already live there — otherwise, you're paying for simplicity without getting any of the modern features.",
    weaknesses: [
      "No payment collection built in",
      "No AI review or clause detection",
      "API limited to paid plans, no webhooks on starter",
      "Dropbox acquisition killed independent momentum",
    ],
  },
  {
    name: "PandaDoc",
    tagline: "More features, more complexity, more cost.",
    pricing: "From $35/user/mo",
    verdict:
      "PandaDoc is the most feature-rich of the old guard — it has a document editor, payments (as an add-on), and templates. But it's also the most expensive and complex. It's built for sales teams creating proposals, not engineering teams integrating document workflows. The API is limited, payments require a third-party add-on, and AI features are nowhere.",
    weaknesses: [
      "Payments require add-on — not native",
      "No AI document review",
      "Complex setup, not API-first",
      "$35+/seat/mo before payments add-on",
    ],
  },
  {
    name: "Agree.com",
    tagline: "Contract-to-Cash for mid-market. $599/mo minimum.",
    pricing: "From $599/mo (Growth tier)",
    verdict:
      'Agree raised $10M+ and pivoted from a simple e-sig tool to a full "Contract-to-Cash" platform — agreements, billing, dunning, ARR dashboards. It\'s real product, and the payment automation is genuinely well-built. But there\'s no free plan, Growth starts at $599/mo, and their 6 "AI agents" are automation workflows with agent branding — not actual AI document understanding. Agree targets finance teams at mid-market companies. Seal targets developers and B2B teams who need document infrastructure, not a revenue ops platform.',
    weaknesses: [
      "No free plan — minimum $599/mo (Growth tier)",
      "No actual AI clause review — automation workflows branded as AI",
      "Built for revenue ops, not developer integration",
      "API access locked to Growth+ tier",
    ],
  },
];

function ComparePage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="text-primary mb-6 text-sm font-semibold tracking-wider uppercase">
              Seal vs. the alternatives
            </p>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1 className="text-foreground font-serif text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-normal tracking-tight">
              The old tools built e-signatures.{" "}
              <span className="text-primary italic">We built a document platform.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
              DocuSign, HelloSign, PandaDoc, and Agree all solve variations of the same problem.
              Seal solves the full one: sign, collect payment, review with AI, and connect to your
              stack — at a price that doesn't require a procurement meeting.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-8">
              <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
                <a href={`${APP_URL}/waitlist`}>
                  Join Waitlist
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-10">
              <h2 className="text-foreground font-serif text-3xl tracking-tight sm:text-4xl">
                Feature comparison
              </h2>
              <p className="text-muted-foreground mt-3 text-base">
                The honest breakdown. No asterisks.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <div className="border-border overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[640px] border-collapse">
                {/* Header */}
                <thead>
                  <tr className="bg-muted/30 border-border border-b">
                    <th className="px-5 py-4 text-left">
                      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Feature
                      </span>
                    </th>
                    {competitors.map((c) => (
                      <th
                        className={`px-3 py-4 text-center ${c === "Seal" ? "bg-primary/5" : ""}`}
                        key={c}
                      >
                        <span
                          className={`text-sm font-semibold ${c === "Seal" ? "text-primary" : "text-foreground"}`}
                        >
                          {c}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, i) => (
                    <tr
                      className={`border-border border-b last:border-0 ${
                        feature.highlight ? "bg-primary/[0.02]" : ""
                      } ${i % 2 === 0 ? "" : "bg-muted/[0.04]"}`}
                      key={feature.name}
                    >
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-sm ${feature.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}
                        >
                          {feature.name}
                        </span>
                      </td>
                      <td className="bg-primary/5 px-3 py-3.5">
                        <CellValue value={feature.seal} isSeal />
                      </td>
                      <td className="px-3 py-3.5">
                        <CellValue value={feature.docusign} />
                      </td>
                      <td className="px-3 py-3.5">
                        <CellValue value={feature.hellosign} />
                      </td>
                      <td className="px-3 py-3.5">
                        <CellValue value={feature.pandadoc} />
                      </td>
                      <td className="px-3 py-3.5">
                        <CellValue value={feature.agree} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Detailed breakdowns */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-12">
              <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
                The honest verdict
              </p>
              <h2 className="text-foreground font-serif text-3xl tracking-tight sm:text-4xl">
                Why teams switch to Seal
              </h2>
            </div>
          </FadeIn>

          <div className="space-y-8">
            {alternativesData.map((alt, i) => (
              <FadeIn delay={i * 0.07} key={alt.name}>
                <div className="border-border bg-card rounded-2xl border p-8 sm:p-10">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-foreground text-xl font-semibold">{alt.name}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{alt.tagline}</p>
                    </div>
                    <span className="border-border bg-muted/40 text-muted-foreground rounded-full border px-3 py-1 text-xs">
                      {alt.pricing}
                    </span>
                  </div>

                  <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    {alt.verdict}
                  </p>

                  <div>
                    <p className="text-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Key gaps
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {alt.weaknesses.map((w) => (
                        <li className="flex items-start gap-2.5" key={w}>
                          <X
                            aria-hidden="true"
                            className="text-muted-foreground/50 mt-0.5 size-4 shrink-0"
                          />
                          <span className="text-muted-foreground text-sm">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-border border-t px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Ready to make the switch?
            </h2>
            <p className="text-muted-foreground mt-6 text-lg text-pretty">
              Free plan, no credit card required. Most teams are up and running in under two
              minutes.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
                <a href={`${APP_URL}/waitlist`}>
                  Join Waitlist
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </Button>
              <Button
                asChild
                className="h-12 px-8 text-base font-medium"
                size="lg"
                variant="outline"
              >
                <a href="mailto:sales@seal.co">Talk to sales</a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
