/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface PaymentDunningProps {
  recipientName: string;
  heading: string;
  message: string;
  urgency: "low" | "medium" | "high";
  paymentUrl?: string;
}

function urgencyColor(urgency: PaymentDunningProps["urgency"]): string {
  if (urgency === "high") {
    return status.destructive;
  }
  if (urgency === "medium") {
    return email.warning;
  }
  return email.mutedForeground;
}

export function PaymentDunning({
  recipientName,
  heading,
  message,
  urgency,
  paymentUrl,
}: PaymentDunningProps) {
  const greeting = recipientName.trim() ? `Hi ${recipientName},` : "Hi,";

  return (
    <EmailLayout
      preview={heading}
      subtitle={heading}
      footerText="If you've already made this payment, please disregard this message."
    >
      <Section>
        <Text
          style={{
            margin: "0 0 16px 0",
            fontSize: "13px",
            fontWeight: "600",
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
            color: urgencyColor(urgency),
          }}
        >
          Payment notice
        </Text>
        <Text style={emailStyles.bodyText}>{greeting}</Text>
        <Text style={emailStyles.bodyTextSpaced}>{message}</Text>
      </Section>

      {paymentUrl ? (
        <Section style={emailStyles.ctaSection}>
          <Button href={paymentUrl} style={emailStyles.ctaButton}>
            Pay now
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}

export default PaymentDunning;
