/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Hr, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentEsignOptOutProps {
  ownerName: string;
  documentName: string;
  documentUrl: string;
  recipientName: string;
  recipientEmail: string;
  methodLabel: string;
  optedOutAt: number;
}

export function DocumentEsignOptOut({
  ownerName,
  documentName,
  documentUrl,
  recipientName,
  recipientEmail,
  methodLabel,
  optedOutAt,
}: DocumentEsignOptOutProps) {
  const previewText = `${recipientName} opted out of e-sign for "${documentName}"`;

  const formattedDate = new Date(optedOutAt).toLocaleDateString("en-US", {
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
      subtitle="ESIGN opt-out"
      footerText="A recipient declined electronic signatures and requested a manual or paper signing path. Complete the transaction offline, then update the envelope in Seal."
    >
      <Section
        style={{
          backgroundColor: status.warningSurface,
          border: `1px solid ${email.warning}`,
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            margin: "0",
            fontSize: "18px",
            fontWeight: "600",
            color: status.warning,
          }}
        >
          Manual signature requested
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {ownerName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          A recipient opted out of electronic signatures on your document and
          needs a non-electronic path:
        </Text>

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
            Request: {methodLabel}
          </Text>
          <Text
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: email.mutedForeground,
            }}
          >
            Recorded on: {formattedDate}
          </Text>
        </Section>

        <Text style={emailStyles.bodyTextSpaced}>
          Next step: send a paper copy or arrange wet-ink signing, collect the
          signed original, then mark the recipient or envelope complete in Seal.
        </Text>

        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={documentUrl}>
            Open Document
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default DocumentEsignOptOut;
