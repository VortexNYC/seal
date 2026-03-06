
## Design Context

### Users

Seal is a workflow-focused document signing and collaboration application for B2B teams.

Primary users are internal organization stakeholders:

- Admins creating templates, org settings, and process guardrails
- Teammates preparing, sending, and tracking signatures
- Recipients completing signing flows in a compliance-sensitive context

The interface should prioritize reliability, speed, and clear task completion.

### Brand Personality

The brand direction is **confident and modern with subtle delight**.

Core tone:

- Confident without noise
- Modern without being playful
- Subtle enough to keep attention on outcomes

### Aesthetic Direction

- Product UI inherits the shared token system under `packages/tokens`:
  - Brand primary (`--brand-*`) uses warm red/rose tones rooted in `#A63D2F` with neutral warm backgrounds.
  - Light and dark themes are both first-class, with explicit dark-mode tokens.
  - Type scale is clear and legible, with a three-family system:
    - `Instrument Serif` for headings/marketing emphasis
    - `Plus Jakarta Sans` for body and interface UI
    - `JetBrains Mono` for code, keys, and API-like values
- Existing logo and mark assets are provided in `apps/web/public/logo/*` and used consistently via `SealLogo` / `SealLogoBadgeFixed` components.
- The design system already encodes status colors, signer color slots, role badges, motion timings, and form/field affordances in CSS variables.
- Anti-reference: over-the-top gradient-heavy marketing styling or novelty-heavy microcopy.

### Design Principles

1. Prioritize task completion over visual flair.
2. Preserve system consistency by using existing tokens, shared components, and established patterns first.
3. Reinforce trust with clear hierarchy, spacing, contrast, and predictable status states.
4. Keep motion and feedback useful, not decorative.
5. Support org-level branding in signing/email surfaces while preserving product-wide consistency.

### Accessibility and Inclusion Notes

- Design must support both light and dark themes.
- Inputs and controls must remain highly legible on muted warm neutrals.
- Maintain clear keyboard focus indicators and sufficient contrast in controls, alerts, and status chips.
- Keep motion practical and restrained: useful progress and transition cues only.

## Design-First Defaults (Implied by `teach-impeccable`)

When making frontend changes for this project:

- Use existing token contracts from `packages/tokens` by default (`brand`, `light`, `dark`, semantic states, and spacing/motion tokens).
- Keep light/dark parity: every UI change should be validated against both themes.
- Default to practical, task-first layouts over decorative treatments.
- Preserve established Shadcn/route-level composition patterns and avoid introducing local one-off style systems.
- Use restrained motion only where it improves comprehension (progress, reveal, focus transitions).
- Maintain high contrast and obvious status hierarchy for signing and auth/document workflows.
- Keep customization features scoped to intended surfaces (e.g., signing page/email branding, org settings where relevant) and do not drift into unrelated surfaces.

### Anti-Patterns to Avoid

- Hard-coding color literals in new UI instead of tokenized variables.
- Introducing local font stacks that bypass shared token typography.
- Adding heavy gradients or decorative backgrounds to core workflow screens.
- Animating non-essential interactions that slows down completion tasks.
- Expanding branding controls beyond scoped surfaces.
- Building style systems parallel to `packages/tokens` instead of extending existing primitives.
