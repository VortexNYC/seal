import { CreditCard, FileSignature, Workflow } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { FadeIn } from "~/components/ui/fade-in";
import type { FeaturesSectionBlock } from "~/lib/sanity/queries";

const GRID_LAYOUTS: Record<string, string> = {
  "grid-2": "sm:grid-cols-2",
  alternating: "sm:grid-cols-1 max-w-3xl",
};

export function FeaturesBlockComponent({ block }: { block: FeaturesSectionBlock }) {
  const gridCols = GRID_LAYOUTS[block.layout ?? ""] ?? "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.eyebrow && (
              <p className="text-primary mb-4 text-sm font-medium tracking-wider uppercase">
                {block.eyebrow}
              </p>
            )}
            {block.headline && (
              <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-muted-foreground text-lg text-pretty">{block.description}</p>
            )}
          </div>
        )}

        <div className={`mx-auto grid max-w-6xl gap-6 lg:gap-8 ${gridCols}`}>
          {block.features.map((feature) => (
            <div className="group relative" key={feature.title}>
              <div className="border-border hover:border-border/80 relative h-full rounded-2xl border p-8 transition-colors duration-200">
                {feature.icon && (
                  <div className="bg-primary/10 mb-6 flex size-12 items-center justify-center rounded-xl">
                    <span className="text-2xl">{feature.icon}</span>
                  </div>
                )}
                <h3 className="text-foreground mb-3 text-xl font-semibold">{feature.title}</h3>
                {feature.description && (
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Pillar {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  headline: string;
  description: string;
}

const pillars: Pillar[] = [
  {
    icon: FileSignature,
    title: "Sign",
    headline: "Signatures that hold up",
    description:
      "Upload any PDF, place fields with drag-and-drop, and send for legally binding signatures. Full audit trails, SHA-256 hashing, and ESIGN compliance built in.",
  },
  {
    icon: CreditCard,
    title: "Pay",
    headline: "Collect payments at signing",
    description:
      "Attach payment requests to any document. Recipients sign and pay in one step. Powered by Stripe Connect — funds go directly to your account.",
  },
  {
    icon: Workflow,
    title: "Automate",
    headline: "Workflows that run themselves",
    description:
      "Reusable templates with pre-placed fields. Webhook notifications for every event. A full REST API to build document workflows into your product.",
  },
];

export function StaticFeatures() {
  return (
    <section className="px-6 py-32 sm:py-40" id="features">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <FadeIn>
          <div className="mb-20 max-w-2xl">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Capabilities
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Three things, done exceptionally well
            </h2>
          </div>
        </FadeIn>

        {/* Pillars */}
        <div className="grid gap-8 lg:grid-cols-3">
          {pillars.map((pillar, i) => (
            <FadeIn delay={i * 0.1} key={pillar.title}>
              <div className="flex h-full flex-col">
                <div className="border-border border-t pt-8">
                  <div className="bg-primary/10 mb-6 flex size-12 items-center justify-center rounded-xl">
                    <pillar.icon aria-hidden="true" className="text-primary size-6" />
                  </div>
                  <p className="text-primary mb-2 text-sm font-semibold uppercase tracking-wider">
                    {pillar.title}
                  </p>
                  <h3 className="text-foreground font-serif mb-4 text-2xl sm:text-3xl">
                    {pillar.headline}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed text-pretty">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
