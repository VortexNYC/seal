/**
 * @module tokens/theme
 * @since 1.0.0
 *
 * Seal Design System — TypeScript token exports (Taupe + Hedvig)
 *
 * Use these hex values anywhere CSS variables aren't available:
 *   - React Email templates (inline styles)
 *   - Canvas / SVG rendering
 *   - Programmatic color manipulation
 *
 * These values mirror the OKLCH values in seal-theme-web.css exactly.
 * When updating a color, change both files.
 *
 * Visual language: Taupe 50–950. Owned in Seal. No product hue; red is
 * functional only.
 */

/** Brand color scale — Taupe 50→950 */
export const brand = {
  50: "#fbfaf9",
  100: "#f5f3f0",
  200: "#e7e2dc",
  300: "#d3cbc0",
  400: "#aa9e8d",
  500: "#867865",
  600: "#6c6050",
  700: "#554b3e",
  800: "#40382d",
  900: "#2c271f",
  950: "#17130e",
} as const;

export const light = {
  background: "#fbfaf9",
  foreground: "#2c271f",
  card: "#ffffff",
  cardForeground: "#2c271f",
  surface: "#f5f3f0",
  border: "#e7e2dc",
  input: "#e7e2dc",
  muted: "#f5f3f0",
  mutedForeground: "#867865",
  primary: "#2c271f",
  primaryForeground: "#fbfaf9",
  ring: "#aa9e8d",
} as const;

export const dark = {
  background: "#17130e",
  foreground: "#f5f3f0",
  card: "#2c271f",
  cardForeground: "#f5f3f0",
  surface: "#40382d",
  border: "#40382d",
  input: "#40382d",
  muted: "#40382d",
  mutedForeground: "#aa9e8d",
  primary: "#f5f3f0",
  primaryForeground: "#17130e",
  ring: "#6c6050",
} as const;

export const status = {
  success: "#1f8f5c",
  successForeground: "#ffffff",
  successSurface: "#e8f7ef",
  warning: "#c97f00",
  warningForeground: "#1a1200",
  warningSurface: "#fef7e0",
  info: "#2563eb",
  infoForeground: "#ffffff",
  infoSurface: "#eff6ff",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  expired: "#dc2626",
  expiredForeground: "#ffffff",
} as const;

/** 10 signer color slots — used for recipient color-coding (slot numbers are 1-based in the UI) */
export const signers = [
  { color: "#2563eb", surface: "#eff6ff" }, // 1 Blue
  { color: "#1f8f5c", surface: "#e8f7ef" }, // 2 Green
  { color: "#7c3aed", surface: "#f5f0fe" }, // 3 Purple
  { color: "#d97706", surface: "#fffbeb" }, // 4 Orange
  { color: "#db2777", surface: "#fdf2f8" }, // 5 Pink
  { color: "#0891b2", surface: "#ecfeff" }, // 6 Cyan
  { color: "#ca8a04", surface: "#fefce8" }, // 7 Yellow
  { color: "#4f46e5", surface: "#eef2ff" }, // 8 Indigo
  { color: "#0d9488", surface: "#f0fdfa" }, // 9 Teal
  { color: "#e11d48", surface: "#fff1f2" }, // 10 Rose
] as const;

/** Role badge colors — light mode hex */
export const roles = {
  owner: { color: "#7c3aed", surface: "#f5f0fe" }, // purple
  admin: { color: "#2563eb", surface: "#eff6ff" }, // blue
  member: { color: "#1f8f5c", surface: "#e8f7ef" }, // green
  viewer: { color: "#737373", surface: "#f5f5f5" }, // neutral gray
  system: { color: "#57534e", surface: "#f5f5f4" }, // stone
} as const;

/** Field type colors — light mode hex */
export const fields = {
  signature: { color: "#2563eb", surface: "#eff6ff", border: "#bfdbfe" },
  text: { color: "#1f8f5c", surface: "#e8f7ef", border: "#bbf7d0" },
  number: { color: "#c97f00", surface: "#fefce8", border: "#fde68a" },
  date: { color: "#7c3aed", surface: "#f5f0fe", border: "#ddd6fe" },
  checkbox: { color: "#d97706", surface: "#fffbeb", border: "#fed7aa" },
  dropdown: { color: "#0891b2", surface: "#ecfeff", border: "#a5f3fc" },
  radio: { color: "#db2777", surface: "#fdf2f8", border: "#fbcfe8" },
  attachment: { color: "#65a30d", surface: "#f7fee7", border: "#d9f99d" },
  payment: { color: "#059669", surface: "#ecfdf5", border: "#a7f3d0" },
} as const;

/** Document status surface colors — light mode hex */
export const docStatus = {
  completed: { surface: "#e8f7ef", border: "#6ee7b7", text: "#065f46" },
  inProgress: { surface: "#fef7e0", border: "#fde68a", text: "#78350f" },
  sent: { surface: "#eff6ff", border: "#93c5fd", text: "#1e3a8a" },
  declined: { surface: "#fff1f2", border: "#fca5a5", text: "#7f1d1d" },
} as const;

/** AI feature accent colors — light mode hex */
export const ai = {
  accent: "#7c3aed",
  accentForeground: "#ffffff",
  accentSurface: "#f5f0fe",
  accentBorder: "#c4b5fd",
  responseSurface: "#eff6ff",
  responseText: "#2563eb",
  autofillSurface: "#e8f7ef",
  autofillText: "#1f8f5c",
  errorSurface: "#fff1f2",
  errorText: "#e11d48",
  suggestionSurface: "#f5f0fe",
  suggestionText: "#7c3aed",
  warningSurface: "#fef7e0",
  warningText: "#c97f00",
} as const;

/**
 * Canvas rendering colors — for Konva/SVG contexts where CSS variables aren't available.
 * Split into two groups:
 *   - filled: ink used when a field has been signed
 *   - chrome: neutral UI chrome (backgrounds, borders, text)
 */
export const canvas = {
  /** Colors for fields that have been signed/completed */
  filled: {
    stroke: "#2c271f",
    shadowColor: "rgba(44, 39, 31, 0.08)",
    accent: "#2c271f",
    accentTint: "rgba(44, 39, 31, 0.06)",
    accentOpacity: "rgba(44, 39, 31, 0.12)",
    titleText: "#2c271f",
    detailText: "#867865",
  },
  /** Neutral field chrome — unselected borders, backgrounds, option text */
  chrome: {
    ink: "#2c271f",
    background: "#ffffff",
    backgroundUnassigned: "#fafafa",
    borderUnselected: "#cbd5e1",
    shadowUnselected: "rgba(0, 0, 0, 0.06)",
    shadowCheckbox: "rgba(0, 0, 0, 0.08)",
    anchorFill: "#ffffff",
    optionText: "#374151",
  },
} as const;

/** Email-safe palette — Taupe (no CSS variables in React Email) */
export const email = {
  background: "#f5f3f0",
  card: "#ffffff",
  border: "#e7e2dc",
  foreground: "#2c271f",
  mutedForeground: "#867865",
  primary: "#2c271f",
  primaryForeground: "#fbfaf9",
  success: "#1f8f5c",
  warning: "#c97f00",
  warningSurface: "#fef7e0",
  warningText: "#713f12",
} as const;

/** Aggregated design token registry — mirrors the OKLCH values in seal-theme-web.css */
export const tokens = {
  brand,
  light,
  dark,
  status,
  signers,
  roles,
  fields,
  docStatus,
  ai,
  canvas,
  email,
} as const;
