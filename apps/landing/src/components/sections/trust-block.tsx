import { FileCheck, Lock, Shield, Zap } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { FadeIn } from "~/components/ui/fade-in";

interface TrustItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const trustItems: TrustItem[] = [
  {
    icon: Shield,
    title: "ESIGN & UETA compliant",
    description:
      "Legally binding electronic signatures with full consent workflows and disclosure records. Valid in all 50 US states.",
  },
  {
    icon: FileCheck,
    title: "Complete audit trails",
    description:
      "Every view, signature, and action logged with timestamps, IP addresses, and SHA-256 document hashes.",
  },
  {
    icon: Lock,
    title: "Encrypted end-to-end",
    description:
      "TLS in transit, encrypted at rest. Tamper-evident hashing ensures documents can't be modified after signing.",
  },
  {
    icon: Zap,
    title: "Built for speed",
    description:
      "Average signing time under 60 seconds. No app downloads. No account required for signers. Just a link.",
  },
];

export function StaticTrust() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <FadeIn>
          <div className="mb-20 max-w-2xl">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Trust & Security
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Built for documents that matter.
            </h2>
            <p className="text-muted-foreground mt-6 text-lg text-pretty">
              When you&apos;re handling legally binding contracts, security isn&apos;t optional.
              Every feature is built with compliance and data integrity in mind.
            </p>
          </div>
        </FadeIn>

        {/* Trust grid */}
        <FadeIn delay={0.15}>
          <div className="border-border bg-border grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2">
            {trustItems.map((item) => (
              <div className="bg-card p-8 sm:p-10" key={item.title}>
                <item.icon aria-hidden="true" className="text-primary mb-5 size-6" />
                <h3 className="text-foreground mb-3 text-lg font-semibold">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Stripe badge */}
        <FadeIn delay={0.25}>
          <div className="mt-12 flex items-center justify-center gap-3">
            <span className="text-muted-foreground text-sm">Payments powered by</span>
            <img
              alt="Stripe"
              className="h-6 opacity-40 invert dark:invert-0"
              height={24}
              src="/stripe-wordmark-white.svg"
              width={60}
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
