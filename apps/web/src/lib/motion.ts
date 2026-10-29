/**
 * Shared tw-animate-css recipes (shadcn-style animate-in / animate-out).
 * Prefer these over one-off keyframes so motion stays calm and consistent.
 */

/** Overlay fade for radix/kumo dialogs */
export const MOTION_OVERLAY =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150";

/** Centered dialog / alert content */
export const MOTION_DIALOG =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200";

/** Page / section content enter (use once per view, not on every card) */
export const MOTION_PAGE =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-both";

/** Compact list / empty / panel enter */
export const MOTION_PANEL =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-safe:fill-mode-both";

/** Success / done moment — tiny zoom, not confetti */
export const MOTION_SUCCESS =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:fill-mode-both";

/** Interactive row / chip press feedback */
export const MOTION_PRESS =
  "transition-all duration-150 ease-out active:scale-98.5 motion-reduce:active:scale-100";
