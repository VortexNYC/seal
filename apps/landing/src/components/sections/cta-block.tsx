import { ArrowRight } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { CtaSectionBlock } from "~/lib/sanity/queries";

const APP_URL = "https://app.seal.co";

const BG_STYLES: Record<string, string> = {
  gradient:
    "bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,oklch(0.6_0.13_175_/_0.15)_0%,transparent_60%)]",
  dark: "bg-black/40",
};

export function CtaBlockComponent({ block }: { block: CtaSectionBlock }) {
  const defaultBg = BG_STYLES.gradient;
  const bgClass = BG_STYLES[block.style ?? ""] ?? defaultBg;

  return (
    <section className="relative overflow-hidden py-32 sm:py-40">
      <div className={`pointer-events-none absolute inset-0 -z-10 ${bgClass}`} />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-5xl font-bold tracking-tight text-white text-balance sm:text-6xl">
            {block.headline}
          </h2>

          {block.description && (
            <p className="mx-auto mb-12 max-w-2xl text-xl text-white/60 text-pretty">
              {block.description}
            </p>
          )}

          {(block.primaryCta || block.secondaryCta) && (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              {block.primaryCta && (
                <Button
                  asChild
                  className="group h-14 bg-teal-600 px-10 text-base font-semibold text-white hover:bg-teal-500"
                  size="lg"
                >
                  <a href={block.primaryCta.link}>
                    {block.primaryCta.text}
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-2 size-5 transition-transform group-hover:translate-x-1"
                    />
                  </a>
                </Button>
              )}
              {block.secondaryCta && (
                <Button
                  asChild
                  className="h-14 border-white/20 bg-white/5 px-10 text-base font-semibold text-white hover:bg-white/10"
                  size="lg"
                  variant="outline"
                >
                  <a href={block.secondaryCta.link}>{block.secondaryCta.text}</a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function StaticCta() {
  return (
    <section className="relative overflow-hidden py-32 sm:py-40">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,oklch(0.6_0.13_175_/_0.15)_0%,transparent_60%)]" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-5xl font-bold tracking-tight text-white text-balance sm:text-6xl">
            Ready to sign smarter?
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-xl text-white/60 text-pretty">
            Join thousands of professionals who trust Seal for their document signatures. Free to
            start, no credit card required.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="group h-14 bg-teal-600 px-10 text-base font-semibold text-white hover:bg-teal-500"
              size="lg"
            >
              <a href={`${APP_URL}/sign-up`}>
                Start Free
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-5 transition-transform group-hover:translate-x-1"
                />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
