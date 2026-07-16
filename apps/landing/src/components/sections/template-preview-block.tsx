import { FileText } from "lucide-react";
import type { TemplatePreviewBlock } from "~/lib/content/types";

export function TemplatePreviewBlockComponent({ block }: { block: TemplatePreviewBlock }) {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(block.headline || block.description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {block.headline && (
              <h2 className="mb-4 text-3xl font-bold text-balance text-foreground sm:text-4xl">
                {block.headline}
              </h2>
            )}
            {block.description && (
              <p className="text-lg text-pretty text-foreground/60">{block.description}</p>
            )}
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.templates.map((template) => (
            <div
              className="group overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5"
              key={template.name}
            >
              {template.image ? (
                <div className="aspect-[4/3] overflow-hidden border-b border-foreground/10">
                  <img
                    alt={template.image.alt || template.name}
                    className="size-full object-cover"
                    loading="lazy"
                    src={template.image.src}
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center border-b border-foreground/10 bg-foreground/5">
                  <FileText className="size-12 text-foreground/20" />
                </div>
              )}
              <div className="p-5">
                {template.category && (
                  <span className="mb-2 inline-block text-xs font-medium tracking-wider text-info uppercase">
                    {template.category}
                  </span>
                )}
                <h3 className="mb-1 text-lg font-semibold text-foreground">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-pretty text-foreground/50">{template.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
