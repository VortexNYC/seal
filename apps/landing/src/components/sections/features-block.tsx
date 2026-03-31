import { ArrowRight, Check, Circle, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { FadeIn } from "~/components/ui/fade-in";
import type { FeaturesSectionBlock } from "~/lib/content/types";

/* ── AI Review Card Mockup ─────────────────────────────────────────────── */
function AiReviewMockup() {
  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/15 flex size-5 items-center justify-center rounded">
            <FileText aria-hidden="true" className="text-primary size-3" />
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
      <div className="space-y-2.5 p-4">
        <div className="bg-destructive/8 border-destructive/20 rounded-lg border p-3.5">
          <div className="flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-destructive mt-0.5 size-2 shrink-0 fill-current"
            />
            <div>
              <p className="text-foreground text-sm font-medium">
                Missing co-founder signature block — Page 6
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Term sheets with multiple founders require all signatures. This document only
                captures one. The agreement may be unenforceable.
              </p>
              <p className="text-primary mt-1.5 text-xs font-medium">Fix this →</p>
            </div>
          </div>
        </div>
        <div className="bg-warning/8 border-warning/20 rounded-lg border p-3.5">
          <div className="flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-warning mt-0.5 size-2 shrink-0 fill-current"
            />
            <div>
              <p className="text-foreground text-sm font-medium">
                Unusual liquidation preference — §4.3
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                3× non-participating preference. Market standard is 1×. Significantly
                investor-favorable. Consider negotiating.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-success/8 border-success/20 rounded-lg border p-3.5">
          <div className="flex items-start gap-2">
            <Circle
              aria-hidden="true"
              className="text-success mt-0.5 size-2 shrink-0 fill-current"
            />
            <div>
              <p className="text-foreground text-sm font-medium">Pro-rata rights — standard</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Participation rights look market-standard. No flags.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <span className="text-muted-foreground text-xs">2 issues · 1 passed · Page 6 of 8</span>
        <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium">
          Review & send <ArrowRight aria-hidden="true" className="size-3" />
        </span>
      </div>
    </div>
  );
}

/* ── Signing Experience Mockup ─────────────────────────────────────────── */
function SigningMockup() {
  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <span className="text-foreground text-sm font-medium">
          ACME Corp — Service Agreement.pdf
        </span>
        <span className="bg-success/15 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
          <Circle aria-hidden="true" className="size-1.5 fill-current" />
          Ready to sign
        </span>
      </div>
      <div className="p-6">
        <div className="bg-muted/50 mb-4 rounded-lg p-6">
          <div className="space-y-2">
            <div className="bg-muted h-2.5 w-4/5 rounded" />
            <div className="bg-muted h-2.5 w-full rounded" />
            <div className="bg-muted h-2.5 w-3/4 rounded" />
          </div>
          <div className="border-primary/30 bg-primary/5 mt-6 flex items-center justify-between rounded-lg border p-3">
            <span className="text-foreground/70 font-serif text-lg italic">✓ Sarah Chen</span>
            <span className="bg-success text-success-foreground rounded px-2 py-0.5 text-xs font-semibold uppercase">
              Signed
            </span>
          </div>
          <div className="border-border bg-card mt-2 flex items-center justify-between rounded-lg border p-3">
            <span className="text-foreground text-sm">Mar 3, 2026</span>
            <span className="text-muted-foreground text-xs uppercase">Auto</span>
          </div>
        </div>
      </div>
      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <span className="text-success flex items-center gap-1.5 text-xs font-medium">
          <Check aria-hidden="true" className="size-3" />
          All parties signed · 42 seconds
        </span>
        <span className="text-muted-foreground text-xs">Certificate generated</span>
      </div>
    </div>
  );
}

/* ── Audit Trail Mockup ────────────────────────────────────────────────── */
function AuditTrailMockup() {
  const events = [
    {
      status: "success",
      title: "Document completed",
      detail: "All 2 signers signed. Certificate generated.",
      time: "2:43 PM",
    },
    {
      status: "success",
      title: "Marcus Lee signed",
      detail: "192.168.1.42 · Safari 17 · iPhone 16",
      time: "2:43 PM",
    },
    {
      status: "success",
      title: "Sarah Chen signed",
      detail: "203.0.113.12 · Chrome 122 · MacBook Pro",
      time: "2:40 PM",
    },
    {
      status: "info",
      title: "Document sent for signing",
      detail: "Sent to sarah@acme.com, marcus@acme.com",
      time: "2:40 PM",
    },
    {
      status: "muted",
      title: "Document created",
      detail: "Uploaded by jordan@vantage.co",
      time: "2:38 PM",
    },
  ];

  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <span className="text-foreground text-sm font-medium">Activity Log</span>
        <span className="bg-success/15 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
          <Circle aria-hidden="true" className="size-1.5 fill-current" />
          Completed
        </span>
      </div>
      <div className="divide-border divide-y">
        {events.map((event) => (
          <div className="flex items-start justify-between px-5 py-3" key={event.title}>
            <div className="flex items-start gap-2.5">
              <Circle
                aria-hidden="true"
                className={`mt-1 size-2 shrink-0 fill-current ${
                  event.status === "success"
                    ? "text-success"
                    : event.status === "info"
                      ? "text-info"
                      : "text-muted-foreground"
                }`}
              />
              <div>
                <p className="text-foreground text-sm font-medium">{event.title}</p>
                <p className="text-muted-foreground text-xs">{event.detail}</p>
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">{event.time}</span>
          </div>
        ))}
      </div>
      <div className="border-border border-t px-5 py-3">
        <p className="text-muted-foreground text-xs">
          Certificate ID: SL-2026-83F2A · SHA-256: a3f8c…
        </p>
      </div>
    </div>
  );
}

/* ── Feature Sections ──────────────────────────────────────────────────── */
interface FeatureSection {
  number: string;
  eyebrow: string;
  headline: string;
  description: string;
  bullets?: string[];
  mockup: () => ReactElement;
  reversed?: boolean;
}

const featureSections: FeatureSection[] = [
  {
    number: "01",
    eyebrow: "AI REVIEW",
    headline: "AI that actually reads your contracts.",
    description:
      "Most e-signature tools are glorified PDFs. Seal's AI reviews every clause before a single signature is collected — catching issues your lawyer would bill $800/hr to find.",
    bullets: [
      "Missing signature blocks",
      "Non-standard liquidation terms",
      "Ambiguous jurisdiction clauses",
    ],
    mockup: AiReviewMockup,
  },
  {
    number: "02",
    eyebrow: "SIGNING",
    headline: "Sign in under 60 seconds.",
    description:
      "No app to download. No account required. Signers get a link, sign on any device, and you get a legally binding document with a full audit certificate.",
    reversed: true,
    mockup: SigningMockup,
  },
  {
    number: "03",
    eyebrow: "COMPLIANCE",
    headline: "An audit trail your lawyers will love.",
    description:
      "Every action is timestamped, every signer verified, every IP logged. ESIGN Act compliant by default. When it goes to court, you're covered.",
    bullets: [
      "ESIGN Act compliant",
      "Tamper-evident SHA-256 hash",
      "IP, device, and time on every event",
    ],
    mockup: AuditTrailMockup,
  },
];

export function StaticFeatures() {
  return (
    <section className="px-6 py-32 sm:py-40" id="features">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <FadeIn>
          <div className="mb-24 max-w-2xl">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              What Seal actually does
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              Three things the old tools can&apos;t do.
            </h2>
          </div>
        </FadeIn>

        {/* Feature sections */}
        <div className="space-y-32">
          {featureSections.map((section) => (
            <div
              className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                section.reversed ? "lg:[&>*:first-child]:order-2" : ""
              }`}
              key={section.number}
            >
              {/* Copy */}
              <FadeIn>
                <div>
                  <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.15em] uppercase">
                    {section.number} — {section.eyebrow}
                  </p>
                  <h3 className="text-foreground font-serif text-3xl tracking-tight sm:text-4xl">
                    {section.headline}
                  </h3>
                  <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
                    {section.description}
                  </p>
                  {section.bullets && (
                    <ul className="mt-6 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li className="flex items-center gap-3 text-sm" key={bullet}>
                          <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                          <span className="text-foreground">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </FadeIn>

              {/* Mockup */}
              <FadeIn delay={0.15}>
                <section.mockup />
              </FadeIn>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CMS-driven component (used by page-builder.tsx) ─────────────────── */
const GRID_LAYOUTS: Record<string, string> = {
  "grid-2": "sm:grid-cols-2",
  alternating: "sm:grid-cols-1 max-w-3xl",
};

export function FeaturesBlockComponent({ block }: { block: FeaturesSectionBlock }) {
  const gridCols = GRID_LAYOUTS[block.layout ?? ""] ?? "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.eyebrow && (
              <p className="text-primary mb-4 text-sm font-medium tracking-wider uppercase">
                {block.eyebrow}
              </p>
            )}
            {block.headline && (
              <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-muted-foreground text-lg text-pretty">{block.description}</p>
            )}
          </div>
        )}
        <div className={`mx-auto grid max-w-6xl gap-6 lg:gap-8 ${gridCols}`}>
          {block.features.map((feature) => (
            <div className="group relative" key={feature.title}>
              <div className="border-border hover:border-border/80 relative h-full rounded-2xl border p-8 transition-colors duration-200">
                {feature.icon && (
                  <div className="bg-primary/10 mb-6 flex size-12 items-center justify-center rounded-xl">
                    <span className="text-2xl">{feature.icon}</span>
                  </div>
                )}
                <h3 className="text-foreground mb-3 text-xl font-semibold">{feature.title}</h3>
                {feature.description && (
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
