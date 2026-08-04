import { Check, X } from "lucide-react";

import type { ComparisonTableBlock } from "~/lib/content/types";

export function ComparisonTableBlockComponent({
  block,
}: {
  block: ComparisonTableBlock;
}) {
  const allFeatureKeys = Object.keys(block.sealFeatures);

  return (
    <section className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-foreground/50 text-lg text-pretty">
                {block.description}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto max-w-5xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-foreground/10 border-b">
                <th className="text-foreground/40 pr-4 pb-4 text-sm font-medium">
                  Feature
                </th>
                <th className="text-info px-4 pb-4 text-center text-sm font-bold">
                  Seal
                </th>
                {block.competitors.map((competitor) => (
                  <th
                    className="text-foreground/40 px-4 pb-4 text-center text-sm font-medium"
                    key={competitor.name}
                  >
                    {competitor.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatureKeys.map((featureKey) => (
                <tr className="border-foreground/5 border-b" key={featureKey}>
                  <td className="text-foreground/70 py-4 pr-4 text-sm">
                    {featureKey}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <CellValue
                      value={block.sealFeatures[featureKey]}
                      highlight
                    />
                  </td>
                  {block.competitors.map((competitor) => (
                    <td className="px-4 py-4 text-center" key={competitor.name}>
                      <CellValue value={competitor.features[featureKey]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CellValue({
  value,
  highlight = false,
}: {
  value: boolean | string | undefined;
  highlight?: boolean;
}) {
  if (typeof value === "boolean") {
    return value ? (
      <Check
        aria-label="Yes"
        className={`mx-auto size-5 ${highlight ? "text-info" : "text-foreground/60"}`}
      />
    ) : (
      <X aria-label="No" className="text-foreground/20 mx-auto size-5" />
    );
  }

  return (
    <span
      className={`text-sm ${highlight ? "text-info font-medium" : "text-foreground/60"}`}
    >
      {value ?? "—"}
    </span>
  );
}
