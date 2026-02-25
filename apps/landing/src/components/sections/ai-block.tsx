import { Brain, FileSearch, ScanText, SearchCode } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { FadeIn } from "~/components/ui/fade-in";

interface AiCapability {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const capabilities: AiCapability[] = [
  {
    icon: ScanText,
    title: "Auto-place fields",
    description:
      "Upload a PDF and Seal reads it. Signature, date, and initial fields are placed automatically — no dragging required.",
  },
  {
    icon: FileSearch,
    title: "Extract payment terms",
    description:
      "Invoices and contracts are parsed for amounts, due dates, and payment details. Attach a payment request in one click.",
  },
  {
    icon: Brain,
    title: "Identify key clauses",
    description:
      "Non-standard terms, liability clauses, and renewal conditions are flagged before you sign. Review what matters.",
  },
  {
    icon: SearchCode,
    title: "Semantic search",
    description:
      "Search your workspace by meaning, not just keywords. Find that NDA from last quarter by describing what it covers.",
  },
];

export function StaticAi() {
  return (
    <section className="bg-muted/50 px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-6xl">
        {/* Section header — left-aligned for variety */}
        <FadeIn>
          <div className="mb-20 max-w-2xl">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Intelligence
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Documents that understand themselves
            </h2>
            <p className="text-muted-foreground mt-6 text-lg text-pretty">
              Seal uses AI to read your documents, detect fields, extract terms, and make your entire
              workspace searchable by meaning.
            </p>
          </div>
        </FadeIn>

        {/* Capability grid */}
        <FadeIn delay={0.15}>
          <div className="border-border grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {capabilities.map((cap) => (
              <div className="bg-card p-8 sm:p-10" key={cap.title}>
                <cap.icon aria-hidden="true" className="text-primary mb-5 size-6" />
                <h3 className="text-foreground mb-3 text-lg font-semibold">{cap.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
