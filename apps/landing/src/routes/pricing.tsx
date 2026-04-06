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
          "Simple, honest pricing. No per-envelope fees. No seat minimums. Free forever plan with unlimited recipients. Pro from $12/mo.",
      },
      { property: "og:title", content: "Pricing — Seal" },
      {
        property: "og:description",
        content: "No per-envelope surprises. No seat minimums. Just documents, signed.",
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
