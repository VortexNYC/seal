import { Check, X } from "lucide-react";
import type { ComparisonTableBlock } from "~/lib/sanity/queries";

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
              <h2 className="mb-4 text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-lg text-white/50 text-pretty">{block.description}</p>
            )}
          </div>
        )}

        <div className="mx-auto max-w-5xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-4 pr-4 text-sm font-medium text-white/40">
                  Feature
                </th>
                <th className="pb-4 px-4 text-center text-sm font-bold text-teal-400">
                  Seal
                </th>
                {block.competitors.map((competitor) => (
                  <th
                    className="pb-4 px-4 text-center text-sm font-medium text-white/40"
                    key={competitor.name}
                  >
                    {competitor.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatureKeys.map((featureKey) => (
                <tr className="border-b border-white/5" key={featureKey}>
                  <td className="py-4 pr-4 text-sm text-white/70">{featureKey}</td>
                  <td className="py-4 px-4 text-center">
                    <CellValue value={block.sealFeatures[featureKey]} highlight />
                  </td>
                  {block.competitors.map((competitor) => (
                    <td className="py-4 px-4 text-center" key={competitor.name}>
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
        className={`mx-auto size-5 ${highlight ? "text-teal-400" : "text-white/60"}`}
      />
    ) : (
      <X aria-label="No" className="mx-auto size-5 text-white/20" />
    );
  }

  return (
    <span className={`text-sm ${highlight ? "font-medium text-teal-400" : "text-white/60"}`}>
      {value ?? "—"}
    </span>
  );
}
