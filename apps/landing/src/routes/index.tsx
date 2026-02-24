import { createFileRoute } from "@tanstack/react-router";

import { StaticAi } from "~/components/sections/ai-block";
import { StaticComparison } from "~/components/sections/comparison-block";
import { StaticCta } from "~/components/sections/cta-block";
import { StaticDevelopers } from "~/components/sections/developers-block";
import { staticFaqs, StaticFaq } from "~/components/sections/faq-block";
import { StaticFeatures } from "~/components/sections/features-block";
import { StaticHero } from "~/components/sections/hero-block";
import { StaticPricing } from "~/components/sections/pricing-block";
import { StaticProductShowcase } from "~/components/sections/product-showcase-block";
import { StaticStatement } from "~/components/sections/statement-block";

const faqJsonLd = JSON.stringify({
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
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seal — Documents that work for you" },
      {
        name: "description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API. Free to start.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Seal — Documents that work for you",
      },
      {
        property: "og:description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API.",
      },
      { property: "og:url", content: "https://seal.co" },
      { property: "og:image", content: "https://seal.co/favicon/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Seal — Documents that work for you",
      },
      {
        name: "twitter:description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API.",
      },
      { name: "twitter:image", content: "https://seal.co/favicon/og-image.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: faqJsonLd,
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <StaticHero />
      <StaticFeatures />
      <StaticStatement />
      <StaticAi />
      <StaticProductShowcase />
      <StaticComparison />
      <StaticDevelopers />
      <StaticPricing />
      <StaticFaq />
      <StaticCta />
    </>
  );
}
