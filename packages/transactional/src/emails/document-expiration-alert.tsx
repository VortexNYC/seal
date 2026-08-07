import { Button, Section, Text } from "@react-email/components";

import { email } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentExpirationAlertProps {
  ownerName: string;
  documentName: string;
  documentUrl: string;
  expiresAt: number;
  daysRemaining: number;
  pendingRecipients: Array<{
    name: string;
    email: string;
  }>;
}

export function DocumentExpirationAlert({
  ownerName,
  documentName,
  documentUrl,
  expiresAt,
  daysRemaining,
  pendingRecipients,
}: DocumentExpirationAlertProps) {
  const previewText = `"${documentName}" expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  const formattedExpiry = new Date(expiresAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Expiration Alert"
      footerText="This notification was sent by Seal based on your organization's notification settings."
    >
      {/* Warning banner */}
      <Section
        style={{
          backgroundColor: email.warningSurface,
          border: `1px solid ${email.warning}60`,
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <Text style={{ margin: "0 0 8px 0", fontSize: "32px" }}>&#x23F0;</Text>
        <Text
          style={{
            margin: "0",
            fontSize: "18px",
            fontWeight: "600",
            color: email.warning,
          }}
        >
          Expires in {daysRemaining} Day{daysRemaining === 1 ? "" : "s"}
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {ownerName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          Your document <strong>&ldquo;{documentName}&rdquo;</strong> has a
          deadline approaching on <strong>{formattedExpiry}</strong> and still
          has pending signatures.
        </Text>

        {/* Pending recipients */}
        {pendingRecipients.length > 0 && (
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: email.foreground,
              }}
            >
              Still waiting on:
            </Text>
            {pendingRecipients.map((recipient) => (
              <Section key={recipient.email} style={{ padding: "8px 0" }}>
                <Text
                  style={{
                    margin: "0",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: email.foreground,
                  }}
                >
                  {recipient.name}
                </Text>
                <Text
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "12px",
                    color: email.mutedForeground,
                  }}
                >
                  {recipient.email}
                </Text>
              </Section>
            ))}
          </Section>
        )}

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={documentUrl}>
            View Document
          </Button>
        </Section>

        <Text style={emailStyles.infoText}>
          You can send a manual reminder to pending recipients from the document
          page, or extend the deadline if more time is needed.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default DocumentExpirationAlert;
