import { createFileRoute } from "@tanstack/react-router";

import { StaticCta } from "~/components/sections/cta-block";
import { StaticDevelopers } from "~/components/sections/developers-block";
import { staticFaqs, StaticFaq } from "~/components/sections/faq-block";
import { StaticFeatures } from "~/components/sections/features-block";
import { StaticHero } from "~/components/sections/hero-block";
import { StaticPricing } from "~/components/sections/pricing-block";
import { StaticSocialProof } from "~/components/sections/social-proof-block";

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
      { title: "Seal — The DocuSign alternative with AI built in" },
      {
        name: "description",
        content:
          "Seal reads your contracts before you sign them. AI-powered e-signatures with built-in clause review, payments, and a full REST API. Free to start.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Seal — The DocuSign alternative with AI built in",
      },
      {
        property: "og:description",
        content:
          "Seal reads your contracts before you sign them. AI-powered e-signatures with built-in clause review, payments, and a full REST API.",
      },
      { property: "og:url", content: "https://seal.co" },
      { property: "og:image", content: "https://seal.co/favicon/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Seal — The DocuSign alternative with AI built in",
      },
      {
        name: "twitter:description",
        content:
          "Seal reads your contracts before you sign them. AI-powered e-signatures with built-in clause review, payments, and a full REST API.",
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
      <StaticSocialProof />
      <StaticDevelopers />
      <StaticPricing />
      <StaticFaq />
      <StaticCta />
    </>
  );
}
