import { FileText } from "lucide-react";

import type { TemplatePreviewBlock } from "~/lib/content/types";

export function TemplatePreviewBlockComponent({
  block,
}: {
  block: TemplatePreviewBlock;
}) {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="text-foreground mb-4 text-3xl font-bold text-balance sm:text-4xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-foreground/60 text-lg text-pretty">
                {block.description}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.templates.map((template) => (
            <div
              className="group border-foreground/10 bg-foreground/5 overflow-hidden rounded-xl border"
              key={template.name}
            >
              {template.image ? (
                <div className="border-foreground/10 aspect-[4/3] overflow-hidden border-b">
                  <img
                    alt={template.image.alt || template.name}
                    className="size-full object-cover"
                    loading="lazy"
                    src={template.image.src}
                  />
                </div>
              ) : (
                <div className="border-foreground/10 bg-foreground/5 flex aspect-[4/3] items-center justify-center border-b">
                  <FileText className="text-foreground/20 size-12" />
                </div>
              )}
              <div className="p-5">
                {template.category && (
                  <span className="text-info mb-2 inline-block text-xs font-medium tracking-wider uppercase">
                    {template.category}
                  </span>
                )}
                <h3 className="text-foreground mb-1 text-lg font-semibold">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-foreground/50 text-sm text-pretty">
                    {template.description}
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
