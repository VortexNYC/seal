import type { LandingPage } from "./types";

export function generateJsonLd(page: LandingPage): object[] {
  const schemas: object[] = [];

  for (const block of page.content) {
    if (block._type === "faqSection" && block.faqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: block.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      });
    }
  }

  return schemas;
}
