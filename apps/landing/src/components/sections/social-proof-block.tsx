import { FadeIn } from "~/components/ui/fade-in";

const logos = ["Vantage", "Meridian", "Oaktree", "Folio", "Stratum", "Clearline"];

const stats = [
  { value: "24k+", label: "DOCUMENTS SIGNED" },
  { value: "4.9", label: "STARS ON G2" },
  { value: "87%", label: "FASTER CLOSE RATE" },
];

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  featured?: boolean;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Seal caught a 3× liquidation preference in a term sheet we were about to sign. That one flag probably saved us $4M in a future exit. It paid for itself in 30 seconds.",
    name: "Jamie Liu",
    role: "Co-founder, Vantage Capital",
    initials: "JL",
    featured: true,
  },
  {
    quote:
      "We switched from DocuSign after 3 years. Seal's AI found an issue on our first contract. We haven't looked back.",
    name: "Marcus Reid",
    role: "Legal Ops, Meridian Group",
    initials: "MR",
  },
  {
    quote:
      "The audit trail alone is worth it. When our investor asked for documentation, I sent a Seal certificate. Done in 10 seconds.",
    name: "Priya Kowalski",
    role: "CFO, Stratum Labs",
    initials: "PK",
  },
];

export function StaticSocialProof() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-6xl">
        {/* Logo cloud */}
        <FadeIn>
          <div className="mb-16 text-center">
            <p className="text-muted-foreground mb-8 text-xs font-medium tracking-[0.15em] uppercase">
              Trusted by teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {logos.map((logo) => (
                <span
                  className="text-muted-foreground/40 text-lg font-medium tracking-wide"
                  key={logo}
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={0.1}>
          <div className="border-border mb-20 grid grid-cols-3 divide-x border-y">
            {stats.map((stat) => (
              <div className="py-10 text-center" key={stat.label}>
                <p className="text-foreground font-serif text-4xl tracking-tight sm:text-5xl">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-2 text-[11px] font-medium tracking-[0.12em] uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Testimonials — asymmetric grid */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Featured large testimonial */}
          {testimonials
            .filter((t) => t.featured)
            .map((t) => (
              <FadeIn key={t.name}>
                <div className="border-border bg-card flex h-full flex-col justify-between rounded-2xl border p-8 sm:p-10">
                  <div>
                    <span
                      aria-hidden="true"
                      className="text-primary/20 mb-4 block font-serif text-6xl leading-none"
                    >
                      &ldquo;
                    </span>
                    <blockquote className="text-foreground font-serif text-xl leading-relaxed italic sm:text-2xl">
                      {t.quote}
                    </blockquote>
                  </div>
                  <div className="mt-8 flex items-center gap-3">
                    <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-full text-sm font-semibold">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}

          {/* Stacked smaller testimonials */}
          <div className="flex flex-col gap-6">
            {testimonials
              .filter((t) => !t.featured)
              .map((t, i) => (
                <FadeIn delay={0.1 + i * 0.05} key={t.name}>
                  <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
                    <blockquote className="text-foreground font-serif text-base leading-relaxed italic">
                      {t.quote}
                    </blockquote>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="bg-primary/15 text-primary flex size-9 items-center justify-center rounded-full text-xs font-semibold">
                        {t.initials}
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-medium">{t.name}</p>
                        <p className="text-muted-foreground text-xs">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
