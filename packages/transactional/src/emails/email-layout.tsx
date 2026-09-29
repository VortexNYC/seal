/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { containers, email, fonts, status, surfaces, text } from "../styles.js";

/** Hosted from apps/web/public/logo after deploy. */
const SEAL_LOCKUP_URL = "https://app.seal.nyc/logo/seal-lockup-light.png";

const sealEmailBrand = {
  name: "Seal",
  supportEmail: "support@seal.nyc",
  accentColor: email.primary,
  backgroundColor: email.background,
  textColor: email.foreground,
  mutedColor: email.mutedForeground,
  borderColor: email.border,
  fontFamily: fonts.sans,
} as const;

interface EmailLayoutProps {
  preview: string;
  subtitle: string;
  children: ReactNode;
  footerText?: string;
}

export function EmailLayout({
  preview,
  subtitle,
  children,
  footerText,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          ...containers.outer,
          backgroundColor: sealEmailBrand.backgroundColor,
          fontFamily: sealEmailBrand.fontFamily,
        }}
      >
        <Container style={containers.card}>
          <Section style={{ marginBottom: "28px" }}>
            <Img
              src={SEAL_LOCKUP_URL}
              alt="Seal"
              width={140}
              height={36}
              style={{
                display: "block",
                margin: "0 0 20px 0",
                border: "0",
                outline: "none",
                textDecoration: "none",
              }}
            />
            <Heading as="h1" style={text.heading}>
              {subtitle}
            </Heading>
          </Section>
          {children}
          {footerText ? (
            <Text style={surfaces.footer}>{footerText}</Text>
          ) : null}
          <Text style={surfaces.footer}>
            {sealEmailBrand.name} · {sealEmailBrand.supportEmail}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Shared style exports for use across templates
export const emailStyles = {
  /** Primary body text */
  bodyText: {
    color: email.foreground,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px 0",
  },
  /** Secondary/lighter body text */
  bodyTextMuted: {
    color: email.mutedForeground,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px 0",
  },
  /** Large body text with bottom margin */
  bodyTextSpaced: {
    color: email.mutedForeground,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 24px 0",
  },
  /** Small muted text */
  smallText: {
    color: email.mutedForeground,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 16px 0",
  },
  /** Informational small text (no margin) */
  infoText: {
    color: email.mutedForeground,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0",
  },
  /** Bold inline name reference */
  strong: {
    color: email.foreground,
    fontWeight: "600" as const,
  },
  /** Centered CTA row — email clients ignore Tailwind className */
  ctaSection: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  ctaSectionCompact: {
    textAlign: "center" as const,
    margin: "24px 0 0 0",
  },
  ctaSectionTight: {
    textAlign: "center" as const,
    marginTop: "12px",
  },
  /** Primary CTA button */
  ctaButton: {
    backgroundColor: email.primary,
    color: email.primaryForeground,
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "500" as const,
    padding: "14px 32px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  /** Secondary/info CTA — functional status.info, not a brand accent */
  ctaButtonSecondary: {
    backgroundColor: status.info,
    color: status.infoForeground,
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500" as const,
    padding: "10px 24px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  /** Neutral document card */
  documentCard: {
    backgroundColor: email.background,
    border: `1px solid ${email.border}`,
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "24px",
  },
  /** Document title inside card */
  documentTitle: {
    color: email.foreground,
    fontSize: "18px",
    fontWeight: "500" as const,
    margin: "0 0 4px 0",
  },
  /** Document meta text inside card */
  documentMeta: {
    color: email.mutedForeground,
    fontSize: "14px",
    margin: "0",
  },
  /** Warning/message callout box */
  messageBox: {
    borderLeft: `3px solid ${email.warning}`,
    backgroundColor: email.warningSurface,
    padding: "12px 12px 12px 16px",
    marginBottom: "24px",
  },
  /** Link color — brand primary */
  linkColor: email.primary,
} as const;
