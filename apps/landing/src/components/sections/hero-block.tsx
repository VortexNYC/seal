import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";
import { urlFor } from "~/lib/sanity/image";
import type { HeroBlock } from "~/lib/sanity/queries";

const APP_URL = "https://app.seal.co";

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

        {block.image?.asset && (
          <FadeIn delay={0.3}>
            <div className="border-border mt-16 w-full max-w-4xl overflow-hidden rounded-2xl border shadow-lg">
              <img
                alt={block.image.alt || block.headline}
                className="h-auto w-full"
                height={600}
                loading="eager"
                src={urlFor(block.image).width(1200).height(600).url()}
                width={1200}
              />
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}

type MediaState = "video" | "image" | "skeleton";

function useMediaSlot(): MediaState {
  const [state, setState] = useState<MediaState>("skeleton");

  useEffect(() => {
    const video = new Image();
    video.src = "/videos/hero-demo.mp4";

    // Check video first by trying to load it as a fetch HEAD request
    fetch("/videos/hero-demo.mp4", { method: "HEAD" })
      .then((res) => {
        if (res.ok) {
          setState("video");
          return;
        }
        // Try image fallback
        return fetch("/images/hero-screenshot.webp", { method: "HEAD" });
      })
      .then((res) => {
        if (res && res.ok) setState("image");
      })
      .catch(() => {
        // Stay on skeleton
      });
  }, []);

  return state;
}

function HeroMedia() {
  const mediaState = useMediaSlot();

  if (mediaState === "video") {
    return (
      <video
        autoPlay
        className="h-auto w-full"
        loop
        muted
        playsInline
        poster="/images/hero-screenshot.webp"
      >
        <source src="/videos/hero-demo.mp4" type="video/mp4" />
      </video>
    );
  }

  if (mediaState === "image") {
    return (
      <img
        alt="Seal document editor showing a contract with signature fields and recipient list"
        className="h-auto w-full"
        height={600}
        loading="eager"
        src="/images/hero-screenshot.webp"
        width={1200}
      />
    );
  }

  // Skeleton fallback
  return (
    <div className="grid gap-6 p-6 md:grid-cols-3">
      <div className="space-y-3 md:col-span-2">
        <div className="bg-muted h-5 w-2/3 rounded" />
        <div className="bg-muted/60 h-3.5 w-full rounded" />
        <div className="bg-muted/60 h-3.5 w-5/6 rounded" />
        <div className="bg-muted/40 mt-6 h-3.5 w-full rounded" />
        <div className="bg-muted/40 h-3.5 w-4/5 rounded" />
        <div className="mt-8 flex gap-3">
          <div className="bg-primary/15 border-primary/30 h-10 w-28 rounded-lg border" />
          <div className="bg-muted h-10 w-20 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Recipients
        </div>
        {["Signer 1", "Signer 2", "CC: Legal"].map((name) => (
          <div className="border-border bg-muted/50 rounded-lg border p-3" key={name}>
            <div className="flex items-center justify-between">
              <span className="text-foreground/70 text-sm">{name}</span>
              <span className="bg-primary/15 text-primary rounded px-2 py-0.5 text-xs font-medium">
                Pending
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StaticHero() {
  return (
    <section className="relative flex min-h-[90dvh] flex-col items-center justify-center overflow-hidden px-6 pt-16">
      {/* Floating decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="animate-float-slow absolute top-[18%] left-[8%] size-3 rounded-full opacity-20"
          style={{ backgroundColor: "var(--primary)", animationDelay: "0s" }}
        />
        <div
          className="animate-float absolute top-[25%] right-[12%] size-2 rounded-full opacity-15"
          style={{ backgroundColor: "var(--primary)", animationDelay: "1s" }}
        />
        <div
          className="animate-float-slow absolute bottom-[35%] left-[15%] size-2.5 rounded-full opacity-10"
          style={{ backgroundColor: "var(--primary)", animationDelay: "2s" }}
        />
        <div
          className="animate-float absolute top-[40%] right-[8%] size-1.5 rounded-full opacity-20"
          style={{ backgroundColor: "var(--primary)", animationDelay: "0.5s" }}
        />
        <div
          className="animate-float-slow absolute right-[20%] bottom-[25%] size-3.5 rounded-full opacity-10"
          style={{ backgroundColor: "var(--primary)", animationDelay: "3s" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Headline */}
        <FadeIn>
          <h1 className="text-foreground font-serif text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.05] font-normal tracking-tight text-balance">
            Sign documents. <span className="text-primary">Collect payments.</span>{" "}
            <span className="text-muted-foreground italic">Let AI handle the rest.</span>
          </h1>
        </FadeIn>

        {/* Subtitle */}
        <FadeIn delay={0.15}>
          <p className="text-muted-foreground mt-8 max-w-xl text-lg text-pretty sm:text-xl">
            The intelligent document platform with built-in payments and recurring billing, AI field
            detection, and a full REST API.
          </p>
        </FadeIn>

        {/* Single CTA */}
        <FadeIn delay={0.3}>
          <div className="mt-10">
            <Button asChild className="group h-12 px-8 text-base font-medium" size="lg">
              <a href={`${APP_URL}/sign-up`}>
                Start Free
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </Button>
          </div>
        </FadeIn>

        {/* Product mockup with media slot */}
        <FadeIn delay={0.4}>
          <div className="relative mt-20 w-full max-w-3xl">
            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xl">
              {/* Browser chrome */}
              <div className="border-border flex items-center gap-2 border-b px-4 py-3">
                <div aria-hidden="true" className="flex gap-1.5">
                  <div className="bg-border size-3 rounded-full" />
                  <div className="bg-border size-3 rounded-full" />
                  <div className="bg-border size-3 rounded-full" />
                </div>
                <div className="bg-muted ml-4 h-6 flex-1 rounded-md" />
              </div>
              {/* Media slot: video → image → skeleton fallback */}
              <HeroMedia />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
