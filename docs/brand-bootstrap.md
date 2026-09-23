# Brand bootstrap playbook

How to take a Vortex product from zero to a complete brand system + landing
page in one pass. Proven on Seal (2026-09) after the Vortex brand package.
Read across repos — copy the _convention_, never import a shared package.
Each product owns its tokens, mark, and palette; the structure is what
replicates.

## The convention

```
packages/tokens/src/
├── mark.svg                 # the mark, currentColor, single viewBox
├── seal-mark.ts             # MARK_SVG string export (non-React consumers)
├── seal-mark.tsx            # <SealMark size title /> React component (./react)
├── seal-theme-web.css       # :root + .dark CSS vars, Tailwind-ramp brand scale
├── seal-fonts-web.css       # @font-face ONLY — self-hosted woff2, never a CDN
├── fonts/                   # latin-subset woff2 (variable where possible)
├── theme.ts                 # same values as the CSS, typed, for code consumers
└── assets/
    ├── favicon/             # 16/32 PNG, apple-touch-icon-180, 512 light+dark
    ├── app/                 # app-icon-192/512/1024
    ├── logo/                # horizontal lockups, light + dark
    └── social/              # og 1200x630, avatars light/dark, banners
```

package.json exports: `./seal-fonts-web.css`, `./seal-theme-web.css`,
`./theme`, `./seal-mark`, `./mark.svg`, `./react`, `./fonts/*`, `./assets/*`.
`"type": "module"`, `sideEffects: ["**/*.css"]`, react as optional peer.

## Order of operations

### 1. The mark — before anything else

Everything else is derivative; get this right first.

- Sketch 4–6 single-path SVG candidates in a test HTML file. Stroke-based
  (`fill="none" stroke="currentColor"`), rounded caps/joins, one viewBox.
- Render at **26px** — if it doesn't read at nav size, it isn't a mark.
- Must be a single color. No gradients, no shadows, no fills-as-structure.
- Must not share geometry DNA with another org mark (Seal's first draft was
  concentric rings = Vortex spiral — rejected).
- Prefer a literal-but-not-cliché object over abstract geometry
  (Seal = quill: the original signing instrument).

### 2. Palette — one accent, always

- Neutral ramp: Taupe 50→950 on `--brand-*` (the only Seal palette).
- Primary is taupe-900 (`#2C271F`) on taupe-50 (`#FBFAF9`). Red is functional
  only (destructive / expired). If everything is colored, nothing is.
- Status hues (success/warning/destructive) are **functional**, never brand.
- Light + dark `:root` blocks in the theme CSS; dark inverts the accent.
- Product chrome may use `bg/text/border-kumo-*` utilities — those are **aliases**
  onto Taupe semantic tokens in `seal-theme-web.css` (not a second palette).

### 3. Type — three faces, self-hosted

Display serif (the editorial voice) + UI sans + mono. Fetch woff2 from the
Google Fonts css2 API with a Chrome UA, take only `/* latin */` subset URLs:

```bash
curl -s -A "Mozilla/5.0 ... Chrome/120.0" \
  "https://fonts.googleapis.com/css2?family=...&display=swap" | grep -A8 "/\* latin \*/"
```

Variable fonts return one file for all weights — declare `font-weight: <min>
<max>` range. `font-display: swap` on everything. Never `@import` Google at
runtime — it's a third-party dependency that also breaks in emails/offline.

### 4. Tokens → consumers

`theme.ts` mirrors the CSS values as a typed export (email templates, canvas
colors, anything that can't read a CSS var). Keep the two files in sync —
they drift silently otherwise.

### 5. Render the asset set — no design tools needed

- **Favicons / app icons / avatars**: bake hex colors into temp SVG variants
  (`rsvg-convert` can't do `currentColor`), then
  `rsvg-convert -w N -h N in.svg -o out.png`.
- **OG image 1200×630 and lockups**: write a small HTML file at exact size,
  `@font-face` pointing at the vendored woff2 files (renders exactly as
  production), screenshot with system Chrome:

  ```bash
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --default-background-color=00000000 \
    --screenshot=out.png --window-size=1200,630 file:///path/to/og.html
  ```

- OG design = the site's own visual language at card size: mark + wordmark +
  one-line thesis + mono footer with the domain.

### 6. The landing page — spec-sheet, not SaaS

The pattern that beat generic SaaS twice now:

- Hairline rules + `+` registration ticks framing sections; numbered blocks
  `( 01 / 04 )`; mono micro-labels; zero shadows, zero rounded card grids.
- Hero = headline + **install tabs** (real package commands per SDK
  language) + one real code artifact — the product is the artifact.
- A manifesto/thesis section in display type, not marketing bullets.
- A literal table of real API routes (verify against the OpenAPI spec —
  never invent paths).
- Pricing framed as the thesis (for Seal: "signing is free").
- Exactly one inverted moment (dark band) if the palette is light.
- Fonts come from the tokens package — verify `font-family` actually
  resolves; `@theme inline` (Tailwind 4) vars don't emit `:root` props on
  non-Tailwind consumers and everything silently falls back to system serif.

### 7. The `/brand` page — the kit is part of the deliverable

Compact page on the site: mark on light/dark, size ladder, wordmark lockup,
ramp swatches, type stack, usage rules (single-color, clear space, watermark
at 4–6%). Inline SVG — Astro scoped styles don't reach `set:html` output.

### 8. Meta + wiring

- `og:*`, `twitter:*`, `canonical` in the base layout; `og.png` in public/.
- `favicon.svg` (light/dark via `prefers-color-scheme`) + PNG fallbacks +
  `apple-touch-icon`.
- Check `.gitignore` for `*.png` sweeps before committing assets — negation
  rules for `public/` and `assets/` dirs.
- Document the system in the app's `AGENTS.md` so the next agent doesn't
  reinvent it.

## Anti-patterns (learned the hard way)

- **Don't** share a brand runtime package across products — each product
  needs its own mark/accent; a shared package couples release cycles for
  zero benefit. Replicate the structure, own the values.
- **Don't** use more than one accent — and don't let status colors become
  brand colors.
- **Don't** invent metrics, logos, or social proof you don't have. A mono
  footnote naming real integrations beats a fake logo wall.
- **Don't** buy stock background packs — the mark at 4–6% opacity bleeding
  off the hero edge is the ownable $0 texture.
- **Don't** ship without looking: screenshot every section, light AND dark,
  before calling it done.

## Reference implementations

- Vortex: `~/Projects/vortex-payments/packages/brand` (monochrome, spiral,
  GitHub-Packages-published — the parent identity).
- Seal: `~/Projects/seal/packages/tokens` + `apps/site` (stone ramp, taupe
  accent, quill — the product-independence template).
