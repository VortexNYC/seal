# LANDING / DOCS GUIDE

## OVERVIEW

TanStack Start app for the marketing site, developer docs, API reference, and Sanity-backed content.

## STRUCTURE

```text
apps/landing/
├── src/routes/            # TanStack file-based routes
├── src/components/        # Layout, section, and UI components
├── src/lib/sanity/        # Sanity client, queries, structured data
├── content/docs/          # Fumadocs MDX source
├── tools/                 # API docs, search index, sitemap generators
├── sanity/                # CMS schema definitions
├── openapi.yaml           # API spec source
├── source.config.ts       # Fumadocs source config
└── .source/               # Generated Fumadocs collections
```

## WHERE TO LOOK

| Task              | Location                                   | Notes                                  |
| ----------------- | ------------------------------------------ | -------------------------------------- |
| Router setup      | `apps/landing/src/router.tsx`              | Registers generated route tree         |
| Root route        | `apps/landing/src/routes/__root.tsx`       | App shell + providers                  |
| Marketing pages   | `apps/landing/src/routes/index.tsx`        | Homepage entry                         |
| Dynamic CMS pages | `apps/landing/src/routes/pages.$slug.tsx`  | Renders Sanity page-builder content    |
| Docs layout       | `apps/landing/src/routes/docs.tsx`         | Fumadocs layout                        |
| Docs page         | `apps/landing/src/routes/docs/$.tsx`       | Renders MDX docs pages                 |
| API reference     | `apps/landing/src/routes/api-reference.tsx` | Scalar embed fed by OpenAPI spec      |
| Docs source       | `apps/landing/content/docs/`               | MDX + `meta.json` sidebar config       |
| Sanity queries    | `apps/landing/src/lib/sanity/queries.ts`   | Shared content fetching                |
| Sanity schemas    | `apps/landing/sanity/schemas/`             | CMS document/object definitions        |
| Generators        | `apps/landing/tools/`                      | Docs/search/sitemap generation scripts |

## CONVENTIONS

- Routes use TanStack file-based routing; `apps/landing/src/routeTree.gen.ts` is generated.
- MDX docs live in `content/docs/`; sidebar/group metadata is defined in adjacent `meta.json` files.
- API reference pages in `content/docs/api-reference/` are generated from `openapi.yaml` via `bun run docs:generate:api`.
- Fumadocs collection files in `apps/landing/.source/` are generated via `bun run docs:generate`.
- Sanity-backed content should go through `src/lib/sanity/*` and existing page-builder components.

## ANTI-PATTERNS

- Edit `apps/landing/src/routeTree.gen.ts` manually.
- Edit `apps/landing/.source/*` manually.
- Hand-edit generated API reference docs under `apps/landing/content/docs/api-reference/`.
- Duplicate Sanity fetch logic outside `apps/landing/src/lib/sanity/`.
