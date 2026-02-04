/**
 * Recipient Color System
 *
 * Each recipient is assigned a unique color based on their index.
 * Colors are designed to be visually distinct and accessible.
 *
 * SEA-98: Color indicators for recipients
 */

export interface RecipientColor {
  name: string;
  /** Tailwind class for background */
  bg: string;
  /** Tailwind class for light background (for hover states) */
  bgLight: string;
  /** Tailwind class for border */
  border: string;
  /** Tailwind class for text */
  text: string;
  /** Hex color for canvas/Konva use */
  hex: string;
  /** Light hex color for canvas fills */
  hexLight: string;
}

/**
 * Array of recipient colors. Recipients are assigned colors by their index.
 * If there are more recipients than colors, colors will cycle.
 */
export const RECIPIENT_COLORS: RecipientColor[] = [
  {
    name: "Blue",
    bg: "bg-blue-500",
    bgLight: "bg-blue-100",
    border: "border-blue-500",
    text: "text-blue-700",
    hex: "#3b82f6",
    hexLight: "rgba(59, 130, 246, 0.2)",
  },
  {
    name: "Green",
    bg: "bg-green-500",
    bgLight: "bg-green-100",
    border: "border-green-500",
    text: "text-green-700",
    hex: "#22c55e",
    hexLight: "rgba(34, 197, 94, 0.2)",
  },
  {
    name: "Purple",
    bg: "bg-purple-500",
    bgLight: "bg-purple-100",
    border: "border-purple-500",
    text: "text-purple-700",
    hex: "#a855f7",
    hexLight: "rgba(168, 85, 247, 0.2)",
  },
  {
    name: "Orange",
    bg: "bg-orange-500",
    bgLight: "bg-orange-100",
    border: "border-orange-500",
    text: "text-orange-700",
    hex: "#f97316",
    hexLight: "rgba(249, 115, 22, 0.2)",
  },
  {
    name: "Pink",
    bg: "bg-pink-500",
    bgLight: "bg-pink-100",
    border: "border-pink-500",
    text: "text-pink-700",
    hex: "#ec4899",
    hexLight: "rgba(236, 72, 153, 0.2)",
  },
  {
    name: "Cyan",
    bg: "bg-cyan-500",
    bgLight: "bg-cyan-100",
    border: "border-cyan-500",
    text: "text-cyan-700",
    hex: "#06b6d4",
    hexLight: "rgba(6, 182, 212, 0.2)",
  },
  {
    name: "Yellow",
    bg: "bg-yellow-500",
    bgLight: "bg-yellow-100",
    border: "border-yellow-500",
    text: "text-yellow-700",
    hex: "#eab308",
    hexLight: "rgba(234, 179, 8, 0.2)",
  },
  {
    name: "Indigo",
    bg: "bg-indigo-500",
    bgLight: "bg-indigo-100",
    border: "border-indigo-500",
    text: "text-indigo-700",
    hex: "#6366f1",
    hexLight: "rgba(99, 102, 241, 0.2)",
  },
  {
    name: "Teal",
    bg: "bg-teal-500",
    bgLight: "bg-teal-100",
    border: "border-teal-500",
    text: "text-teal-700",
    hex: "#14b8a6",
    hexLight: "rgba(20, 184, 166, 0.2)",
  },
  {
    name: "Rose",
    bg: "bg-rose-500",
    bgLight: "bg-rose-100",
    border: "border-rose-500",
    text: "text-rose-700",
    hex: "#f43f5e",
    hexLight: "rgba(244, 63, 94, 0.2)",
  },
];

/**
 * Color for unassigned fields (no recipient assigned)
 */
export const UNASSIGNED_COLOR: RecipientColor = {
  name: "Unassigned",
  bg: "bg-gray-400",
  bgLight: "bg-gray-100",
  border: "border-gray-400 border-dashed",
  text: "text-gray-500",
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
  recipientIndexMap: Map<string, number>,
): RecipientColor {
  if (!recipientId) return UNASSIGNED_COLOR;
  const index = recipientIndexMap.get(recipientId);
  if (index === undefined) return UNASSIGNED_COLOR;
  return getRecipientColor(index);
}
