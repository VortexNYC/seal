/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Link, Section, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./email-layout.js";

export interface EmailVerificationProps {
  recipientName: string;
  verificationUrl: string;
}

export function EmailVerification({
  recipientName,
  verificationUrl,
}: EmailVerificationProps) {
  const greeting = recipientName.trim() ? `Hi ${recipientName},` : "Hi,";

  return (
    <EmailLayout
      preview="Verify your Seal email address"
      subtitle="Verify your email"
      footerText="If you did not create a Seal account, you can ignore this email."
    >
      <Section>
        <Text style={emailStyles.bodyText}>{greeting}</Text>
        <Text style={emailStyles.bodyTextSpaced}>
          Confirm this email address to finish setting up your Seal account.
          Click the button below to verify it.
        </Text>
      </Section>

      <Section style={emailStyles.ctaSection}>
        <Button href={verificationUrl} style={emailStyles.ctaButton}>
          Verify email
        </Button>
      </Section>

      <Section>
        <Text style={emailStyles.smallText}>
          If the button doesn&apos;t work, copy and paste this link into your
          browser:
        </Text>
        <Text style={emailStyles.smallText}>
          <Link href={verificationUrl} style={{ color: emailStyles.linkColor }}>
            {verificationUrl}
          </Link>
        </Text>
        <Text style={emailStyles.bodyTextMuted}>
          This link will expire in a short while for your security.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default EmailVerification;
