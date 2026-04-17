import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { APP_URL } from "~/lib/constants";
import type { HeroBlock } from "~/lib/content/types";

export function StaticHero() {
  return (
    <section className="relative px-6 pt-[clamp(8rem,22vh,14rem)] pb-16">
      {/* Headline — kept unconditionally visible since it's above the fold */}
      <div className="text-center">
        <h1 className="text-foreground mx-auto max-w-[24ch] font-serif text-[clamp(2.5rem,6vw,5rem)] font-normal tracking-tight text-balance">
          The old tools offer e-signature.
          <br />
          <span className="text-primary italic">We built an engine.</span>
        </h1>
      </div>

      {/* CTAs */}
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
          <a href={`${APP_URL}/waitlist`}>
            Join Waitlist
            <ArrowRight
              aria-hidden="true"
              className="ml-1 size-4 transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </Button>
        <a
          className="text-foreground/80 hover:text-foreground text-base font-medium underline-offset-4 hover:underline"
          href="#features"
        >
          See how it works
        </a>
      </div>

      {/* Mockup */}
      <div className="relative mx-auto mt-16 max-w-6xl">
        {/* Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-12 opacity-50 blur-[100px] [background:radial-gradient(ellipse_at_50%_40%,#A63D2F_0%,#c4503e_20%,#A63D2F33_60%,transparent_85%)]"
        />
        {/* Mockup card — mask fades the whole card including its clip boundary */}
        <div className="relative overflow-hidden rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_40%,transparent_88%)]">
          {/* Browser chrome */}
          <div className="border-border bg-muted/40 border-b">
            <div className="flex items-end gap-0 px-3 pt-2.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <span className="size-2.5 rounded-full bg-red-400/60" />
                <span className="size-2.5 rounded-full bg-yellow-400/60" />
                <span className="size-2.5 rounded-full bg-green-400/60" />
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
          {/* Stylized document preview */}
          <div className="bg-background relative h-[580px] overflow-hidden">
            <div className="mx-auto max-w-[640px] px-10 pt-12">
              <div className="bg-muted h-4 w-48 rounded" />
              <div className="mt-2 space-y-1.5">
                <div className="bg-muted/60 h-2 w-full rounded" />
                <div className="bg-muted/60 h-2 w-[92%] rounded" />
              </div>

              <div className="mt-8 space-y-2">
                <div className="bg-muted/60 h-2 w-full rounded" />
                <div className="bg-muted/60 h-2 w-[88%] rounded" />
                <div className="bg-muted/60 h-2 w-[95%] rounded" />
                <div className="bg-muted/60 h-2 w-[80%] rounded" />
                <div className="bg-muted/60 h-2 w-[92%] rounded" />
              </div>

              <div className="mt-10 space-y-2">
                <div className="bg-muted/60 h-2 w-[90%] rounded" />
                <div className="bg-muted/60 h-2 w-full rounded" />
                <div className="bg-muted/60 h-2 w-[85%] rounded" />
              </div>

              {/* Signature block */}
              <div className="border-primary/30 bg-primary/5 mt-10 rounded-lg border border-dashed p-5">
                <p className="text-muted-foreground text-[0.6875rem] font-medium tracking-wider uppercase">
                  Sign here
                </p>
                <p className="text-foreground mt-2 font-serif text-2xl italic">Sarah Chen</p>
                <div className="text-muted-foreground mt-3 flex items-center gap-4 text-[0.6875rem]">
                  <span>Signed Mar 3, 2026 · 10:42 AM</span>
                  <span className="bg-success/15 text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium">
                    <span className="bg-success size-1.5 rounded-full" />
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
