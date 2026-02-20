import { Send, Shield, Users, Zap } from "lucide-react";

import type { FeaturesSectionBlock } from "~/lib/sanity/queries";

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
              <p className="mb-4 text-sm font-medium tracking-wider text-teal-400 uppercase">
                {block.eyebrow}
              </p>
            )}
            {block.headline && (
              <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-lg text-pretty text-white/50">{block.description}</p>
            )}
          </div>
        )}

        <div className={`mx-auto grid max-w-6xl gap-6 lg:gap-8 ${gridCols}`}>
          {block.features.map((feature) => (
            <div className="group relative" key={feature.title}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/5 p-8 transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10">
                {feature.icon && (
                  <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-teal-500/20">
                    <span className="text-2xl">{feature.icon}</span>
                  </div>
                )}
                <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                {feature.description && (
                  <p className="leading-relaxed text-white/60">{feature.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const staticFeatures = [
  {
    icon: Send,
    title: "Send for Signature",
    description:
      "Upload any PDF, add signature fields, and send to recipients in seconds. Track status in real-time.",
    bgClass: "bg-teal-500/20",
    textClass: "text-teal-400",
  },
  {
    icon: Shield,
    title: "ESIGN Compliant",
    description:
      "Legally binding signatures with full audit trails. SHA-256 document hashing and tamper-evident seals.",
    bgClass: "bg-blue-400/20",
    textClass: "text-blue-400",
  },
  {
    icon: Users,
    title: "Team Workspaces",
    description:
      "Collaborate with your team. Role-based permissions, shared templates, and organization-wide document management.",
    bgClass: "bg-emerald-400/20",
    textClass: "text-emerald-400",
  },
  {
    icon: Zap,
    title: "Templates & Automation",
    description:
      "Create reusable templates with pre-placed fields. Send documents faster with saved recipient lists.",
    bgClass: "bg-amber-400/20",
    textClass: "text-amber-400",
  },
];

export function StaticFeatures() {
  return (
    <section className="relative py-24 sm:py-32 lg:py-40" id="features">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
              sign with confidence.
            </span>
          </h2>
          <p className="text-lg text-pretty text-white/50 sm:text-xl">
            Built for modern teams that value security, simplicity, and speed.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:gap-8">
          {staticFeatures.map((feature) => (
            <div className="group relative" key={feature.title}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10">
                <div
                  className={`mb-6 flex size-14 items-center justify-center rounded-2xl ${feature.bgClass}`}
                >
                  <feature.icon aria-hidden="true" className={`size-7 ${feature.textClass}`} />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="leading-relaxed text-white/60">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
