# Responsive Design

## Mobile-First: Write It Right

Start with base styles for mobile, use `min-width` queries to layer complexity. Desktop-first (`max-width`) means mobile loads unnecessary styles first.

## Breakpoints: Content-Driven

Don't chase device sizes—let content tell you where to break. Start narrow, stretch until design breaks, add breakpoint there. Three breakpoints usually suffice (640, 768, 1024px). Use `clamp()` for fluid values without breakpoints.

## Detect Input Method, Not Just Screen Size

**Screen size doesn't tell you input method.** A laptop with touchscreen, a tablet with keyboard—use pointer and hover queries:

```css
/* Fine pointer (mouse, trackpad) */
@media (pointer: fine) {
<<<<<<< HEAD
  .button {
    padding: 8px 16px;
  }
=======
  .button { padding: 8px 16px; }
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}

/* Coarse pointer (touch, stylus) */
@media (pointer: coarse) {
<<<<<<< HEAD
  .button {
    padding: 12px 20px;
  } /* Larger touch target */
=======
  .button { padding: 12px 20px; }  /* Larger touch target */
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}

/* Device supports hover */
@media (hover: hover) {
<<<<<<< HEAD
  .card:hover {
    transform: translateY(-2px);
  }
=======
  .card:hover { transform: translateY(-2px); }
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}

/* Device doesn't support hover (touch) */
@media (hover: none) {
<<<<<<< HEAD
  .card {
    /* No hover state - use active instead */
  }
=======
  .card { /* No hover state - use active instead */ }
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

**Critical**: Don't rely on hover for functionality. Touch users can't hover.

## Safe Areas: Handle the Notch

Modern phones have notches, rounded corners, and home indicators. Use `env()`:

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* With fallback */
.footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

**Enable viewport-fit** in your meta tag:
<<<<<<< HEAD

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
=======
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Responsive Images: Get It Right

### srcset with Width Descriptors

```html
<img
  src="hero-800.jpg"
<<<<<<< HEAD
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1200.jpg 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Hero image"
/>
```

**How it works**:

=======
  srcset="
    hero-400.jpg 400w,
    hero-800.jpg 800w,
    hero-1200.jpg 1200w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Hero image"
>
```

**How it works**:
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
- `srcset` lists available images with their actual widths (`w` descriptors)
- `sizes` tells the browser how wide the image will display
- Browser picks the best file based on viewport width AND device pixel ratio

### Picture Element for Art Direction

When you need different crops/compositions (not just resolutions):

```html
<picture>
<<<<<<< HEAD
  <source media="(min-width: 768px)" srcset="wide.jpg" />
  <source media="(max-width: 767px)" srcset="tall.jpg" />
  <img src="fallback.jpg" alt="..." />
=======
  <source media="(min-width: 768px)" srcset="wide.jpg">
  <source media="(max-width: 767px)" srcset="tall.jpg">
  <img src="fallback.jpg" alt="...">
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
</picture>
```

## Layout Adaptation Patterns

**Navigation**: Three stages—hamburger + drawer on mobile, horizontal compact on tablet, full with labels on desktop. **Tables**: Transform to cards on mobile using `display: block` and `data-label` attributes. **Progressive disclosure**: Use `<details>/<summary>` for content that can collapse on mobile.

## Testing: Don't Trust DevTools Alone

DevTools device emulation is useful for layout but misses:

- Actual touch interactions
- Real CPU/memory constraints
- Network latency patterns
- Font rendering differences
- Browser chrome/keyboard appearances

**Test on at least**: One real iPhone, one real Android, a tablet if relevant. Cheap Android phones reveal performance issues you'll never see on simulators.

---

**Avoid**: Desktop-first design. Device detection instead of feature detection. Separate mobile/desktop codebases. Ignoring tablet and landscape. Assuming all mobile devices are powerful.
