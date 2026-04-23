/**
 * Seal Design System — TypeScript token exports
 *
 * Use these hex values anywhere CSS variables aren't available:
 *   - React Email templates (inline styles)
 *   - Canvas / SVG rendering
 *   - Programmatic color manipulation
 *
 * These values mirror the OKLCH values in seal-theme-web.css exactly.
 * When updating a color, change both files.
 */

export const brand = {
  50: "#f9eeec",
  100: "#f0d4cf",
  200: "#e0a99f",
  300: "#cc7a6e",
  400: "#b85448",
  500: "#c8473a", // hover / --brand-500
  600: "#a63d2f", // primary / --brand-600
  700: "#872f24",
  800: "#6a2219",
  900: "#4e160f",
} as const;

export const light = {
  background: "#fafaf9",
  foreground: "#1a1714",
  card: "#ffffff",
  cardForeground: "#1a1714",
  surface: "#f5f3f0",
  border: "#e8e4df",
  input: "#e8e4df",
  muted: "#f5f3f0",
  mutedForeground: "#8a8279",
  primary: "#a63d2f",
  primaryForeground: "#ffffff",
  ring: "#c8473a",
} as const;

export const dark = {
  background: "#0a0a0a",
  foreground: "#f0ece8",
  card: "#141414",
  cardForeground: "#f0ece8",
  surface: "#202020",
  border: "#252525",
  input: "#252525",
  muted: "#202020",
  mutedForeground: "#8a8a8a",
  primary: "#c8473a",
  primaryForeground: "#ffffff",
  ring: "#c8473a",
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
  destructive: "#a63d2f",
  destructiveForeground: "#ffffff",
  expired: "#a63d2f",
  expiredForeground: "#ffffff",
} as const;

/** 10 signer color slots — used for recipient color-coding */
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
  system: { color: "#a63d2f", surface: "#f9eeec" }, // brand red
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
 * Split into three groups:
 *   - fieldColors: vivid craft-paper palette per field type (intentionally more saturated than CSS tokens)
 *   - filled: colors used when a field has been signed/completed
 *   - chrome: neutral UI chrome (backgrounds, borders, text)
 */
export const canvas = {
  fieldColors: {
    signature: { ink: "#1e3a5f", accent: "#3b82f6", glow: "rgba(59, 130, 246, 0.25)" },
    text: { ink: "#14532d", accent: "#22c55e", glow: "rgba(34, 197, 94, 0.25)" },
    number: { ink: "#78350f", accent: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)" },
    date: { ink: "#4c1d95", accent: "#8b5cf6", glow: "rgba(139, 92, 246, 0.25)" },
    checkbox: { ink: "#7c2d12", accent: "#f97316", glow: "rgba(249, 115, 22, 0.25)" },
    dropdown: { ink: "#164e63", accent: "#06b6d4", glow: "rgba(6, 182, 212, 0.25)" },
    radio: { ink: "#831843", accent: "#ec4899", glow: "rgba(236, 72, 153, 0.25)" },
    attachment: { ink: "#3f6212", accent: "#84cc16", glow: "rgba(132, 204, 22, 0.25)" },
    payment: { ink: "#065f46", accent: "#10b981", glow: "rgba(16, 185, 129, 0.25)" },
  },
  /** Colors for fields that have been signed/completed */
  filled: {
    stroke: "#22c55e",
    shadowColor: "rgba(34, 197, 94, 0.1)",
    accent: "#22c55e",
    accentTint: "rgba(34, 197, 94, 0.08)",
    accentOpacity: "rgba(34, 197, 94, 0.2)",
    titleText: "#166534",
    detailText: "#6b7280",
  },
  /** Neutral field chrome — unselected borders, backgrounds, option text */
  chrome: {
    background: "#ffffff",
    backgroundUnassigned: "#fafafa",
    borderUnselected: "#cbd5e1",
    shadowUnselected: "rgba(0, 0, 0, 0.06)",
    shadowCheckbox: "rgba(0, 0, 0, 0.08)",
    anchorFill: "#ffffff",
    optionText: "#374151",
  },
} as const;

/** Email-safe palette — inline styles for React Email templates */
export const email = {
  background: "#f5f3f0",
  card: "#ffffff",
  border: "#e8e4df",
  foreground: "#1a1714",
  mutedForeground: "#8a8279",
  primary: "#a63d2f",
  primaryForeground: "#ffffff",
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
