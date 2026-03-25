import { Info, TriangleAlert } from "lucide-react";
import type { LegalDisclaimerBlock } from "~/lib/content/types";

export function LegalDisclaimerBlockComponent({ block }: { block: LegalDisclaimerBlock }) {
  const isWarning = block.style === "warning";

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`mx-auto max-w-3xl rounded-xl border p-6 ${
            isWarning ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-white/5"
          }`}
        >
          <div className="flex items-start gap-3">
            {isWarning ? (
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
            ) : (
              <Info className="mt-0.5 size-5 shrink-0 text-white/40" />
            )}
            <p className="text-sm leading-relaxed text-pretty text-white/60">{block.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
