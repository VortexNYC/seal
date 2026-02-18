import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { urlFor } from "~/lib/sanity/image";
import type { HeroBlock } from "~/lib/sanity/queries";

const APP_URL = "https://app.seal.co";

export function HeroBlockComponent({ block }: { block: HeroBlock }) {
  return (
    <section className="relative flex min-h-[70dvh] flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.6_0.13_175_/_0.06),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-white text-balance sm:text-6xl lg:text-7xl">
          {block.headline}
        </h1>

        {block.subheadline && (
          <p className="mb-12 max-w-2xl text-xl text-white/60 text-pretty sm:text-2xl">
            {block.subheadline}
          </p>
        )}

        {(block.primaryCta || block.secondaryCta) && (
          <div className="flex flex-col gap-4 sm:flex-row">
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
                    className="ml-2 size-4 transition-transform group-hover:translate-x-1"
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
                <a href={block.secondaryCta.link}>
                  {block.secondaryCta.text}
                </a>
              </Button>
            )}
          </div>
        )}

        {block.image?.asset && (
          <div className="mt-16 w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10">
            <img
              alt={block.image.alt || block.headline}
              className="h-auto w-full"
              height={600}
              loading="eager"
              src={urlFor(block.image).width(1200).height(600).url()}
              width={1200}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Static hero for the homepage (used when Sanity has no "home" page)
 */
export function StaticHero() {
  return (
    <section className="grain-overlay relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.6_0.13_175_/_0.08),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div className="mb-8">
          <div className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-teal-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-teal-500" />
            </span>
            <span className="text-sm text-white/70">Now in Beta</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="mb-8 text-[clamp(3rem,12vw,9rem)] font-bold leading-[0.9] tracking-tighter text-balance">
          <span className="block text-white">Document</span>
          <span className="block bg-gradient-to-r from-teal-400 via-teal-300 to-teal-400 bg-clip-text text-transparent">
            Signatures
          </span>
          <span className="block text-white">Made Simple</span>
        </h1>

        {/* Tagline */}
        <p className="mb-12 max-w-2xl text-xl text-white/60 text-pretty sm:text-2xl">
          Sign, send, and manage documents securely.
          <br className="hidden sm:block" />
          ESIGN compliant. Legally binding. Free to start.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            asChild
            className="group h-14 bg-teal-600 px-10 text-base font-semibold text-white hover:bg-teal-500"
            size="lg"
          >
            <a href={`${APP_URL}/sign-up`}>
              Start Free
              <ArrowRight
                aria-hidden="true"
                className="ml-2 size-4 transition-transform group-hover:translate-x-1"
              />
            </a>
          </Button>
          <Button
            asChild
            className="h-14 border-white/20 bg-white/5 px-10 text-base font-semibold text-white hover:bg-white/10"
            size="lg"
            variant="outline"
          >
            <a href="/docs">
              View Docs
            </a>
          </Button>
        </div>

        {/* Mock document preview */}
        <div className="relative mt-20 w-full max-w-4xl">
          <div className="absolute -inset-4 -z-10 bg-[radial-gradient(ellipse_at_center,oklch(0.6_0.13_175_/_0.2),transparent_70%)] opacity-50 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
              <div aria-hidden="true" className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500/80" />
              </div>
              <span className="ml-4 text-sm text-white/40">Seal - Document Editor</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div className="space-y-3 md:col-span-2">
                <div className="h-6 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/5" />
                <div className="h-4 w-5/6 rounded bg-white/5" />
                <div className="mt-6 h-4 w-full rounded bg-white/5" />
                <div className="h-4 w-4/5 rounded bg-white/5" />
                <div className="mt-8 flex gap-3">
                  <div className="h-10 w-32 rounded-lg border border-teal-500/30 bg-teal-500/10" />
                  <div className="h-10 w-24 rounded-lg bg-white/5" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Recipients
                </div>
                {["Signer 1", "Signer 2", "CC: Legal"].map((name) => (
                  <div
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                    key={name}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">{name}</span>
                      <span className="rounded bg-teal-500/20 px-2 py-0.5 text-xs text-teal-400">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
