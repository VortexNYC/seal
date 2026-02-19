import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowRight, Calendar, Tag } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { urlFor } from "~/lib/sanity/image";
import { type ChangelogEntry, getChangelogList } from "~/lib/sanity/queries";

const getChangelogData = createServerFn({ method: "GET" }).handler(async () => {
  const entries = await getChangelogList();
  return { entries };
});

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog - Seal" },
      {
        name: "description",
        content:
          "See what's new in Seal. Latest features, improvements, and bug fixes for our document signature platform.",
      },
    ],
  }),
  loader: () => getChangelogData(),
  component: ChangelogPage,
});

function ChangelogPage() {
  const { entries } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl lg:text-6xl">
            Changelog
          </h1>
          <p className="text-lg text-white/50 text-pretty sm:text-xl">
            See what&apos;s new in Seal. We ship fast and listen to feedback.
          </p>
        </div>

        {/* Changelog entries */}
        <div className="mx-auto max-w-3xl">
          {entries.length === 0 ? (
            <div className="text-center text-white/50">
              <p>No changelog entries yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-12">
              {entries.map((entry: ChangelogEntry, index: number) => (
                <article className="group relative" key={entry._id}>
                  {/* Timeline line */}
                  {index < entries.length - 1 && (
                    <div className="absolute left-[7px] top-8 h-full w-px bg-white/10" />
                  )}

                  <div className="flex gap-6">
                    {/* Timeline dot */}
                    <div className="relative shrink-0">
                      <div className="size-4 rounded-full border-2 border-teal-500 bg-background" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      {/* Meta info */}
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <Badge className="border-teal-500/30 text-teal-400" variant="outline">
                          <Tag className="mr-1 size-3" />
                          {entry.version}
                        </Badge>
                        <span className="flex items-center gap-1 text-sm text-white/40">
                          <Calendar className="size-3" />
                          {new Date(entry.releaseDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Title */}
                      <h2 className="mb-2 text-2xl font-bold text-white">{entry.title}</h2>

                      {/* Summary */}
                      {entry.summary && (
                        <p className="mb-4 text-white/60 text-pretty">{entry.summary}</p>
                      )}

                      {/* Cover image */}
                      {entry.coverImage?.asset && (
                        <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
                          <img
                            alt={entry.coverImage.alt || entry.title}
                            className="h-auto w-full"
                            height={400}
                            loading="lazy"
                            src={urlFor(entry.coverImage).width(800).height(400).url()}
                            width={800}
                          />
                        </div>
                      )}

                      {/* Read more link */}
                      <Link
                        className="inline-flex items-center gap-1 text-teal-400 transition-colors hover:text-teal-300"
                        params={{ slug: entry.slug.current }}
                        to="/changelog/$slug"
                      >
                        Read more
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
