import { ArrowRight } from "lucide-react";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import type { CtaSectionBlock } from "~/lib/content/types";

const APP_URL = "https://app.seal.co";

export function StaticCta() {
  return (
    <section className="border-border border-t px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-3xl text-center">
        <FadeIn>
          <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
            Ready to stop signing contracts you haven&apos;t read?
          </h2>
          <p className="text-muted-foreground mt-6 text-lg text-pretty">
            Free to start. No credit card required. Set up your first document in under two minutes.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
              <a href={`${APP_URL}/sign-up`}>
                Request access
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </Button>
            <Button asChild className="h-12 px-8 text-base font-medium" size="lg" variant="outline">
              <a href="mailto:sales@seal.co">Talk to sales</a>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Legacy CMS-driven component ───────────────────────────────────────── */
export function CtaBlockComponent({ block }: { block: CtaSectionBlock }) {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
          {block.headline}
        </h2>
        {block.description && (
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
            {block.description}
          </p>
        )}
        {(block.primaryCta || block.secondaryCta) && (
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {block.primaryCta && (
              <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
                <a href={block.primaryCta.link}>
                  {block.primaryCta.text}
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </Button>
            )}
            {block.secondaryCta && (
              <Button
                asChild
                className="h-12 px-8 text-base font-medium"
                size="lg"
                variant="outline"
              >
                <a href={block.secondaryCta.link}>{block.secondaryCta.text}</a>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
