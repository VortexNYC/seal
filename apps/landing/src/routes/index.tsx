import { createFileRoute } from "@tanstack/react-router";

import { staticFaqs } from "~/components/sections";
import { StaticCta } from "~/components/sections/cta-block";
import { StaticFaq } from "~/components/sections/faq-block";
import { StaticFeatures } from "~/components/sections/features-block";
import { StaticHero } from "~/components/sections/hero-block";
import { StaticPricing } from "~/components/sections/pricing-block";

// FAQ Schema for JSON-LD — injected via TanStack Router head() scripts
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: staticFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seal - Document Signatures Made Simple" },
      {
        name: "description",
        content:
          "Sign, send, and manage documents securely. ESIGN compliant digital signatures with audit trails. Free to start. No credit card required.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Seal - Document Signatures Made Simple",
      },
      {
        property: "og:description",
        content:
          "Sign, send, and manage documents securely. ESIGN compliant digital signatures with audit trails. Free to start.",
      },
      { property: "og:url", content: "https://seal.co" },
      { property: "og:image", content: "https://seal.co/favicon/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Seal - Document Signatures Made Simple",
      },
      {
        name: "twitter:description",
        content:
          "Sign, send, and manage documents securely. ESIGN compliant digital signatures with audit trails.",
      },
      { name: "twitter:image", content: "https://seal.co/favicon/og-image.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(faqSchema),
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="flex-1">
      <StaticHero />
      <StaticFeatures />
      <StaticPricing />
      <StaticFaq />
      <StaticCta />
    </div>
  );
}
