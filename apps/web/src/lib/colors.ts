/**
 * Centralized Color System for Seal
 *
 * This file provides hex color values for use in:
 * - Canvas/Konva components (which require hex values)
 * - Dynamic style generation
 * - Any context where CSS variables cannot be used
 *
 * For regular components, prefer using Tailwind classes:
 * - bg-brand-700, text-brand-700, border-brand-700
 * - bg-success, text-warning, etc.
 */

// ============================================
// BRAND COLORS
// ============================================
export const brand = {
	50: "#f0f6fc",
	100: "#d9e8f5",
	200: "#b3d1eb",
	300: "#7ab3dc",
	400: "#4190c8",
	500: "#1a6cb0",
	600: "#015594",
	700: "#013575", // PRIMARY BRAND
	800: "#012a5c",
	900: "#011d40",
} as const;

// ============================================
// NEUTRAL GRAYS (cool-tinted to complement blue)
// ============================================
export const neutral = {
	50: "#f8f9fa",
	100: "#f1f3f5",
	200: "#e9ecef",
	300: "#dee2e6",
	400: "#ced4da",
	500: "#adb5bd",
	600: "#868e96",
	700: "#495057",
	800: "#343a40",
	900: "#212529",
} as const;

// ============================================
// SEMANTIC STATUS COLORS
// ============================================
export const success = {
	50: "#ecfdf5",
	100: "#d1fae5",
	500: "#10b981",
	600: "#059669",
	700: "#047857",
} as const;

export const warning = {
	50: "#fffbeb",
	100: "#fef3c7",
	500: "#f59e0b",
	600: "#d97706",
	700: "#b45309",
} as const;

export const error = {
	50: "#fef2f2",
	100: "#fee2e2",
	500: "#ef4444",
	600: "#dc2626",
	700: "#b91c1c",
} as const;

export const info = {
	50: "#eff6ff",
	100: "#dbeafe",
	500: "#3b82f6",
	600: "#2563eb",
	700: "#1d4ed8",
} as const;

// ============================================
// FIELD TYPE COLORS (for Canvas/Konva)
// ============================================
export type FieldType =
	| "signature"
	| "text"
	| "date"
	| "checkbox"
	| "dropdown"
	| "radio"
	| "attachment";

export interface FieldColorScheme {
	ink: string;
	accent: string;
	glow: string;
}

export const fieldColors: Record<FieldType, FieldColorScheme> = {
	signature: {
		ink: "#1e3a5f",
		accent: info[500],
		glow: "rgba(59, 130, 246, 0.25)",
	},
	text: {
		ink: "#14532d",
		accent: success[500],
		glow: "rgba(16, 185, 129, 0.25)",
	},
	date: {
		ink: "#4c1d95",
		accent: "#8b5cf6",
		glow: "rgba(139, 92, 246, 0.25)",
	},
	checkbox: {
		ink: "#7c2d12",
		accent: warning[500],
		glow: "rgba(245, 158, 11, 0.25)",
	},
	dropdown: {
		ink: "#164e63",
		accent: "#06b6d4",
		glow: "rgba(6, 182, 212, 0.25)",
	},
	radio: {
		ink: "#831843",
		accent: "#ec4899",
		glow: "rgba(236, 72, 153, 0.25)",
	},
	attachment: {
		ink: "#3f6212",
		accent: "#84cc16",
		glow: "rgba(132, 204, 22, 0.25)",
	},
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert hex to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get a shadow color from the brand palette
 */
export function getBrandShadow(opacity = 0.15): string {
	return hexToRgba(brand[700], opacity);
}

/**
 * Status color map for convenience
 */
export const statusColors = {
	success,
	warning,
	error,
	info,
} as const;
