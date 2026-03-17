# LANDING / DOCS GUIDE

## OVERVIEW

TanStack Start app for the marketing site, developer docs, API reference, and repo-managed landing content.

## STRUCTURE

```text
apps/landing/
├── src/routes/            # TanStack file-based routes
├── src/components/        # Layout, section, and UI components
├── src/lib/content/       # Repo-managed page content + shared content types
├── src/lib/changelog/     # Changelog manifest + MDX loader helpers
├── e2e/                   # Playwright smoke tests + page objects
├── content/docs/          # Fumadocs MDX source
├── content/changelog/     # MDX changelog entries
├── tools/                 # API docs, search index, sitemap generators
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
| Dynamic landing pages | `apps/landing/src/routes/pages.$slug.tsx`  | Renders local page-builder content    |
| Docs layout       | `apps/landing/src/routes/docs.tsx`         | Fumadocs layout                        |
| Docs page         | `apps/landing/src/routes/docs/$.tsx`       | Renders MDX docs pages                 |
| API reference     | `apps/landing/src/routes/api-reference.tsx` | Scalar embed fed by OpenAPI spec      |
| E2E tests         | `apps/landing/e2e/tests/`                  | Landing smoke coverage via Playwright |
| Docs source       | `apps/landing/content/docs/`               | MDX + `meta.json` sidebar config       |
| Changelog source  | `apps/landing/content/changelog/`          | MDX entries + frontmatter              |
| Local page data   | `apps/landing/src/lib/content/pages.ts`    | Repo-managed `/pages/$slug` content    |
| Generators        | `apps/landing/tools/`                      | Docs/search/sitemap generation scripts |

## CONVENTIONS

- Routes use TanStack file-based routing; `apps/landing/src/routeTree.gen.ts` is generated.
- MDX docs live in `content/docs/`; sidebar/group metadata is defined in adjacent `meta.json` files.
- Changelog entries live in `content/changelog/` and are compiled into generated manifests under `.source/`.
- API reference pages in `content/docs/api-reference/` are generated from `openapi.yaml` via `bun run docs:generate:api`.
- Fumadocs collection files in `apps/landing/.source/` are generated via `bun run content:generate`.
- Repo-managed landing pages should go through `src/lib/content/*` and the existing page-builder components.
- Landing browser coverage lives in `e2e/`; prefer accessible selectors first and `data-testid` only when needed for stable Playwright assertions.

## ANTI-PATTERNS

- Edit `apps/landing/src/routeTree.gen.ts` manually.
- Edit `apps/landing/.source/*` manually.
- Hand-edit generated API reference docs under `apps/landing/content/docs/api-reference/`.
- Bypass the local content registries with ad-hoc inline route data.
- Use CSS selectors in Playwright tests when a role, label, or test id can express the intent more clearly.
