import type { LogoCloudBlock } from "~/lib/content/types";

export function LogoCloudBlockComponent({ block }: { block: LogoCloudBlock }) {
  if (!block.logos || block.logos.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden border-y border-foreground/5 bg-background/20 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {block.headline && (
          <p className="mb-8 text-center text-sm tracking-widest text-foreground/40 uppercase">
            {block.headline}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-12">
          {block.logos.map((logo) => (
            <div className="flex shrink-0 items-center justify-center" key={logo.src}>
              {logo.src && (
                <img
                  alt={logo.alt || "Partner logo"}
                  className="h-8 w-auto opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                  height={logo.height || 32}
                  loading="lazy"
                  src={logo.src}
                  width={logo.width || 120}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
