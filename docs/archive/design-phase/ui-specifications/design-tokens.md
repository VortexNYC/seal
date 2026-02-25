# Design Tokens

## Color System - shadcn/ui Neutral Palette

### Core Colors - shadcn Neutral Theme

```typescript
// Using official shadcn/ui neutral color palette
const colors = {
  // Core brand colors
  black: "#000000",
  white: "#ffffff",

  // shadcn/ui neutral scale
  neutral: {
    50: "#fafafa", // Very light background (neutral-50)
    100: "#f5f5f5", // Light background (neutral-100)
    200: "#e5e5e5", // Border light (neutral-200)
    300: "#d4d4d4", // Border (neutral-300)
    400: "#a3a3a3", // Muted text (neutral-400)
    500: "#737373", // Secondary text (neutral-500)
    600: "#525252", // Text (neutral-600)
    700: "#404040", // Dark text (neutral-700)
    800: "#262626", // Very dark (neutral-800)
    900: "#171717", // Almost black (neutral-900)
    950: "#0a0a0a", // Maximum contrast (neutral-950)
  },

  // Semantic colors (minimal usage)
  success: "#16a34a", // Green-600 for success states
  error: "#dc2626", // Red-600 for errors
  warning: "#ca8a04", // Yellow-600 for warnings
  info: "#2563eb", // Blue-600 for info
} as const;
```

### Background Colors

```typescript
// Background hierarchy using shadcn neutral palette
const backgrounds = {
  primary: colors.white, // Main content areas
  secondary: colors.neutral[50], // Cards, sections
  tertiary: colors.neutral[100], // Subtle backgrounds
  inverse: colors.neutral[900], // Dark emphasis areas
} as const;
```

### Border Colors

```typescript
// Border system using neutral palette
const borders = {
  light: colors.neutral[200], // Default borders
  medium: colors.neutral[300], // Emphasized borders
  strong: colors.neutral[400], // Strong borders
  focus: colors.neutral[900], // Focus states
} as const;
```

### Text Colors

```typescript
// Text hierarchy using neutral palette
const text = {
  primary: colors.neutral[900], // Main text (maximum contrast)
  secondary: colors.neutral[600], // Supporting text (readable)
  tertiary: colors.neutral[500], // Supporting information
  muted: colors.neutral[400], // Subtle text, placeholders
  subtle: colors.neutral[300], // Very subtle text
  inverse: colors.white, // Text on dark backgrounds
  error: colors.error, // Error text
  success: colors.success, // Success text
  warning: colors.warning, // Warning text
  info: colors.info, // Info text
} as const;
```

## Typography System (Inter Font)

### Font Configuration

```typescript
const typography = {
  // Font families
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    mono: ["ui-monospace", "SFMono-Regular", "monospace"],
  },

  // Font sizes (rem-based for accessibility)
  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px (base)
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem", // 48px
  },

  // Font weights
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  // Line heights
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },

  // Letter spacing
  letterSpacing: {
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
  },
} as const;
```

### Typography Scale

```typescript
const textStyles = {
  // Display text
  "display-2xl": {
    fontSize: typography.fontSize["5xl"],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },
  "display-xl": {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },

  // Headings
  "heading-xl": {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
  },
  "heading-lg": {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.normal,
  },
  "heading-md": {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.normal,
  },
  "heading-sm": {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.normal,
  },

  // Body text
  "body-lg": {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.relaxed,
  },
  "body-md": {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  "body-sm": {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  "body-xs": {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },

  // Labels
  "label-lg": {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.normal,
  },
  "label-md": {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.normal,
  },
  "label-sm": {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.normal,
  },
} as const;
```

## Spacing System (8px Grid)

### Spacing Scale

```typescript
const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  11: "2.75rem", // 44px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  28: "7rem", // 112px
  32: "8rem", // 128px
} as const;
```

### Component Spacing

```typescript
const componentSpacing = {
  // Internal component spacing
  component: {
    xs: spacing[1], // 4px
    sm: spacing[2], // 8px
    md: spacing[3], // 12px
    lg: spacing[4], // 16px
    xl: spacing[6], // 24px
  },

  // Layout spacing
  layout: {
    xs: spacing[4], // 16px
    sm: spacing[6], // 24px
    md: spacing[8], // 32px
    lg: spacing[12], // 48px
    xl: spacing[16], // 64px
    "2xl": spacing[24], // 96px
  },
} as const;
```

## Border System

### Border Radius

```typescript
const borderRadius = {
  none: "0",
  sm: "0.125rem", // 2px
  base: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  "3xl": "1.5rem", // 24px
  full: "9999px", // Fully rounded
} as const;
```

### Border Width

```typescript
const borderWidth = {
  0: "0",
  default: "1px",
  2: "2px",
  4: "4px",
  8: "8px",
} as const;
```

## Shadow System (Subtle shadcn/ui Style)

### Box Shadows

```typescript
const boxShadow = {
  none: "none",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
} as const;
```

## Z-Index Scale

### Layer Management

```typescript
const zIndex = {
  hide: -1,
  auto: "auto",
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;
```

## TailwindCSS v4 Configuration

### Usage in Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      lineHeight: typography.lineHeight,
      letterSpacing: typography.letterSpacing,
      spacing,
      borderRadius,
      borderWidth,
      boxShadow,
      zIndex,
    },
  },
};

export default config;
```

### NativeWind Integration

```typescript
// For React Native with NativeWind
const nativeWindConfig = {
  theme: {
    colors: {
      // Map colors for native compatibility
      primary: colors.black,
      secondary: colors.gray[600],
      background: colors.white,
      surface: colors.gray[50],
      border: colors.gray[200],
      text: colors.gray[900],
      "text-muted": colors.gray[400],
    },
    spacing,
    borderRadius: {
      ...borderRadius,
      // Native-friendly values
      button: borderRadius.md,
      input: borderRadius.base,
      card: borderRadius.lg,
    },
  },
};
```

## Component-Specific Tokens

### Button Variants

```typescript
const buttonTokens = {
  primary: {
    bg: colors.neutral[900], // Primary button background
    text: colors.white, // White text on dark background
    border: colors.neutral[900], // Matching border
    hover: colors.neutral[800], // Slightly lighter on hover
  },
  secondary: {
    bg: colors.white, // White background
    text: colors.neutral[900], // Dark text
    border: colors.neutral[300], // Subtle border
    hover: colors.neutral[50], // Very light hover state
  },
  ghost: {
    bg: "transparent", // Transparent background
    text: colors.neutral[600], // Medium gray text
    border: "transparent", // No border
    hover: colors.neutral[100], // Light hover background
  },
} as const;
```

### Input Variants

```typescript
const inputTokens = {
  default: {
    bg: colors.white, // White input background
    text: colors.neutral[900], // Dark text for readability
    border: colors.neutral[300], // Subtle border
    placeholder: colors.neutral[400], // Muted placeholder
    focus: colors.neutral[900], // Dark focus ring
  },
  error: {
    bg: colors.white, // White background maintained
    text: colors.neutral[900], // Dark text
    border: colors.error, // Red border for error state
    placeholder: colors.neutral[400], // Same placeholder color
    focus: colors.error, // Red focus ring
  },
} as const;
```

This token system provides a complete foundation for consistent design across React and React Native using TailwindCSS v4 and NativeWind, following the shadcn/ui neutral theme aesthetic with comprehensive neutral scale colors.
