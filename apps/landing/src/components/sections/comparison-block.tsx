import { Check, X } from "lucide-react";

import { FadeIn } from "~/components/ui/fade-in";

interface ComparisonItem {
  text: string;
}

const painPoints: ComparisonItem[] = [
  { text: "Per-signature fees that add up fast" },
  { text: "Separate tools for payments" },
  { text: "No API or limited access" },
  { text: "AI features locked behind enterprise" },
];

const benefits: ComparisonItem[] = [
  { text: "Flat monthly pricing, unlimited signatures on Pro" },
  { text: "Built-in payment collection via Stripe" },
  { text: "Full REST API from day one" },
  { text: "AI field detection on every plan" },
];

export function StaticComparison() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <FadeIn>
          <div className="mb-16 text-center sm:mb-20">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Why Seal
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              A better way to handle documents
            </h2>
          </div>
        </FadeIn>

        {/* Comparison cards */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Traditional — neutral card */}
          <FadeIn>
            <div className="border-border bg-card h-full rounded-2xl border p-8 sm:p-10">
              <h3 className="text-foreground mb-8 text-xl font-semibold">
                Traditional e-signature
              </h3>
              <ul className="space-y-5">
                {painPoints.map((item) => (
                  <li className="flex items-start gap-3" key={item.text}>
                    <span className="bg-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <X aria-hidden="true" className="text-muted-foreground size-3.5" />
                    </span>
                    <span className="text-muted-foreground text-sm leading-relaxed">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Seal — accented card */}
          <FadeIn delay={0.1}>
            <div className="border-primary/30 bg-card ring-primary/10 h-full rounded-2xl border p-8 ring-1 sm:p-10">
              <div className="mb-8 flex items-center gap-3">
                <img
                  alt="Seal"
                  className="size-7"
                  height={28}
                  src="/logo/seal-logo-color-no-background.svg"
                  width={28}
                />
                <h3 className="text-foreground text-xl font-semibold">Seal</h3>
              </div>
              <ul className="space-y-5">
                {benefits.map((item) => (
                  <li className="flex items-start gap-3" key={item.text}>
                    <span className="bg-primary/10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <Check aria-hidden="true" className="text-primary size-3.5" />
                    </span>
                    <span className="text-foreground text-sm leading-relaxed">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
