import { ArrowRight, Check, Circle, CreditCard, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { FadeIn } from "~/components/ui/fade-in";
import type { FeaturesSectionBlock } from "~/lib/content/types";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/* ── AI Review Card Mockup — animated clause reveal loop ───────────────── */
const AI_CLAUSES = [
  {
    type: "error",
    title: "Missing co-founder signature block — Page 6",
    detail:
      "Term sheets with multiple founders require all signatures. The agreement may be unenforceable.",
    cta: "Fix this →",
  },
  {
    type: "warning",
    title: "Unusual liquidation preference — §4.3",
    detail:
      "3× non-participating preference. Market standard is 1×. Significantly investor-favorable.",
    cta: null,
  },
  {
    type: "success",
    title: "Pro-rata rights — standard",
    detail: "Participation rights look market-standard. No flags.",
    cta: null,
  },
];

function AiReviewMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function runLoop() {
      setVisibleCount(0);
      setScanning(true);

      // Scanning phase: 1.2s
      timeout = setTimeout(() => {
        setScanning(false);
        // Reveal clauses one by one
        let i = 0;
        function revealNext() {
          i++;
          setVisibleCount(i);
          if (i < AI_CLAUSES.length) {
            timeout = setTimeout(revealNext, 700);
          } else {
            // Hold for 2.5s then reset
            timeout = setTimeout(runLoop, 2500);
          }
        }
        timeout = setTimeout(revealNext, 300);
      }, 1200);
    }

    runLoop();
    return () => clearTimeout(timeout);
  }, []);

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
        {scanning ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <span className="bg-primary inline-block size-1.5 animate-pulse rounded-full" />
            Scanning…
          </span>
        ) : (
          <span className="bg-success/15 text-success animate-badge-pop inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <Circle aria-hidden="true" className="size-1.5 fill-current" />
            AI reviewed
          </span>
        )}
      </div>

      {/* Progress bar during scan */}
      {scanning && (
        <div className="h-0.5 w-full overflow-hidden bg-transparent">
          <div className="bg-primary animate-progress-bar h-full" />
        </div>
      )}

      <div className="min-h-[200px] space-y-2.5 p-4">
        {AI_CLAUSES.slice(0, visibleCount).map((clause, i) => (
          <div
            key={clause.title}
            className={`animate-slide-in-up rounded-lg border p-3.5 ${
              clause.type === "error"
                ? "bg-destructive/8 border-destructive/20"
                : clause.type === "warning"
                  ? "bg-warning/8 border-warning/20"
                  : "bg-success/8 border-success/20"
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-2">
              <Circle
                aria-hidden="true"
                className={`mt-0.5 size-2 shrink-0 fill-current ${
                  clause.type === "error"
                    ? "text-destructive"
                    : clause.type === "warning"
                      ? "text-warning"
                      : "text-success"
                }`}
              />
              <div>
                <p className="text-foreground text-sm font-medium">
                  {clause.title}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {clause.detail}
                </p>
                {clause.cta && (
                  <p className="text-primary mt-1.5 text-xs font-medium">
                    {clause.cta}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {scanning && (
          <div className="flex items-center gap-2 px-1 py-2">
            <span className="bg-muted h-2 w-2/3 animate-pulse rounded" />
          </div>
        )}
      </div>

      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <span className="text-muted-foreground text-xs">
          {scanning ? "Reading clauses…" : `2 issues · 1 passed · Page 6 of 8`}
        </span>
        <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium">
          Review & send <ArrowRight aria-hidden="true" className="size-3" />
        </span>
      </div>
    </div>
  );
}

/* ── Signing Experience Mockup — animated signature write + completion ─── */
const SIGNERS = [
  { name: "Sarah Chen", delay: 1200 },
  { name: "Marcus Lee", delay: 2800 },
];

function SigningMockup() {
  const [phase, setPhase] = useState<
    "waiting" | "signing1" | "signing2" | "complete"
  >("waiting");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    const delay0 = SIGNERS[0]?.delay ?? 1200;
    const delay1 = SIGNERS[1]?.delay ?? 2800;

    function runLoop() {
      setPhase("waiting");
      t = setTimeout(() => setPhase("signing1"), delay0);
      t = setTimeout(() => setPhase("signing2"), delay1);
      t = setTimeout(() => {
        setPhase("complete");
        t = setTimeout(runLoop, 2500);
      }, delay1 + 900);
    }

    runLoop();
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <span className="text-foreground text-sm font-medium">
          ACME Corp — Service Agreement.pdf
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
            phase === "complete"
              ? "bg-success/15 text-success"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Circle aria-hidden="true" className="size-1.5 fill-current" />
          {phase === "complete" ? "Completed" : "Awaiting signatures"}
        </span>
      </div>

      <div className="p-5">
        <div className="bg-muted/40 mb-4 rounded-lg p-5">
          <div className="mb-5 space-y-2">
            <div className="bg-muted h-2 w-4/5 rounded" />
            <div className="bg-muted h-2 w-full rounded" />
            <div className="bg-muted h-2 w-3/4 rounded" />
          </div>

          {/* Signer 1 */}
          <div
            className={`mb-2 rounded-lg border p-3 transition-all duration-500 ${
              phase === "signing1" ||
              phase === "signing2" ||
              phase === "complete"
                ? "border-success/30 bg-success/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-serif text-base italic transition-all duration-500 ${
                  phase === "signing1" ||
                  phase === "signing2" ||
                  phase === "complete"
                    ? "text-foreground animate-fade-in"
                    : "text-muted-foreground/30"
                }`}
              >
                {phase === "signing1" ||
                phase === "signing2" ||
                phase === "complete"
                  ? "✓ Sarah Chen"
                  : "Sarah Chen"}
              </span>
              {(phase === "signing1" ||
                phase === "signing2" ||
                phase === "complete") && (
                <span className="bg-success text-success-foreground animate-badge-pop rounded px-2 py-0.5 text-xs font-semibold uppercase">
                  Signed
                </span>
              )}
            </div>
          </div>

          {/* Signer 2 */}
          <div
            className={`rounded-lg border p-3 transition-all duration-500 ${
              phase === "signing2" || phase === "complete"
                ? "border-success/30 bg-success/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-serif text-base italic transition-all duration-500 ${
                  phase === "signing2" || phase === "complete"
                    ? "text-foreground animate-fade-in"
                    : "text-muted-foreground/30"
                }`}
              >
                {phase === "signing2" || phase === "complete"
                  ? "✓ Marcus Lee"
                  : "Marcus Lee"}
              </span>
              {(phase === "signing2" || phase === "complete") && (
                <span className="bg-success text-success-foreground animate-badge-pop rounded px-2 py-0.5 text-xs font-semibold uppercase">
                  Signed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        {phase === "complete" ? (
          <span className="text-success animate-fade-in flex items-center gap-1.5 text-xs font-medium">
            <Check aria-hidden="true" className="size-3" />
            All parties signed · 42 seconds
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="bg-muted-foreground/30 inline-block size-1.5 animate-pulse rounded-full" />
            Waiting for signatures…
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          {phase === "complete" ? "Certificate generated" : "2 signers"}
        </span>
      </div>
    </div>
  );
}

/* ── Developer API Mockup — animated API call + webhook response loop ─── */
const API_STEPS = [
  {
    type: "request" as const,
    label: "POST /v1/documents",
    lines: [
      '  "title": "Service Agreement",',
      '  "signers": [',
      '    { "email": "sarah@acme.com",',
      '      "role": "client" }',
      "  ],",
      '  "collect_payment": true',
    ],
  },
  {
    type: "response" as const,
    label: "201 Created",
    lines: [
      '  "id": "doc_3fK9mPqR",',
      '  "status": "pending",',
      '  "signing_url": "https://seal.co/s/..."',
    ],
  },
  {
    type: "webhook" as const,
    label: "→ webhook: document.completed",
    lines: [
      '  "event": "document.completed",',
      '  "document_id": "doc_3fK9mPqR",',
      '  "payment_collected": true',
    ],
  },
];

function DevApiMockup() {
  const [step, setStep] = useState(0);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function runStep(s: number) {
      setStep(s);
      setLineCount(0);
      const lines = API_STEPS[s]?.lines ?? [];
      let i = 0;
      function revealLine() {
        i++;
        setLineCount(i);
        if (i < lines.length) {
          timeout = setTimeout(revealLine, 180);
        } else if (s < API_STEPS.length - 1) {
          timeout = setTimeout(() => runStep(s + 1), 900);
        } else {
          timeout = setTimeout(() => runStep(0), 2800);
        }
      }
      timeout = setTimeout(revealLine, 300);
    }

    runStep(0);
    return () => clearTimeout(timeout);
  }, []);

  const current = API_STEPS[step] ?? sealAssertPresent(API_STEPS[0]);

  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border font-mono text-xs shadow-lg">
      {/* Terminal tab bar */}
      <div className="border-border bg-muted/30 flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="bg-destructive/70 size-2.5 rounded-full" />
        <span className="bg-warning/70 size-2.5 rounded-full" />
        <span className="bg-success/70 size-2.5 rounded-full" />
        <span className="text-muted-foreground ml-3 text-xs">
          seal api — zsh
        </span>
      </div>

      <div className="min-h-[220px] space-y-1 p-5">
        {/* All completed steps shown dimmed */}
        {API_STEPS.slice(0, step).map((s) => (
          <div key={s.label} className="opacity-30">
            <p
              className={`mb-1 ${s.type === "request" ? "text-primary" : s.type === "response" ? "text-success" : "text-warning"}`}
            >
              {s.type === "request"
                ? "$ curl"
                : s.type === "response"
                  ? "←"
                  : "⚡"}{" "}
              <span className="text-foreground/70">{s.label}</span>
            </p>
            <div className="space-y-0.5 pl-4">
              {s.lines.map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Current active step */}
        <div>
          <p
            className={`mb-1 ${current.type === "request" ? "text-primary" : current.type === "response" ? "text-success" : "text-warning"}`}
          >
            {current.type === "request"
              ? "$ curl"
              : current.type === "response"
                ? "←"
                : "⚡"}{" "}
            <span className="text-foreground">{current.label}</span>
          </p>
          <div className="space-y-0.5 pl-4">
            {current.lines.slice(0, lineCount).map((line, i) => (
              <p
                key={line}
                className="text-muted-foreground animate-fade-in"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                {line}
              </p>
            ))}
            {lineCount < current.lines.length && (
              <span className="bg-foreground inline-block size-2 animate-pulse rounded-sm" />
            )}
          </div>
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <div className="flex items-center gap-3">
          {API_STEPS.map((s, i) => (
            <span
              key={s.label}
              className={`size-1.5 rounded-full transition-colors duration-300 ${
                i < step
                  ? "bg-success"
                  : i === step
                    ? "bg-primary animate-pulse"
                    : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <span className="text-muted-foreground text-xs">
          REST API · Full OpenAPI spec
        </span>
      </div>
    </div>
  );
}

/* ── Payments Mockup — installments tick from upcoming → paid ──────────── */
const PAYMENT_ROWS = [
  { label: "Deposit (on signing)", amount: "$1,600.00" },
  { label: "Milestone 2 — Apr 1", amount: "$1,600.00" },
  { label: "Final — May 1", amount: "$1,600.00" },
];

function PaymentsMockup() {
  const [paidCount, setPaidCount] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function runLoop() {
      setPaidCount(0);
      let i = 0;
      function payNext() {
        i++;
        setPaidCount(i);
        if (i < PAYMENT_ROWS.length) {
          timeout = setTimeout(payNext, 1000);
        } else {
          timeout = setTimeout(runLoop, 3000);
        }
      }
      timeout = setTimeout(payNext, 800);
    }

    runLoop();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/15 flex size-5 items-center justify-center rounded">
            <CreditCard aria-hidden="true" className="text-primary size-3" />
          </div>
          <span className="text-foreground text-sm font-medium">
            Payment — Service Agreement
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-500 ${
            paidCount >= PAYMENT_ROWS.length
              ? "bg-success/15 text-success"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Circle aria-hidden="true" className="size-1.5 fill-current" />
          {paidCount >= PAYMENT_ROWS.length ? "All collected" : "Collecting…"}
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-foreground text-sm font-medium">ACME Corp</p>
            <p className="text-muted-foreground text-xs">
              Signed · Mar 3, 2026
            </p>
          </div>
          <span className="text-foreground text-sm font-semibold">
            $4,800.00
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-muted mb-4 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-success h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${(paidCount / PAYMENT_ROWS.length) * 100}%` }}
          />
        </div>

        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
          Payment schedule
        </p>
        <div className="space-y-3">
          {PAYMENT_ROWS.map((row, i) => {
            const isPaid = i < paidCount;
            const isActive = i === paidCount;
            return (
              <div
                key={row.label}
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-500 ${
                  isPaid
                    ? "bg-success/8"
                    : isActive
                      ? "bg-muted/30 ring-primary/20 ring-1"
                      : "bg-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Circle
                    aria-hidden="true"
                    className={`size-2 shrink-0 fill-current transition-colors duration-500 ${
                      isPaid
                        ? "text-success"
                        : isActive
                          ? "text-primary animate-pulse"
                          : "text-muted-foreground/30"
                    }`}
                  />
                  <span
                    className={`text-sm transition-colors duration-300 ${isPaid ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {row.label}
                  </span>
                </div>
                <span
                  className={`text-sm font-medium transition-colors duration-500 ${
                    isPaid ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {isPaid ? `✓ ${row.amount}` : row.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-t px-5 py-3">
        <span className="text-muted-foreground text-xs">
          Auto-invoiced on completion
        </span>
        <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium">
          View invoice <ArrowRight aria-hidden="true" className="size-3" />
        </span>
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
    number: "",
    eyebrow: "AI REVIEW",
    headline: "Like having a legal assistant review every clause.",
    description:
      "Seal reads your agreements before anyone signs — catching non-standard terms, missing signature blocks, and risky language. Think of it as your in-house counsel, without the hourly rate.",
    bullets: [
      "Redline suggestions on non-standard clauses",
      "Missing signature block detection",
      "Jurisdiction and enforceability flags",
    ],
    mockup: AiReviewMockup,
  },
  {
    number: "",
    eyebrow: "SIGNING",
    headline: "Upload your documents.",
    description:
      "Upload a document and AI automatically detects and places every field. Recipients get a link — no app, no account required.",
    bullets: [
      "ESIGN & UETA compliant",
      "Tamper-evident SHA-256 audit certificate",
      "Full activity log — IP, device, and timestamp on every event",
    ],
    reversed: true,
    mockup: SigningMockup,
  },
  {
    number: "",
    eyebrow: "PAYMENTS",
    headline: "Collect payment the moment they sign.",
    description:
      "Attach a payment to any document — one-time, recurring, or installment. The moment the document is signed, payment is collected. No chasing invoices.",
    bullets: [
      "One-time, subscription, and installment billing",
      "Auto-generated invoices on completion",
      "No separate billing tool required",
    ],
    mockup: PaymentsMockup,
  },
  {
    number: "",
    eyebrow: "DEVELOPER API",
    headline: "Built for developers from day one.",
    description:
      "A full REST API, webhooks for every event, and an OpenAPI spec you can import into your tooling. Integrate Seal into any product in an afternoon — no enterprise contract required.",
    bullets: [
      "Full REST API on every plan",
      "Webhooks for every document event",
      "OpenAPI spec for code generation",
    ],
    reversed: true,
    mockup: DevApiMockup,
  },
];

export function StaticFeatures() {
  return (
    <section className="px-6 pt-32 pb-32 sm:pt-40 sm:pb-40" id="features">
      <div className="mx-auto max-w-6xl">
        <div className="space-y-32">
          {featureSections.map((section) => (
            <div
              className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                section.reversed ? "lg:[&>*:first-child]:order-2" : ""
              }`}
              key={section.eyebrow}
            >
              {/* Copy */}
              <FadeIn>
                <div>
                  <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.15em] uppercase">
                    {section.eyebrow}
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
                        <li
                          className="flex items-center gap-3 text-sm"
                          key={bullet}
                        >
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

export function FeaturesBlockComponent({
  block,
}: {
  block: FeaturesSectionBlock;
}) {
  const gridCols =
    GRID_LAYOUTS[block.layout ?? ""] ?? "sm:grid-cols-2 lg:grid-cols-3";

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
              <p className="text-muted-foreground text-lg text-pretty">
                {block.description}
              </p>
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
                <h3 className="text-foreground mb-3 text-xl font-semibold">
                  {feature.title}
                </h3>
                {feature.description && (
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
