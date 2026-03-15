import type { SignIn } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { dark as darkTokens, light, status } from "@seal/tokens/theme";
import type { ComponentProps } from "react";

type ClerkAuthAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

export function getClerkAuthAppearance(isDark: boolean): ClerkAuthAppearance {
  const colors = isDark ? darkTokens : light;

  return {
    theme: isDark ? dark : undefined,
    layout: {
      socialButtonsVariant: "blockButton",
    },
    variables: {
      colorPrimary: colors.primary,
      colorPrimaryForeground: colors.primaryForeground,
      colorDanger: status.destructive,
      colorSuccess: status.success,
      colorWarning: status.warning,
      colorBackground: colors.card,
      colorForeground: colors.foreground,
      colorInput: colors.surface,
      colorInputForeground: colors.foreground,
      colorMuted: colors.surface,
      colorMutedForeground: colors.mutedForeground,
      colorNeutral: colors.foreground,
      colorBorder: colors.border,
      colorRing: colors.ring,
      colorShadow: isDark ? "#000000" : "#4e160f",
      colorModalBackdrop: isDark ? "rgba(10, 10, 10, 0.78)" : "rgba(26, 23, 20, 0.24)",
      fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
      fontFamilyButtons: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
      borderRadius: "0.5rem",
      spacing: "1rem",
    },
    elements: {
      rootBox: {
        width: "100%",
      },
      cardBox: {
        width: "100%",
      },
      card: {
        width: "100%",
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: "1rem",
        boxShadow: isDark
          ? "0 28px 80px rgba(0, 0, 0, 0.42)"
          : "0 28px 80px rgba(78, 22, 15, 0.10)",
      },
      headerTitle: {
        color: colors.foreground,
        fontSize: "1.5rem",
        fontWeight: "600",
        letterSpacing: "-0.02em",
      },
      headerSubtitle: {
        color: colors.mutedForeground,
      },
      socialButtonsBlockButton: {
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        boxShadow: "none",
      },
      socialButtonsBlockButtonText: {
        color: colors.foreground,
        fontWeight: "500",
      },
      dividerLine: {
        backgroundColor: colors.border,
      },
      dividerText: {
        color: colors.mutedForeground,
        fontSize: "0.75rem",
        fontWeight: "600",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      formFieldLabel: {
        color: colors.foreground,
        fontWeight: "500",
      },
      formFieldInput: {
        minHeight: "2.75rem",
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        boxShadow: "none",
        color: colors.foreground,
      },
      otpCodeFieldInput: {
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        color: colors.foreground,
      },
      formButtonPrimary: {
        minHeight: "2.75rem",
        backgroundColor: colors.primary,
        borderRadius: "0.75rem",
        boxShadow: "none",
        color: colors.primaryForeground,
        fontWeight: "600",
      },
      footerActionLink: {
        color: colors.primary,
        fontWeight: "600",
      },
      formResendCodeLink: {
        color: colors.primary,
        fontWeight: "600",
      },
      logoBox: {
        height: "80px",
        marginBottom: "16px",
      },
      logoImage: {
        height: "80px",
        width: "auto",
      },
    },
  };
}
