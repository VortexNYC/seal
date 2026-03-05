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
| 03 | Typography | 32-0 | 🔄 | Fonts (Instrument Serif / Plus Jakarta / JetBrains Mono) in @theme. Need to verify weight scale, size scale |
| 04 | Status & Signer Colors | 5B-0 | ✅ | Dark mode OKLCH values synced. Signer colors hardcoded in recipient-colors.ts |
| 05 | Signature Fonts | 6Z-0 | ⬜ | Review — are these in signing page? |
| 06 | Email Palette | 7T-0 | ⬜ | Transactional package — separate audit |
| 07 | Iconography | 1QV-0 | ⬜ | Review icon set usage |
| 08 | Buttons | 1DW-0 | 🔄 | Primary/destructive separation done. Need to verify hover states, success state ("Sent!") |
| 09 | Brand in Context | Z4-0 | ⬜ | Reference board, no code |
| 10 | Form Controls | 1G1-0 | 🔄 | Checkbox border fixed (border-primary→border-input). Minor dark mode gaps: input bg #1A1A1A vs token #141414, border #2E2E2E vs #252525. Focus ring opacity 12% vs 50%. |
| 11 | Badges & Status | 1IK-0 | 🔄 | Status badges verified visually. Need to check payment badges, count badges |
| 12 | Cards | 1KQ-0 | ❌ | Not yet audited |
| 13 | Tables & Lists | 1XJ-0 | ❌ | Not yet audited |
| 14 | Empty States | 23E-0 | ❌ | Not yet audited |
| 15 | Toasts & Modals | 25W-0 | ❌ | Not yet audited |
| 16 | Loading States | 29I-0 | ❌ | Not yet audited |
| 17 | Navigation | 1NP-0 | ❌ | Not yet audited |
| 18 | Spacing & Grid | 3R7-0 | 🔄 | Spacing tokens exist (space-1 through space-10). Need to verify against board |
| 19 | Avatars & Presence | 3U7-0 | ❌ | Not yet audited |
| 20 | Dropdowns & Menus | 3WT-0 | ❌ | Not yet audited |
| 21 | Tooltips | 3YY-0 | ❌ | Not yet audited |
| 22 | File Upload | 40L-0 | ❌ | Not yet audited |
| 23 | Tabs | 42I-0 | ❌ | Not yet audited |
| 24 | Date Picker | 43Y-0 | ❌ | Not yet audited |
| 25 | App Shell & Sidebar | 47Q-0 | ❌ | Not yet audited |
| 26 | Motion Principles | 4AG-0 | 🔄 | Motion tokens exist. Need to verify against board |

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
