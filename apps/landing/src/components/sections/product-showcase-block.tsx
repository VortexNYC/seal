import { GripVertical, Layout, PenTool } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentType, type SVGProps, useState } from "react";

import { FadeIn } from "~/components/ui/fade-in";
import { cn } from "~/utils/cn";

interface TabData {
  id: string;
  label: string;
  headline: string;
  description: string;
  features: string[];
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  imageSrc: string;
  imageAlt: string;
}

const tabs: TabData[] = [
  {
    id: "editor",
    label: "Document Editor",
    headline: "Create and send in minutes",
    description:
      "Upload a PDF, let AI place the fields, then fine-tune with drag-and-drop. Templates save your setup for next time.",
    features: [
      "AI field detection",
      "Drag-and-drop placement",
      "Reusable templates",
    ],
    icon: GripVertical,
    imageSrc: "/images/showcase-editor.webp",
    imageAlt:
      "Seal document editor with AI-placed signature fields on a contract",
  },
  {
    id: "signing",
    label: "Signing Experience",
    headline: "Sign from any device",
    description:
      "A clean, focused signing page that works on any screen size. Recipients are guided field by field — no confusion.",
    features: [
      "Mobile-optimized",
      "Guided field navigation",
      "ESIGN compliant",
    ],
    icon: PenTool,
    imageSrc: "/images/showcase-signing.webp",
    imageAlt:
      "Mobile signing experience showing guided field-by-field signing flow",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    headline: "Track everything in one place",
    description:
      "Real-time status updates, full audit trails, and team management. Know exactly where every document stands.",
    features: ["Real-time tracking", "Full audit trails", "Team workspaces"],
    icon: Layout,
    imageSrc: "/images/showcase-dashboard.webp",
    imageAlt:
      "Seal dashboard showing document status tracking and team activity",
  },
];

function ShowcaseImage({ tab }: { tab: TabData }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="bg-muted flex aspect-video w-full items-center justify-center rounded-xl">
        <div className="text-center">
          <tab.icon
            aria-hidden="true"
            className="text-muted-foreground mx-auto mb-3 size-10"
          />
          <p className="text-muted-foreground text-sm">
            Screenshot coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      alt={tab.imageAlt}
      className="border-border aspect-video w-full rounded-xl border object-cover shadow-lg"
      height={540}
      loading="lazy"
      onError={() => setHasError(true)}
      src={tab.imageSrc}
      width={960}
    />
  );
}

export function StaticProductShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  // activeTab is always 0..2, constrained by the tab buttons below
  const currentTab = tabs[activeTab] ?? tabs[0];

  if (currentTab === undefined) {
    return null;
  }

  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <FadeIn>
          <div className="mb-16 text-center sm:mb-20">
            <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
              Product
            </p>
            <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
              See it in action
            </h2>
            <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg text-pretty">
              From upload to signed — every step is designed to be fast, clear,
              and delightful.
            </p>
          </div>
        </FadeIn>

        {/* Tab bar */}
        <FadeIn delay={0.1}>
          <div className="mb-12 flex justify-center sm:mb-16">
            <div className="bg-muted inline-flex gap-1 rounded-full p-1">
              {tabs.map((tab, index) => (
                <button
                  className={cn(
                    "rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                    activeTab === index
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  key={tab.id}
                  onClick={() => setActiveTab(index)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Tab content */}
        <FadeIn delay={0.2}>
          <AnimatePresence mode="wait">
            <motion.div
              animate={
                prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }
              }
              className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16"
              exit={
                prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }
              }
              initial={
                prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }
              }
              key={currentTab.id}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Copy */}
              <div>
                <h3 className="text-foreground mb-4 text-2xl font-semibold sm:text-3xl">
                  {currentTab.headline}
                </h3>
                <p className="text-muted-foreground mb-8 text-lg text-pretty">
                  {currentTab.description}
                </p>
                <ul className="space-y-3">
                  {currentTab.features.map((feature) => (
                    <li
                      className="text-foreground flex items-center gap-3 text-sm"
                      key={feature}
                    >
                      <span
                        aria-hidden="true"
                        className="bg-primary flex size-5 shrink-0 items-center justify-center rounded-full"
                      >
                        <svg
                          className="text-primary-foreground size-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                          />
                        </svg>
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Media */}
              <ShowcaseImage tab={currentTab} />
            </motion.div>
          </AnimatePresence>
        </FadeIn>
      </div>
    </section>
  );
}
