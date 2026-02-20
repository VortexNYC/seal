import { FileText } from "lucide-react";

import { urlFor } from "~/lib/sanity/image";
import type { TemplatePreviewBlock } from "~/lib/sanity/queries";

export function TemplatePreviewBlockComponent({ block }: { block: TemplatePreviewBlock }) {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="mb-4 text-3xl font-bold text-balance text-white sm:text-4xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-lg text-pretty text-white/60">{block.description}</p>
            )}
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.templates.map((template) => (
            <div
              className="group overflow-hidden rounded-xl border border-white/10 bg-white/5"
              key={template.name}
            >
              {template.image?.asset ? (
                <div className="aspect-[4/3] overflow-hidden border-b border-white/10">
                  <img
                    alt={template.image.alt || template.name}
                    className="size-full object-cover"
                    loading="lazy"
                    src={urlFor(template.image).width(400).height(300).url()}
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center border-b border-white/10 bg-white/5">
                  <FileText className="size-12 text-white/20" />
                </div>
              )}
              <div className="p-5">
                {template.category && (
                  <span className="mb-2 inline-block text-xs font-medium tracking-wider text-teal-400 uppercase">
                    {template.category}
                  </span>
                )}
                <h3 className="mb-1 text-lg font-semibold text-white">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-pretty text-white/50">{template.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
