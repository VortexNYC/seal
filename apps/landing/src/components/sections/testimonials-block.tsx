import { urlFor } from "~/lib/sanity/image";
import type { TestimonialsSectionBlock } from "~/lib/sanity/queries";

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
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl">
              {block.headline}
            </h2>
          </div>
        )}

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {block.testimonials.map((testimonial) => (
            <div className="group relative" key={testimonial._id}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/5 p-8 transition-colors duration-300 hover:bg-white/10">
                <blockquote className="mb-8">
                  <p className="text-lg leading-relaxed text-white/80">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </blockquote>
                <div className="flex items-center gap-4">
                  {testimonial.avatar?.asset ? (
                    <img
                      alt={testimonial.author}
                      className="size-12 rounded-full object-cover"
                      height={48}
                      loading="lazy"
                      src={urlFor(testimonial.avatar).width(80).height(80).url()}
                      width={48}
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-400">
                      <span className="text-lg font-semibold text-white">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-white/50">
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
