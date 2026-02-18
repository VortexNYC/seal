import type { Page } from "./queries";

/**
 * Generate JSON-LD structured data based on page content blocks.
 * - faqSection blocks produce FAQPage schema
 */
export function generateJsonLd(page: Page): object[] {
  const schemas: object[] = [];

  for (const block of page.content || []) {
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
