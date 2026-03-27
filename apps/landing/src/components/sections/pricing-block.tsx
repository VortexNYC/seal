import { ArrowRight, Check, Minus } from "lucide-react";
import { useState } from "react";
<<<<<<< HEAD
import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { APP_URL } from "~/lib/constants";
import type { PricingSectionBlock } from "~/lib/content/types";
import { cn } from "~/utils/cn";

interface Plan {
  name: string;
  price: { monthly: string; annual: string };
  period: string;
  subtitle: string;
  features: Array<{ text: string; included: boolean }>;
  cta: string;
  ctaLink: string;
  highlighted?: boolean;
}

=======

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { cn } from "~/utils/cn";
import type { PricingSectionBlock } from "~/lib/content/types";

import { APP_URL } from "~/lib/constants";

interface Plan {
  name: string;
  price: { monthly: string; annual: string };
  period: string;
  subtitle: string;
  features: Array<{ text: string; included: boolean }>;
  cta: string;
  ctaLink: string;
  highlighted?: boolean;
}

>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
const plans: Plan[] = [
  {
    name: "Free",
    price: { monthly: "$0", annual: "$0" },
    period: "forever",
    subtitle: "For individuals getting started",
    features: [
      { text: "5 documents per month", included: true },
      { text: "Unlimited recipients", included: true },
      { text: "Email notifications", included: true },
      { text: "Full audit trail", included: true },
      { text: "PDF download", included: true },
      { text: "Team workspace", included: false },
      { text: "API access", included: false },
    ],
    cta: "Start Free",
    ctaLink: `${APP_URL}/sign-up`,
  },
  {
    name: "Pro",
    price: { monthly: "$15", annual: "$12" },
    period: "/mo",
    subtitle: "For teams that move fast",
    features: [
      { text: "Unlimited documents", included: true },
      { text: "Team workspaces", included: true },
      { text: "Custom branding", included: true },
      { text: "Reusable templates", included: true },
      { text: "Payments — one-time, recurring, installments", included: true },
      { text: "REST API access", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Start Pro Trial",
    ctaLink: `${APP_URL}/sign-up?plan=pro`,
    highlighted: true,
  },
];

export function StaticPricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="px-6 py-32 sm:py-40" id="pricing">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Pricing
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Simple, honest pricing.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              No per-envelope surprises. No seat minimums. Just documents, signed.
            </p>
          </div>
        </FadeIn>

        {/* Billing toggle */}
        <FadeIn delay={0.05}>
          <div className="mb-12 flex items-center justify-center gap-1">
            <div className="bg-muted inline-flex items-center gap-1 rounded-full p-1">
              <button
                className={cn(
<<<<<<< HEAD
                  "focus-visible:ring-ring rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
=======
                  "rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
                  !annual
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAnnual(false)}
                type="button"
              >
                Monthly
              </button>
              <button
                className={cn(
<<<<<<< HEAD
                  "focus-visible:ring-ring rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
=======
                  "rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
                  annual
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAnnual(true)}
                type="button"
              >
                Annual
                <span className="bg-primary/15 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-semibold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Pricing cards */}
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2" data-testid="pricing-grid">
          {plans.map((plan, i) => (
            <FadeIn delay={i * 0.08} key={plan.name}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-8 sm:p-10",
<<<<<<< HEAD
                  plan.highlighted ? "border-primary/30 bg-primary/5" : "border-border bg-card",
                )}
              >
                {plan.highlighted && (
                  <div className="bg-card text-foreground absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm">
=======
                  plan.highlighted
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card",
                )}
              >
                {plan.highlighted && (
                  <div className="bg-card text-foreground absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wider shadow-sm">
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
                    Most Popular
                  </div>
                )}

                {/* Plan name */}
                <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mb-1">
                  <span className="text-foreground font-serif text-5xl tracking-tight">
                    {annual ? plan.price.annual : plan.price.monthly}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground ml-1 text-sm">{plan.period}</span>
                  )}
                </div>
                <p className="text-muted-foreground mb-8 text-sm">{plan.subtitle}</p>

                {/* Divider */}
                <div className="border-border mb-8 border-t" />

                {/* Features */}
                <ul className="mb-10 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-3" key={feature.text}>
                      {feature.included ? (
                        <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
                      ) : (
                        <Minus
                          aria-hidden="true"
                          className="text-muted-foreground/40 size-4 shrink-0"
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          feature.included ? "text-foreground" : "text-muted-foreground/60",
                        )}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
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
          <div className="border-border mx-auto mt-8 max-w-4xl rounded-xl border p-6 text-center">
            <p className="text-foreground text-sm font-medium">
              Need SSO, advanced compliance, or custom integrations?{" "}
              <a className="text-primary hover:underline" href="mailto:sales@seal.co">
                Talk to us
              </a>
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Legacy CMS-driven component ───────────────────────────────────────── */
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
            <div className="group relative" key={tier.id}>
              <div
                className={`border-border relative h-full rounded-2xl border p-8 lg:p-10 ${
                  tier.highlighted ? "bg-primary/5 border-primary/30" : "bg-card"
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-foreground mb-2 text-2xl font-bold">{tier.name}</h3>
                  {tier.description && <p className="text-muted-foreground">{tier.description}</p>}
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
