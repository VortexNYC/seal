import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Bug, Calendar, Rocket, Sparkles, Tag, TriangleAlert } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { urlFor } from "~/lib/sanity/image";
import {
  type ChangelogEntryFull,
  type ChangelogFeature,
  getChangelogEntry,
} from "~/lib/sanity/queries";

export const Route = createFileRoute("/changelog/$slug")({
  head: ({ loaderData }) => {
    const data = loaderData as { entry: ChangelogEntryFull } | undefined;
    return {
      meta: [
        {
          title: data?.entry
            ? `${data.entry.version}: ${data.entry.title} - Seal Changelog`
            : "Changelog - Seal",
        },
        {
          name: "description",
          content: data?.entry?.summary || "See what's new in this Seal release.",
        },
      ],
    };
  },
  // @ts-expect-error — TanStack Router generic inference limitation with $slug param routes
  loader: async ({ params }) => {
    const entry = await getChangelogEntry(params.slug);
    if (!entry) {
      throw notFound();
    }
    return { entry };
  },
  component: ChangelogDetailPage,
});

function ChangelogDetailPage() {
  const { entry } = Route.useLoaderData() as { entry: ChangelogEntryFull };

  return (
    <div className="bg-background min-h-dvh py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Back link */}
          <div className="mb-8">
            <Link
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
              to="/changelog"
            >
              <ArrowLeft className="size-4" />
              Back to Changelog
            </Link>
          </div>

          {/* Header */}
          <header className="mb-12">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge className="border-primary/30 text-primary" variant="outline">
                <Tag className="mr-1 size-3" />
                {entry.version}
              </Badge>
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <Calendar className="size-3" />
                {new Date(entry.releaseDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {entry.title}
            </h1>

            {entry.summary && <p className="text-muted-foreground text-xl text-pretty">{entry.summary}</p>}
          </header>

          {/* Cover image */}
          {entry.coverImage?.asset && (
            <div className="mb-12 overflow-hidden rounded-2xl border border-border">
              <img
                alt={entry.coverImage.alt || entry.title}
                className="h-auto w-full"
                height={600}
                src={urlFor(entry.coverImage).width(1200).height(600).url()}
                width={1200}
              />
            </div>
          )}

          {/* New Features */}
          {entry.features && entry.features.length > 0 && (
            <section className="mb-12">
              <h2 className="text-foreground mb-6 flex items-center gap-2 text-2xl font-bold">
                <Sparkles className="text-primary size-6" />
                New Features
              </h2>
              <div className="space-y-6">
                {entry.features.map((feature: ChangelogFeature) => (
                  <div
                    className="rounded-xl border border-border bg-muted/50 p-6"
                    key={`feature-${feature.title}`}
                  >
                    <h3 className="text-foreground mb-2 text-lg font-semibold">{feature.title}</h3>
                    {feature.description && (
                      <p className="text-muted-foreground text-pretty">{feature.description}</p>
                    )}
                    {feature.image?.asset && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-border">
                        <img
                          alt={feature.image.alt || feature.title}
                          className="h-auto w-full"
                          height={400}
                          loading="lazy"
                          src={urlFor(feature.image).width(800).height(400).url()}
                          width={800}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Improvements */}
          {entry.improvements && entry.improvements.length > 0 && (
            <section className="mb-12">
              <h2 className="text-foreground mb-6 flex items-center gap-2 text-2xl font-bold">
                <Rocket className="size-6 text-green-600 dark:text-green-400" />
                Improvements
              </h2>
              <ul className="space-y-3">
                {entry.improvements.map((item: string) => (
                  <li
                    className="text-muted-foreground flex items-start gap-3"
                    key={`improvement-${item.slice(0, 30)}`}
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Bug Fixes */}
          {entry.fixes && entry.fixes.length > 0 && (
            <section className="mb-12">
              <h2 className="text-foreground mb-6 flex items-center gap-2 text-2xl font-bold">
                <Bug className="size-6 text-orange-600 dark:text-orange-400" />
                Bug Fixes
              </h2>
              <ul className="space-y-3">
                {entry.fixes.map((item: string) => (
                  <li
                    className="text-muted-foreground flex items-start gap-3"
                    key={`fix-${item.slice(0, 30)}`}
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-orange-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Breaking Changes */}
          {entry.breakingChanges && entry.breakingChanges.length > 0 && (
            <section className="mb-12">
              <h2 className="text-foreground mb-6 flex items-center gap-2 text-2xl font-bold">
                <TriangleAlert className="size-6 text-red-600 dark:text-red-400" />
                Breaking Changes
              </h2>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
                <ul className="space-y-3">
                  {entry.breakingChanges.map((item: string) => (
                    <li
                      className="text-muted-foreground flex items-start gap-3"
                      key={`breaking-${item.slice(0, 30)}`}
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
