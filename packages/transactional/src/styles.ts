/**
 * Shared email styles — sourced from the Seal design token system.
 *
 * Import from here instead of hardcoding hex values in email templates.
 * This ensures emails stay in sync with the brand as tokens evolve.
 *
 * Usage:
 *   import { colors, fonts, containers } from "~/styles";
 *   <Body style={{ backgroundColor: colors.background, fontFamily: fonts.sans }}>
 */

import { email, status } from "@seal/tokens/theme";

// Re-export the email palette for convenience
export { email, status };

/** CSS font stacks for React Email (inline styles only, no CSS variables) */
export const fonts = {
  sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: '"Instrument Serif", Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
} as const;

/** Reusable inline style objects for common email patterns */
export const containers = {
  outer: {
    backgroundColor: email.background,
    padding: "40px 0",
    fontFamily:
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    backgroundColor: email.card,
    border: `1px solid ${email.border}`,
    borderRadius: "8px",
    padding: "40px",
    width: "520px",
    margin: "40px auto",
  },
  divider: {
    borderColor: email.border,
  },
} as const;

export const text = {
  heading: {
    color: email.foreground,
    fontSize: "24px",
    fontWeight: "600",
    margin: "0 0 8px 0",
  },
  body: {
    color: email.foreground,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px 0",
  },
  muted: {
    color: email.mutedForeground,
    fontSize: "14px",
    lineHeight: "22px",
  },
  small: {
    color: email.mutedForeground,
    fontSize: "12px",
    lineHeight: "18px",
  },
} as const;

export const button = {
  primary: {
    backgroundColor: email.primary,
    color: email.primaryForeground,
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: "500",
    padding: "12px 24px",
    display: "block",
    textAlign: "center" as const,
    textDecoration: "none",
  },
} as const;

export const surfaces = {
  document: {
    backgroundColor: email.background,
    border: `1px solid ${email.border}`,
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "24px",
  },
  message: {
    borderLeft: `3px solid ${email.warning}`,
    backgroundColor: email.warningSurface,
    padding: "12px 12px 12px 16px",
    marginBottom: "24px",
  },
  footer: {
    color: email.mutedForeground,
    fontSize: "12px",
    textAlign: "center" as const,
    marginTop: "32px",
  },
} as const;
