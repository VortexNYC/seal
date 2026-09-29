/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Link, Section, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./email-layout.js";

export interface PasswordResetProps {
  recipientName: string;
  resetUrl: string;
}

export function PasswordReset({
  recipientName,
  resetUrl,
}: PasswordResetProps) {
  const greeting = recipientName.trim() ? `Hi ${recipientName},` : "Hi,";

  return (
    <EmailLayout
      preview="Reset your Seal password"
      subtitle="Reset your password"
      footerText="If you did not request a password reset, you can ignore this email."
    >
      <Section>
        <Text style={emailStyles.bodyText}>{greeting}</Text>
        <Text style={emailStyles.bodyTextSpaced}>
          We received a request to reset your password. Click the button below
          to choose a new one.
        </Text>
      </Section>

      <Section style={emailStyles.ctaSection}>
        <Button href={resetUrl} style={emailStyles.ctaButton}>
          Reset password
        </Button>
      </Section>

      <Section>
        <Text style={emailStyles.smallText}>
          If the button doesn&apos;t work, copy and paste this link into your
          browser:
        </Text>
        <Text style={emailStyles.smallText}>
          <Link href={resetUrl} style={{ color: emailStyles.linkColor }}>
            {resetUrl}
          </Link>
        </Text>
        <Text style={emailStyles.bodyTextMuted}>
          This link will expire in a short while for your security.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default PasswordReset;
