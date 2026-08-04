import { Info, TriangleAlert } from "lucide-react";

import type { LegalDisclaimerBlock } from "~/lib/content/types";

export function LegalDisclaimerBlockComponent({
  block,
}: {
  block: LegalDisclaimerBlock;
}) {
  const isWarning = block.style === "warning";

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`mx-auto max-w-3xl rounded-xl border p-6 ${
            isWarning
              ? "border-warning/30 bg-warning/5"
              : "border-foreground/10 bg-foreground/5"
          }`}
        >
          <div className="flex items-start gap-3">
            {isWarning ? (
              <TriangleAlert className="text-warning mt-0.5 size-5 shrink-0" />
            ) : (
              <Info className="text-foreground/40 mt-0.5 size-5 shrink-0" />
            )}
            <p className="text-foreground/60 text-sm leading-relaxed text-pretty">
              {block.text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
