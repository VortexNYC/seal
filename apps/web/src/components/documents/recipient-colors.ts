/**
 * Recipient Color System
 *
 * Each recipient is assigned a unique color based on their index.
 * Tailwind classes pull from the --signer-* CSS tokens in seal-theme-web.css,
 * so dark mode and future color changes are handled in one place.
 * Hex values (for Konva/canvas rendering) mirror the same token values.
 *
 * SEA-98: Color indicators for recipients
 */

export interface RecipientColor {
  name: string;
  /** Tailwind class for background (solid dot/avatar) */
  bg: string;
  /** Tailwind class for light background (field overlays, hover states) */
  bgLight: string;
  /** Tailwind class for border */
  border: string;
  /** Tailwind class for text */
  text: string;
  /** Hex color for canvas/Konva use. vortex-allow-color: Konva canvas requires concrete colors and cannot resolve CSS custom properties. */
  hex: string;
  /** Light hex color for canvas fills. vortex-allow-color: Konva canvas requires concrete colors and cannot resolve CSS custom properties. */
  hexLight: string;
}

/**
 * Array of recipient colors. Recipients are assigned colors by their index.
 * If there are more recipients than colors, colors will cycle.
 * Classes use --signer-{n} / --signer-{n}-surface CSS tokens.
 */
export const RECIPIENT_COLORS: RecipientColor[] = [
  {
    name: "Blue",
    bg: "bg-signer-1",
    bgLight: "bg-signer-1-surface",
    border: "border-signer-1",
    text: "text-signer-1",
    hex: "#2563eb",
    hexLight: "rgba(37, 99, 235, 0.2)",
  },
  {
    name: "Green",
    bg: "bg-signer-2",
    bgLight: "bg-signer-2-surface",
    border: "border-signer-2",
    text: "text-signer-2",
    hex: "#1f8f5c",
    hexLight: "rgba(31, 143, 92, 0.2)",
  },
  {
    name: "Purple",
    bg: "bg-signer-3",
    bgLight: "bg-signer-3-surface",
    border: "border-signer-3",
    text: "text-signer-3",
    hex: "#7c3aed",
    hexLight: "rgba(124, 58, 237, 0.2)",
  },
  {
    name: "Orange",
    bg: "bg-signer-4",
    bgLight: "bg-signer-4-surface",
    border: "border-signer-4",
    text: "text-signer-4",
    hex: "#d97706",
    hexLight: "rgba(217, 119, 6, 0.2)",
  },
  {
    name: "Pink",
    bg: "bg-signer-5",
    bgLight: "bg-signer-5-surface",
    border: "border-signer-5",
    text: "text-signer-5",
    hex: "#db2777",
    hexLight: "rgba(219, 39, 119, 0.2)",
  },
  {
    name: "Cyan",
    bg: "bg-signer-6",
    bgLight: "bg-signer-6-surface",
    border: "border-signer-6",
    text: "text-signer-6",
    hex: "#0891b2",
    hexLight: "rgba(8, 145, 178, 0.2)",
  },
  {
    name: "Yellow",
    bg: "bg-signer-7",
    bgLight: "bg-signer-7-surface",
    border: "border-signer-7",
    text: "text-signer-7",
    hex: "#ca8a04",
    hexLight: "rgba(202, 138, 4, 0.2)",
  },
  {
    name: "Indigo",
    bg: "bg-signer-8",
    bgLight: "bg-signer-8-surface",
    border: "border-signer-8",
    text: "text-signer-8",
    hex: "#4f46e5",
    hexLight: "rgba(79, 70, 229, 0.2)",
  },
  {
    name: "Teal",
    bg: "bg-signer-9",
    bgLight: "bg-signer-9-surface",
    border: "border-signer-9",
    text: "text-signer-9",
    hex: "#0d9488",
    hexLight: "rgba(13, 148, 136, 0.2)",
  },
  {
    name: "Rose",
    bg: "bg-signer-10",
    bgLight: "bg-signer-10-surface",
    border: "border-signer-10",
    text: "text-signer-10",
    hex: "#e11d48",
    hexLight: "rgba(225, 29, 72, 0.2)",
  },
];

/**
 * Color for unassigned fields (no recipient assigned)
 */
export const UNASSIGNED_COLOR: RecipientColor = {
  name: "Unassigned",
  bg: "bg-muted-foreground/40",
  bgLight: "bg-muted",
  border: "border-border border-dashed",
  text: "text-muted-foreground",
  hex: "#9ca3af",
  hexLight: "rgba(156, 163, 175, 0.2)",
};

/**
 * Get the color for a recipient by their index
 * @param index - The recipient's index (0-based)
 * @returns The recipient color object
 */
export function getRecipientColor(index: number): RecipientColor {
  if (index < 0) return UNASSIGNED_COLOR;
  return RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
}

/**
 * Get the color for a recipient by their ID from a map
 * @param recipientId - The recipient's ID
 * @param recipientIndexMap - Map from recipient ID to their index
 * @returns The recipient color object
 */
export function getRecipientColorById(
  recipientId: string | null | undefined,
  recipientIndexMap: Map<string, number>
): RecipientColor {
  if (!recipientId) return UNASSIGNED_COLOR;
  const index = recipientIndexMap.get(recipientId);
  if (index === undefined) return UNASSIGNED_COLOR;
  return getRecipientColor(index);
}
