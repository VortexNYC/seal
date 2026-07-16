import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import type { HeroBlock } from "~/lib/content/types";

export function StaticHero() {
  return (
    <section className="relative px-6 pt-[clamp(8rem,22vh,14rem)] pb-16">
      {/* Headline */}
      <div className="mx-auto max-w-4xl text-center">
        <FadeIn delay={0.05}>
          <h1 className="text-foreground font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] font-normal tracking-tight">
            The old tools offer e-signature.
            <br />
            <span className="text-primary italic">We built an engine.</span>
          </h1>
        </FadeIn>
      </div>

      {/* Mockup */}
      <FadeIn delay={0.2}>
        <div className="relative mx-auto mt-16 max-w-6xl">
          {/* Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-12 opacity-50 blur-[100px]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, var(--primary) 0%, var(--brand-500) 20%, color-mix(in oklch, var(--primary) 20%, transparent) 60%, transparent 85%)",
            }}
          />
          {/* Mockup card — mask fades the whole card including its clip boundary */}
          <div className="relative overflow-hidden rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_40%,transparent_88%)]">
            {/* Browser chrome */}
            <div className="border-border bg-muted/40 border-b">
              <div className="flex items-end gap-0 px-3 pt-2.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="size-2.5 rounded-full bg-destructive/60" />
                  <span className="size-2.5 rounded-full bg-warning/60" />
                  <span className="size-2.5 rounded-full bg-success/60" />
                </div>
                <div className="bg-background/60 border-border/40 flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5">
                  <svg
                    className="text-primary size-3 shrink-0"
                    fill="none"
                    viewBox="0 0 16 16"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l3.414 3.414A1 1 0 0 1 14 5.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2Z"
                      fill="currentColor"
                      opacity="0.2"
                    />
                    <path
                      d="M9 1.5V5a1 1 0 0 0 1 1h3.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l3.414 3.414A1 1 0 0 1 14 5.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.2"
                    />
                  </svg>
                  <span className="text-foreground/70 max-w-[180px] truncate text-xs">
                    ACME Corp — Service Agreement.pdf
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="bg-muted/60 flex-1 rounded px-3 py-1">
                  <span className="text-muted-foreground text-xs">app.seal.co</span>
                </div>
              </div>
            </div>
            {/* Screenshot area — placeholder until /public/product-screenshot.png is added */}
            <div className="bg-muted/10 h-[580px]">
              <img
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-top"
                src="/product-screenshot.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </FadeIn>
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
