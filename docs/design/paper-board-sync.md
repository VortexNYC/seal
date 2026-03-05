# Paper → Code Sync Tracker

Source of truth: **Paper file "Seal"** (47 artboards)
Last audited: 2026-03-04

## How to use
- Read a board via `get_jsx` / `get_children` / `get_screenshot`
- Compare extracted values with `seal-theme-web.css` and component code
- Mark status when verified or updated

## Status Legend
- ✅ Synced — code matches Paper
- 🔄 Partial — some values synced, gaps remain
- ❌ Not synced — Paper has values not yet in code
- ⬜ Not applicable — board is reference-only (no code counterpart)

---

## Design System Boards

| # | Board | ID | Status | Notes |
|---|-------|----|--------|-------|
| 01 | Logo System | QL-0 | ⬜ | Static asset, no tokens |
| 02 | Color System | 16-0 | ✅ | Light mode hex + dark mode verified via Playwright |
| 03 | Typography | 32-0 | ✅ | Fonts match (Instrument Serif / Plus Jakarta Sans / JetBrains Mono). Weight scale 300–700 covered by Tailwind defaults. Serif display sizes (64px/40px) are marketing-only. Minor cosmetic gaps: letter-spacing -0.01em for serif display not set, body line-height 160% vs Tailwind ~150% — address when building marketing pages. |
| 04 | Status & Signer Colors | 5B-0 | ✅ | Dark mode OKLCH values synced. Signer colors hardcoded in recipient-colors.ts |
| 05 | Signature Fonts | 6Z-0 | ⬜ | Review — are these in signing page? |
| 06 | Email Palette | 7T-0 | ⬜ | Transactional package — separate audit |
| 07 | Iconography | 1QV-0 | ⬜ | Review icon set usage |
| 08 | Buttons | 1DW-0 | ✅ | All variants verified (primary, secondary, ghost, destructive, link, disabled). Hover uses opacity-based approach (Shadcn convention) vs Paper's distinct hex — visually equivalent. Sizes: sm 32px vs Paper 28px, lg 40px vs 44px (Shadcn defaults). Success/loading are app-level states, not component tokens. Destructive uses solid red bg (Shadcn) vs Paper's light-red bg — design decision, no token change. |
| 09 | Brand in Context | Z4-0 | ⬜ | Reference board, no code |
| 10 | Form Controls | 1G1-0 | ✅ | Checkbox border fixed. Dark mode: input bg oklch(0.197) resolves ~#1C1C1C (close to Paper #1A1A1A). Border follows board 04 as authoritative. Focus ring 50% (code) vs 12% (Paper) — intentional accessibility override. All gaps documented, no changes needed. |
| 11 | Badges & Status | 1IK-0 | ✅ | All status colors match semantic tokens (success/warning/info/expired/destructive). Payment badges use same status colors with square corners (4px) + uppercase — component-level difference, no token gap. Count badges use primary/destructive bg — covered by existing tokens. Signer chips are custom components. |
| 12 | Cards | 1KQ-0 | ✅ | Light mode tokens match (card, border, foreground, secondary, status badges). Component uses semantic tokens correctly. Dark mode neutral hex in mockup differs slightly from board 04 color system — board 04 is authoritative. Border-radius 10px vs code 12px (rounded-xl). |
| 13 | Tables & Lists | 1XJ-0 | ✅ | All semantic colors match. Status badges, pagination, checkbox styling all use correct tokens. Bulk selection uses #FEF5F4 brand tint (= sidebar-accent). Dark mode consistent with other boards. |
| 14 | Empty States | 23E-0 | ❌ | Not yet audited |
| 15 | Toasts & Modals | 25W-0 | 🔄 | All semantic colors match tokens. Paper shows colored left-border toast pattern (3px border-left) — Sonner doesn't implement this yet. Modals use standard dialog tokens. No token changes needed. |
| 16 | Loading States | 29I-0 | ❌ | Not yet audited |
| 17 | Navigation | 1NP-0 | 🔄 | Sidebar-accent updated to brand tint (#FEF5F4 light / #2A1410 dark). Sidebar bg Paper=#FFFFFF vs token=#F5F3F0 (intentional tint). Active/inactive states, tabs, breadcrumbs use correct semantic tokens. |
| 18 | Spacing & Grid | 3R7-0 | ✅ | Scale 2–128px maps directly to Tailwind v4 defaults (no custom tokens needed). Semantic tokens space-1 (4px) through space-10 (64px) = Tailwind gap/p classes. Grid: 12 cols, 16px gutter, 1280px max (= max-w-7xl). |
| 19 | Avatars & Presence | 3U7-0 | ❌ | Not yet audited |
| 20 | Dropdowns & Menus | 3WT-0 | ❌ | Not yet audited |
| 21 | Tooltips | 3YY-0 | ❌ | Not yet audited |
| 22 | File Upload | 40L-0 | ❌ | Not yet audited |
| 23 | Tabs | 42I-0 | ❌ | Not yet audited |
| 24 | Date Picker | 43Y-0 | ❌ | Not yet audited |
| 25 | App Shell & Sidebar | 47Q-0 | 🔄 | Sidebar layout and nav items match. Active state differs from board 17 (neutral #141414 vs brand-tint #2A1410) — following board 17 as authoritative Navigation board. Token values (foreground, muted, separator) consistent. |
| 26 | Motion Principles | 4AG-0 | ✅ | Duration scale (80/150/200/350/600ms) maps to Tailwind duration-* classes. Easing: ease-in matches exactly, ease-out Paper uses expo curve `cubic-bezier(0.16, 1, 0.3, 1)` vs Tailwind default — add as custom when building entrance animations. Rules (enter fast/exit instantly, reduced-motion, no loops) are design principles. |

## Screen Mocks

| Screen | ID | Status | Notes |
|--------|----|--------|-------|
| Dashboard | 2CC-0 | ✅ | Verified via Playwright |
| Signing Experience | 2GV-0 | ⬜ | Need to test signing flow |
| Email Template | 2K1-0 | ⬜ | Transactional package |
| Dashboard (Dark) | 3HA-0 | ✅ | Verified via Playwright |
| Signing Experience (Dark) | 3HB-0 | ⬜ | Need to test |
| Email Template (Dark) | 3HC-0 | ⬜ | Transactional package |
| Marketing Hero | 3Q2-0 | ⬜ | Landing site |
| Document Field Editor | 4Q3-0 | ❌ | Not yet audited |
| Document Detail | 4UV-0 | ❌ | Not yet audited |
| Settings | 4ZP-0 | 🔄 | Basic structure verified. Need detailed audit |
| Marketing Hero v2 | 53L-0 | ⬜ | Landing site |
| Mobile Signing | 4O6-0 | ⬜ | Mobile responsive — separate audit |

## Marketing Boards (landing site — lower priority)

| Board | ID | Status |
|-------|----|--------|
| Pricing | 4CY-0 | ⬜ |
| Feature Highlights | 4FV-0 | ⬜ |
| Social Proof | 4KN-0 | ⬜ |
| Footer | 4MP-0 | ⬜ |
| Pricing v2 | 5DS-0 | ⬜ |
| Feature Highlights v2 | 55T-0 | ⬜ |
| Social Proof v2 | 5AX-0 | ⬜ |
| Footer v2 | 5CA-0 | ⬜ |

## Working Board

| Board | ID | Status |
|-------|----|--------|
| Direction — Design Shakeup Plan | 62T-1 | ⬜ | Working doc, not for implementation |
