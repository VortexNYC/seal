import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { FadeIn } from "~/components/ui/fade-in";
import type { FaqSectionBlock } from "~/lib/content/types";

export function FaqBlockComponent({ block }: { block: FaqSectionBlock }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative overflow-hidden py-24 sm:py-32" id="faq">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_oklch,var(--foreground)_30%,transparent)_50%,transparent_100%)]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {block.headline && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {block.headline}
            </h2>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          {block.faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const questionId = `faq-q-${block._key}-${index}`;
            const answerId = `faq-a-${block._key}-${index}`;

            return (
              <div className="group" key={faq.id}>
                <button
                  aria-controls={answerId}
                  aria-expanded={isOpen}
                  className="border-foreground/10 hover:border-foreground/20 flex w-full items-center justify-between gap-4 border-b py-6 text-left transition-colors"
                  id={questionId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  type="button"
                >
                  <span className="text-foreground text-lg font-medium sm:text-xl">
                    {faq.question}
                  </span>
                  <div
                    className="shrink-0 transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className="text-foreground/50 group-hover:text-info size-5 transition-colors"
                    />
                  </div>
                </button>

                <div
                  aria-labelledby={questionId}
                  className="grid transition-all duration-200"
                  id={answerId}
                  role="region"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="text-foreground/60 pt-4 pb-6 text-pretty">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Static FAQ for the marketing homepage.
 * FAQ JSON-LD schema is injected via the route's head() function.
 */
const staticFaqs = [
  {
    question: "Is Seal legally binding?",
    answer:
      "Yes. Seal complies with the ESIGN Act and UETA, making all signatures legally binding in all 50 US states. Every signature includes a comprehensive audit trail with timestamps, IP addresses, and document hashes.",
  },
  {
    question: "How does the free plan work?",
    answer:
      "The free plan includes 5 documents per month with unlimited recipients. No credit card required. Upgrade to Pro when you need more volume or team features.",
  },
  {
    question: "Can I use Seal with my team?",
    answer:
      "Absolutely. Pro and Enterprise plans include team workspaces with role-based permissions. Admins can manage templates, view all documents, and control who can send.",
  },
  {
    question: "How secure are my documents?",
    answer:
      "Documents are encrypted at rest and in transit. Each signed document gets a SHA-256 hash for tamper detection. Authentication and secure data storage run on Cloudflare's edge infrastructure.",
  },
  {
    question: "Can I integrate Seal with my existing tools?",
    answer:
      "Yes. Seal offers a REST API and webhooks for integration. Connect with your CRM, document management system, or build custom workflows using our API.",
  },
];

/** Exported for use in route head() for JSON-LD schema */
export { staticFaqs };

export function StaticFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-muted/50 px-6 py-24 sm:py-32 lg:py-40" id="faq">
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="mb-16 text-center sm:mb-20">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              FAQ
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Questions? <span className="text-primary">Answers.</span>
            </h2>
            <p className="text-muted-foreground mt-6 text-lg text-pretty">
              Everything you need to know about signing with Seal.
            </p>
          </div>
        </FadeIn>

        {staticFaqs.map((faq, index) => {
          const isOpen = openIndex === index;
          const questionId = `sfaq-q-${index}`;
          const answerId = `sfaq-a-${index}`;

          return (
            <FadeIn delay={0.05 * index} key={faq.question}>
              <div className="group">
                <button
                  aria-controls={answerId}
                  aria-expanded={isOpen}
                  className="border-border hover:border-foreground/20 flex w-full items-center justify-between gap-4 border-b py-6 text-left transition-colors"
                  id={questionId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  type="button"
                >
                  <span className="text-foreground text-lg font-medium sm:text-xl">
                    {faq.question}
                  </span>
                  <div
                    className="shrink-0 transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className="text-muted-foreground group-hover:text-primary size-5 transition-colors"
                    />
                  </div>
                </button>

                <div
                  aria-labelledby={questionId}
                  className="grid transition-all duration-200"
                  id={answerId}
                  role="region"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="text-muted-foreground pt-4 pb-6 text-pretty">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </section>
  );
}
