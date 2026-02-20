import { urlFor } from "~/lib/sanity/image";
import type { LogoCloudBlock } from "~/lib/sanity/queries";

export function LogoCloudBlockComponent({ block }: { block: LogoCloudBlock }) {
  if (!block.logos || block.logos.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-black/20 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {block.headline && (
          <p className="mb-8 text-center text-sm tracking-widest text-white/40 uppercase">
            {block.headline}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-12">
          {block.logos.map((logo) => (
            <div
              className="flex shrink-0 items-center justify-center"
              key={logo.asset?._id ?? logo.alt ?? "logo"}
            >
              {logo.asset && (
                <img
                  alt={logo.alt || "Partner logo"}
                  className="h-8 w-auto opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                  height={32}
                  loading="lazy"
                  src={urlFor(logo).height(64).url()}
                  width={120}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
