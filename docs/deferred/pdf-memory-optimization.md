# PDF Memory Optimization — Deferred

**Status**: Deferred
**Date**: 2026-02-19
**Original task**: Optimize large PDF memory management on the signing page

## Problem

The signing page (`sign.$token.tsx`) renders all PDF pages simultaneously using `Array.from({ length: numPages })`. For very large PDFs (50+ pages), this consumes significant memory as every page's canvas, text layer, and field overlays are mounted at once.

## Options Evaluated

### Option A: IntersectionObserver Lazy Rendering

Render only pages near the viewport; unmounted pages get placeholder divs.

**Rejected due to high complexity:**

1. **Field refs break** — The signing page uses `fieldRefs` (a `Map<string, HTMLButtonElement>`) for scroll-to-field navigation, next/previous field buttons, and auto-scroll on load. When a page unmounts, its field refs are deleted, causing `scrollToField` to silently no-op. Mitigation requires a force-mount-then-scroll async chain.

2. **`pdfPageDimensions` dependency** — Field overlays depend on page dimensions populated by each `<Page>` component's `onLoadSuccess` callback. Unmounted pages have no dimensions, so overlays return `null`. Requires pre-fetching all page viewports upfront.

3. **Scroll stability** — Placeholder divs need accurate heights for scroll position stability. Mixed page sizes (letter + landscape) make a single estimate unreliable.

4. **Async coordination** — The full scroll-to-field flow becomes: force mount page -> wait for page render -> wait for `onLoadSuccess` dimensions -> render overlay -> wait for ref callback -> scroll. This 4-step async chain adds ~80-100 lines of coordination logic.

### Option B: CSS `content-visibility: auto`

Browser-native optimization that skips paint/layout for off-screen content while keeping DOM elements mounted.

```css
.pdf-page-container {
  content-visibility: auto;
  contain-intrinsic-size: auto 800px 1100px;
}
```

**Deferred as low-priority** — This is a 3-line change that preserves all DOM refs and field overlays. Can be applied trivially if performance issues are reported.

### Option C: Hybrid (IntersectionObserver + content-visibility)

Combination of A and B. Same complexity concerns as Option A.

## Decision

Skip for now. The complexity-to-benefit ratio of Option A is poor, and Option B is trivial to add reactively if users report performance issues with large PDFs. The signing page handles typical documents (1-20 pages) without issues.

## Revisit Triggers

- User reports of slow/janky signing experience on 50+ page documents
- Memory crash reports on mobile devices during signing
- Performance monitoring data showing signing page memory exceeding thresholds

## Quick Win (if needed later)

Apply CSS `content-visibility: auto` to page containers in `sign.$token.tsx`. This is a 3-line, zero-risk change that keeps all refs valid.
