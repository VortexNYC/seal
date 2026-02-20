import { ArrowRight, Check, Sparkles } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { PricingSectionBlock } from "~/lib/sanity/queries";

const APP_URL = "https://app.seal.co";

export function PricingBlockComponent({ block }: { block: PricingSectionBlock }) {
  return (
    <section className="relative py-24 sm:py-32" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-lg text-pretty text-white/50">{block.description}</p>
            )}
          </div>
        )}

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {block.tiers.map((tier) => (
            <div className="group relative" key={tier._id}>
              <div
                className={`relative h-full rounded-3xl p-8 transition-colors duration-300 lg:p-10 ${
                  tier.highlighted
                    ? "border-2 border-teal-500/50 bg-gradient-to-b from-teal-500/10 to-transparent"
                    : "border border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-8 inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-1.5">
                    <Sparkles aria-hidden="true" className="size-3.5 text-white" />
                    <span className="text-xs font-semibold text-white">Most Popular</span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="mb-2 text-2xl font-bold text-white">{tier.name}</h3>
                  {tier.description && <p className="text-white/50">{tier.description}</p>}
                </div>

                <div className="mb-8">
                  <span className="text-5xl font-bold tracking-tight text-white">
                    ${tier.price}
                  </span>
                  <span className="text-white/50">
                    /{tier.billingPeriod === "yearly" ? "yr" : "mo"}
                  </span>
                </div>

                <ul className="mb-10 space-y-4">
                  {tier.features.map((feature) => (
                    <li className="flex items-center gap-3" key={feature}>
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                          tier.highlighted ? "bg-teal-500/20" : "bg-white/10"
                        }`}
                      >
                        <Check
                          aria-hidden="true"
                          className={`size-3 ${
                            tier.highlighted ? "text-teal-400" : "text-white/60"
                          }`}
                        />
                      </div>
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.ctaLink && (
                  <Button
                    asChild
                    className={`group h-14 w-full rounded-2xl text-base font-semibold ${
                      tier.highlighted
                        ? "bg-teal-600 text-white hover:bg-teal-500"
                        : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                    }`}
                    size="lg"
                  >
                    <a href={tier.ctaLink}>
                      {tier.ctaText || "Get Started"}
                      <ArrowRight
                        aria-hidden="true"
                        className="ml-2 size-4 transition-transform group-hover:translate-x-1"
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

/**
 * Static pricing for when Sanity has no pricing tiers
 */
const staticPlans = [
  {
    name: "Free",
    price: "$0",
    description: "For individuals getting started",
    features: [
      "5 documents per month",
      "Unlimited recipients",
      "Email notifications",
      "Audit trail",
      "PDF download",
    ],
    cta: "Start Free",
    ctaLink: `${APP_URL}/sign-up`,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$15",
    description: "For growing teams",
    features: [
      "Unlimited documents",
      "Team workspaces",
      "Custom branding",
      "Templates",
      "API access",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    ctaLink: `${APP_URL}/sign-up?plan=pro`,
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Advanced compliance",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    ctaLink: "mailto:sales@seal.co",
    highlight: false,
  },
];

export function StaticPricing() {
  return (
    <section className="relative py-24 sm:py-32 lg:py-40" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            Simple, transparent{" "}
            <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
              pricing
            </span>
          </h2>
          <p className="text-lg text-pretty text-white/50 sm:text-xl">
            No hidden fees. No per-signature charges. Just straightforward plans.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {staticPlans.map((plan) => (
            <div className="group relative" key={plan.name}>
              <div
                className={`relative h-full rounded-3xl p-8 transition-colors duration-300 lg:p-10 ${
                  plan.highlight
                    ? "border-2 border-teal-500/50 bg-gradient-to-b from-teal-500/10 to-transparent"
                    : "border border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-8 inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-1.5">
                    <Sparkles aria-hidden="true" className="size-3.5 text-white" />
                    <span className="text-xs font-semibold text-white">Most Popular</span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="mb-2 text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="text-white/50">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <span className="text-5xl font-bold tracking-tight text-white lg:text-6xl">
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && <span className="text-white/50">/mo</span>}
                </div>

                <ul className="mb-10 space-y-4">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-3" key={feature}>
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                          plan.highlight ? "bg-teal-500/20" : "bg-white/10"
                        }`}
                      >
                        <Check
                          aria-hidden="true"
                          className={`size-3 ${plan.highlight ? "text-teal-400" : "text-white/60"}`}
                        />
                      </div>
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={`group h-14 w-full rounded-2xl text-base font-semibold ${
                    plan.highlight
                      ? "bg-teal-600 text-white hover:bg-teal-500"
                      : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  }`}
                  size="lg"
                >
                  <a href={plan.ctaLink}>
                    {plan.cta}
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-2 size-4 transition-transform group-hover:translate-x-1"
                    />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
