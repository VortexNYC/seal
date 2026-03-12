import { ArrowRight, Circle, Play } from "lucide-react";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";

const APP_URL = "https://app.seal.co";

/** AI review card mockup shown in the hero */
function AiReviewCard() {
  return (
    <div className="border-border bg-card w-full max-w-md overflow-hidden rounded-xl border shadow-lg">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/15 flex size-6 items-center justify-center rounded">
            <svg
              aria-hidden="true"
              className="text-primary size-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          </div>
          <span className="text-foreground text-sm font-medium">
            Series A Term Sheet — Vantage.pdf
          </span>
        </div>
        <span className="bg-success/15 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
          <Circle aria-hidden="true" className="size-1.5 fill-current" />
          AI reviewing…
        </span>
      </div>

      {/* Issues */}
      <div className="space-y-3 p-4">
        {/* Critical */}
        <div className="bg-destructive/8 border-destructive/20 rounded-lg border p-4">
          <div className="mb-1 flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-destructive mt-0.5 size-2.5 shrink-0 fill-current"
            />
            <span className="text-foreground text-sm font-medium">
              Missing co-founder signature block — Page 6
            </span>
          </div>
          <p className="text-muted-foreground pl-[18px] text-xs leading-relaxed">
            Term sheets with multiple founders require all signatures. This document only captures
            one.
          </p>
          <p className="text-primary mt-2 pl-[18px] text-xs font-medium">Fix this →</p>
        </div>

        {/* Warning */}
        <div className="bg-warning/8 border-warning/20 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-warning mt-0.5 size-2.5 shrink-0 fill-current"
            />
            <div>
              <span className="text-foreground text-sm font-medium">
                Unusual liquidation preference — §4.3
              </span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                3× non-participating preference. Market standard is 1×. Significantly
                investor-favorable.
              </p>
            </div>
          </div>
        </div>

        {/* Pass */}
        <div className="bg-success/8 border-success/20 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-success mt-0.5 size-2.5 shrink-0 fill-current"
            />
            <div>
              <span className="text-foreground text-sm font-medium">
                Pro-rata rights — standard
              </span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Participation rights look market-standard. No flags.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <span className="text-muted-foreground text-xs">2 issues · 1 passed · Page 6 of 8</span>
        <Button size="sm" className="group h-8 text-xs">
          Review & send
          <ArrowRight aria-hidden="true" className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}

const stats = [
  { value: "24k+", label: "DOCUMENTS SIGNED" },
  { value: "4.9", label: "RATING ON G2", icon: "★" },
  { value: "87%", label: "FASTER TURNAROUND" },
];

export function StaticHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-0 sm:pt-36">
      <div className="mx-auto max-w-6xl">
        {/* Two-column layout */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — Copy */}
          <div>
            {/* Eyebrow */}
            <FadeIn>
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-primary h-px w-8" />
                <span className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">
                  The DocuSign Alternative
                </span>
              </div>
            </FadeIn>

            {/* Headline */}
            <FadeIn delay={0.05}>
              <h1 className="text-foreground font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-normal tracking-tight">
                DocuSign doesn&apos;t read your contracts.{" "}
                <span className="text-primary italic">We do.</span>
              </h1>
            </FadeIn>

            {/* Subtitle */}
            <FadeIn delay={0.1}>
              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed text-pretty">
                Seal is the first e-signature platform with AI built in from day one. We catch the
                clauses your lawyer would — before you ever hit send.
              </p>
            </FadeIn>

            {/* CTAs */}
            <FadeIn delay={0.15}>
              <div className="mt-8 flex items-center gap-5">
                <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
                  <a href={`${APP_URL}/sign-up`}>
                    Request access
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </a>
                </Button>
                <a
                  className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm font-medium transition-colors"
                  href="#features"
                >
                  <span className="border-border flex size-9 items-center justify-center rounded-full border transition-colors group-hover:border-current">
                    <Play aria-hidden="true" className="size-3.5 fill-current" />
                  </span>
                  Watch it catch a clause
                </a>
              </div>
            </FadeIn>
          </div>

          {/* Right — AI Review Card */}
          <FadeIn delay={0.2}>
            <div className="flex justify-center lg:justify-end">
              <AiReviewCard />
            </div>
          </FadeIn>
        </div>

        {/* Stats bar */}
        <FadeIn delay={0.3}>
          <div className="border-border mt-20 grid grid-cols-3 divide-x border-t">
            {stats.map((stat) => (
              <div className="py-8 text-center" key={stat.label}>
                <p className="text-foreground font-serif text-3xl tracking-tight sm:text-4xl">
                  {stat.value}
                  {stat.icon && (
                    <span className="text-primary ml-1 text-2xl">{stat.icon}</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px] font-medium tracking-[0.12em] uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Legacy CMS-driven component (kept for backward compat) ──────────── */
// biome-ignore lint/suspicious/noRedundantUseStrict: needed
import type { HeroBlock } from "~/lib/content/types";

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
