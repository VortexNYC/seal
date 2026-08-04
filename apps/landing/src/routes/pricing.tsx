import { createFileRoute } from "@tanstack/react-router";

import { StaticCta } from "~/components/sections/cta-block";
import { StaticPricing } from "~/components/sections/pricing-block";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Seal" },
      {
        name: "description",
        content:
          "Simple, honest pricing. 10 documents free. Pro from $12/mo — 500 docs/month, REST API, webhooks, and lower payment fees.",
      },
      { property: "og:title", content: "Pricing — Seal" },
      {
        property: "og:description",
        content:
          "No per-envelope surprises. No seat minimums. Just documents, signed.",
      },
      { property: "og:url", content: "https://seal.co/pricing" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <div className="pt-16">
        <StaticPricing />
      </div>
      <StaticCta />
    </>
  );
}
