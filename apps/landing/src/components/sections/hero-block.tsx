import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { APP_URL } from "~/lib/constants";
import type { HeroBlock } from "~/lib/content/types";

export function StaticHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:pt-36 sm:pb-28">
      <div className="mx-auto max-w-4xl">
        {/* Eyebrow */}
        <FadeIn>
          <p className="text-primary mb-6 text-sm font-semibold tracking-wider uppercase">
            The DocuSign Alternative
          </p>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.05}>
          <h1 className="text-foreground font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] font-normal tracking-tight">
            DocuSign doesn&apos;t read your contracts.{" "}
            <span className="text-primary italic">We do.</span>
          </h1>
        </FadeIn>

        {/* Subtitle */}
        <FadeIn delay={0.1}>
          <p className="text-muted-foreground mt-8 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
            Seal is the first e-signature platform with AI built in from day one. We catch the
            clauses your lawyer would — before you ever hit send.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.15}>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
              <a href={`${APP_URL}/sign-up`}>
                Start Free
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </Button>
            <Button asChild className="h-12 px-8 text-base font-medium" size="lg" variant="outline">
              <a href="#features">See how it works</a>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── CMS-driven component (used by page-builder.tsx) ─────────────────── */
export function HeroBlockComponent({ block }: { block: HeroBlock }) {
  return (
    <section className="relative flex min-h-[70dvh] flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <h1 className="text-foreground mb-6 text-5xl font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {block.headline}
          </h1>
        </FadeIn>
        {block.subheadline && (
          <FadeIn delay={0.1}>
            <p className="text-muted-foreground mb-12 max-w-2xl text-xl text-pretty sm:text-2xl">
              {block.subheadline}
            </p>
          </FadeIn>
        )}
        {(block.primaryCta || block.secondaryCta) && (
          <FadeIn delay={0.2}>
            <div className="flex flex-col gap-4 sm:flex-row">
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
          </FadeIn>
        )}
      </div>
    </section>
  );
}
