import { Button, Hr, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentViewedProps {
  ownerName: string;
  documentName: string;
  documentUrl: string;
  recipientName: string;
  recipientEmail: string;
  viewedAt: number;
}

export function DocumentViewed({
  ownerName = "User",
  documentName = "Document",
  documentUrl = "https://seal.nyc/documents/example",
  recipientName = "Recipient",
  recipientEmail = "recipient@example.com",
  viewedAt = Date.now(),
}: DocumentViewedProps) {
  const previewText = `${recipientName} viewed "${documentName}"`;

  const formattedDate = new Date(viewedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Activity"
      footerText="This notification was sent by Seal based on your organization's notification settings. You can disable viewed notifications in Settings > Notifications."
    >
      {/* Info banner */}
      <Section
        style={{
          backgroundColor: status.infoSurface,
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <Text style={{ margin: "0 0 8px 0", fontSize: "32px" }}>&#x1F441;</Text>
        <Text
          style={{
            margin: "0",
            fontSize: "18px",
            fontWeight: "600",
            color: status.info,
          }}
        >
          Document Viewed
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {ownerName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          A recipient has opened your document:
        </Text>

        {/* Details card */}
        <Section style={emailStyles.documentCard}>
          <Text style={{ ...emailStyles.documentTitle, marginBottom: "4px" }}>
            {documentName}
          </Text>
          <Hr style={{ borderColor: email.border, margin: "12px 0" }} />
          <Text
            style={{
              margin: "0",
              fontSize: "14px",
              fontWeight: "500",
              color: email.foreground,
            }}
          >
            {recipientName}
          </Text>
          <Text
            style={{
              margin: "2px 0 0 0",
              fontSize: "12px",
              color: email.mutedForeground,
            }}
          >
            {recipientEmail}
          </Text>
          <Text
            style={{
              margin: "8px 0 0 0",
              fontSize: "12px",
              color: email.mutedForeground,
            }}
          >
            Viewed on: {formattedDate}
          </Text>
        </Section>

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={documentUrl}>
            View Document
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default DocumentViewed;
