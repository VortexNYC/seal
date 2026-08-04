import type { TestimonialsSectionBlock } from "~/lib/content/types";

export function TestimonialsBlockComponent({
  block,
}: {
  block: TestimonialsSectionBlock;
}) {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {block.headline && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {block.headline}
            </h2>
          </div>
        )}

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {block.testimonials.map((testimonial) => (
            <div className="group relative" key={testimonial.id}>
              <div className="border-foreground/10 bg-foreground/5 hover:bg-foreground/10 relative h-full rounded-3xl border p-8 transition-colors duration-300">
                <blockquote className="mb-8">
                  <p className="text-foreground/80 text-lg leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </blockquote>
                <div className="flex items-center gap-4">
                  {testimonial.avatar ? (
                    <img
                      alt={testimonial.author}
                      className="size-12 rounded-full object-cover"
                      height={testimonial.avatar.height || 48}
                      loading="lazy"
                      src={testimonial.avatar.src}
                      width={testimonial.avatar.width || 48}
                    />
                  ) : (
                    // vortex-allow-color: testimonial avatar placeholder gradient is decorative brand-neutral art, not a status color
                    <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-400">
                      <span className="text-foreground text-lg font-semibold">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-foreground font-semibold">
                      {testimonial.author}
                    </div>
                    <div className="text-foreground/50 text-sm">
                      {testimonial.role}
                      {testimonial.company && `, ${testimonial.company}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
