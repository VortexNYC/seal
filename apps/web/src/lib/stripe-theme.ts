/**
 * Stripe Connect Theme Configuration
 *
 * Centralized theme for all Stripe Connect embedded components.
 * Mirrors Seal's design system colors (navy blue primary, slate grays).
 *
 * NOTE: Stripe Connect does NOT support CSS variables — we must provide
 * hex values and use their update() API for theme switching.
 *
 * Appearance options reference:
 * https://docs.stripe.com/connect/embedded-appearance-options
 */

// Seal design system colors converted from OKLCH to hex
// Light mode (from styles.css :root)
const light = {
  background: "#ffffff", // oklch(1 0 0)
  foreground: "#09090b", // oklch(0.141 0.005 285.823) — zinc-950
  card: "#ffffff",
  muted: "#f4f4f5", // oklch(0.967 0.001 286.375) — zinc-100
  mutedForeground: "#71717a", // oklch(0.552 0.016 285.938) — zinc-500
  border: "#e4e4e7", // oklch(0.92 0.004 286.32) — zinc-200
  primary: "#013575", // oklch(0.32 0.11 250) — Seal navy blue
  destructive: "#dc2626", // oklch(0.577 0.245 27.325) — red-600
  accent: "#3b82f6", // For form accents (checkboxes, radio buttons)
} as const;

// Dark mode (from styles.css .dark)
const dark = {
  background: "#09090b", // oklch(0.141 0.005 285.823) — zinc-950
  foreground: "#fafafa", // oklch(0.985 0 0) — zinc-50
  card: "#18181b", // oklch(0.21 0.006 285.885) — zinc-900
  muted: "#27272a", // oklch(0.274 0.006 286.033) — zinc-800
  mutedForeground: "#a1a1aa", // oklch(0.705 0.015 286.067) — zinc-400
  border: "#27272a", // oklch(0.274 0.006 286.033) — zinc-800
  primary: "#3b82f6", // oklch(0.55 0.14 250) — lighter blue for dark mode
  destructive: "#dc2626",
  accent: "#60a5fa", // Lighter blue for dark mode
} as const;

/**
 * Stripe Connect appearance configuration.
 * Returns the full appearance object for `loadConnectAndInitialize()` or `instance.update()`.
 */
export function getStripeConnectAppearance(isDark: boolean) {
  const colors = isDark ? dark : light;

  return {
    overlays: "dialog" as const,
    variables: {
      // Core colors
      colorPrimary: colors.primary,
      colorBackground: colors.background,
      colorText: colors.foreground,
      colorSecondaryText: colors.mutedForeground,
      colorBorder: colors.border,
      colorDanger: colors.destructive,

      // Form elements
      formBackgroundColor: colors.card,
      formAccentColor: colors.accent,

      // Secondary/offset backgrounds
      offsetBackgroundColor: colors.muted,

      // Buttons
      buttonPrimaryColorBackground: colors.primary,
      buttonPrimaryColorText: "#ffffff",
      buttonSecondaryColorBackground: isDark ? "#3f3f46" : "#e4e4e7",
      buttonSecondaryColorText: colors.foreground,
      buttonBorderRadius: "8px",

      // Border radius
      borderRadius: "10px",
      formBorderRadius: "8px",
      badgeBorderRadius: "6px",
      overlayBorderRadius: "16px",

      // Overlay
      overlayBackdropColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
      overlayZIndex: 9999,

      // Typography — system font stack matching Seal
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      fontSizeBase: "14px",

      // Body typography
      bodyMdFontSize: "14px",
      bodyMdFontWeight: "400",
      bodySmFontSize: "12px",
      bodySmFontWeight: "400",

      // Heading typography
      headingXlFontSize: "24px",
      headingXlFontWeight: "600",
      headingXlTextTransform: "none" as const,
      headingLgFontSize: "20px",
      headingLgFontWeight: "600",
      headingLgTextTransform: "none" as const,
      headingMdFontSize: "16px",
      headingMdFontWeight: "600",
      headingMdTextTransform: "none" as const,
      headingSmFontSize: "14px",
      headingSmFontWeight: "600",
      headingSmTextTransform: "none" as const,
      headingXsFontSize: "12px",
      headingXsFontWeight: "600",
      headingXsTextTransform: "none" as const,

      // Label typography
      labelMdFontSize: "14px",
      labelMdFontWeight: "500",
      labelMdTextTransform: "none" as const,
      labelSmFontSize: "12px",
      labelSmFontWeight: "500",
      labelSmTextTransform: "none" as const,

      // Spacing
      spacingUnit: "8px",
    },
  };
}
