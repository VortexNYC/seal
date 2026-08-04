import { createFileRoute } from "@tanstack/react-router";

import { StaticCta } from "~/components/sections/cta-block";
import { StaticFeatures } from "~/components/sections/features-block";
import { StaticHero } from "~/components/sections/hero-block";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seal — The DocuSign alternative with AI built in" },
      {
        name: "description",
        content:
          "Seal is an intelligent document platform — e-signatures, built-in payments, AI clause review, and a full REST API. Free to start.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Seal — The DocuSign alternative with AI built in",
      },
      {
        property: "og:description",
        content:
          "E-signatures, built-in payments, AI clause review, and a full REST API. Free to start.",
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
          "E-signatures, built-in payments, AI clause review, and a full REST API. Free to start.",
      },
      {
        name: "twitter:image",
        content: "https://seal.co/favicon/og-image.png",
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
      <StaticCta />
    </>
  );
}
