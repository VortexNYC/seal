import { ArrowRight, Check } from "lucide-react";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import type { PricingSectionBlock } from "~/lib/sanity/queries";

const APP_URL = "https://app.seal.co";

export function PricingBlockComponent({ block }: { block: PricingSectionBlock }) {
  return (
    <section className="relative py-24 sm:py-32" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-muted-foreground text-lg text-pretty">{block.description}</p>
            )}
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {block.tiers.map((tier) => (
            <div className="group relative" key={tier._id}>
              <div
                className={`border-border relative h-full rounded-2xl border p-8 lg:p-10 ${
                  tier.highlighted ? "bg-primary/5 border-primary/30" : "bg-card"
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-foreground mb-2 text-2xl font-bold">{tier.name}</h3>
                  {tier.description && (
                    <p className="text-muted-foreground">{tier.description}</p>
                  )}
                </div>

                <div className="mb-8">
                  <span className="text-foreground text-5xl font-bold tracking-tight">
                    ${tier.price}
                  </span>
                  <span className="text-muted-foreground">
                    /{tier.billingPeriod === "yearly" ? "yr" : "mo"}
                  </span>
                </div>

                <ul className="mb-10 space-y-3">
                  {tier.features.map((feature) => (
                    <li className="flex items-center gap-3" key={feature}>
                      <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.ctaLink && (
                  <Button
                    asChild
                    className="group h-11 w-full text-sm font-medium"
                    size="lg"
                    variant={tier.highlighted ? "default" : "outline"}
                  >
                    <a href={tier.ctaLink}>
                      {tier.ctaText || "Get Started"}
                      <ArrowRight
                        aria-hidden="true"
                        className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals getting started",
    features: [
      "5 documents per month",
      "Unlimited recipients",
      "Email notifications",
      "Full audit trail",
      "PDF download",
    ],
    cta: "Start Free",
    ctaLink: `${APP_URL}/sign-up`,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$15",
    period: "/mo",
    description: "For teams that move fast",
    features: [
      "Unlimited documents",
      "Team workspaces",
      "Custom branding",
      "Reusable templates",
      "Payments — one-time, recurring, installments",
      "Auto-generated Stripe invoices",
      "REST API access",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    ctaLink: `${APP_URL}/sign-up?plan=pro`,
    highlighted: true,
  },
];

export function StaticPricing() {
  return (
    <section className="px-6 py-32 sm:py-40" id="pricing">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-16 text-center">
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Simple pricing, no surprises
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              No per-signature charges. No hidden fees.
            </p>
          </div>
        </FadeIn>

        {/* Two-tier grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {plans.map((plan, i) => (
            <FadeIn delay={i * 0.1} key={plan.name}>
              <div
                className={`border-border h-full rounded-2xl border p-8 sm:p-10 ${
                  plan.highlighted ? "bg-primary/5 border-primary/20" : "bg-card"
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-foreground mb-1 text-xl font-semibold">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <span className="text-foreground text-5xl font-bold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>

                <ul className="mb-10 space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-3" key={feature}>
                      <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="group h-11 w-full text-sm font-medium"
                  size="lg"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <a href={plan.ctaLink}>
                    {plan.cta}
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

        {/* Enterprise line */}
        <FadeIn delay={0.2}>
          <div className="border-border mt-8 rounded-xl border p-6 text-center">
            <p className="text-foreground text-sm font-medium">
              Need SSO, advanced compliance, or custom integrations?{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:sales@seal.co"
              >
                Talk to us
              </a>
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
