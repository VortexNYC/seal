import { Button, Section, Text } from "@react-email/components";

import { status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface SigningCompleteProps {
  recipientName: string;
  documentName: string;
  signedAt: number;
  role: "signer" | "approver" | "viewer";
  downloadUrl?: string;
}

export function SigningComplete({
  recipientName = "Recipient",
  documentName = "Document",
  signedAt = Date.now(),
  role = "signer",
  downloadUrl,
}: SigningCompleteProps) {
  const actionText = role === "signer" ? "signed" : role === "approver" ? "approved" : "viewed";
  const actionPastTense =
    role === "signer" ? "signature" : role === "approver" ? "approval" : "review";
  const previewText = `You have successfully ${actionText} "${documentName}"`;

  const formattedDate = new Date(signedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const capitalizedAction = actionPastTense.charAt(0).toUpperCase() + actionPastTense.slice(1);

  return (
    <EmailLayout
      preview={previewText}
      subtitle={`${capitalizedAction} Confirmation`}
      footerText="This confirmation was sent by Seal. Please keep this email for your records."
    >
      {/* Success icon */}
      <Section className="mb-[24px] text-center">
        <div
          style={{
            width: "64px",
            height: "64px",
            backgroundColor: status.successSurface,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ margin: "0", fontSize: "32px", lineHeight: "64px", color: status.success }}
          >
            &#x2713;
          </Text>
        </div>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {recipientName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          You have successfully <strong>{actionText}</strong> the following document:
        </Text>

        {/* Document card — success variant */}
        <Section
          style={{
            backgroundColor: status.successSurface,
            border: `1px solid #6ee7b7`,
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <Text
            style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              fontWeight: "500",
              color: status.success,
            }}
          >
            {documentName}
          </Text>
          <Text style={{ margin: "0", fontSize: "14px", color: "#15803d" }}>
            {capitalizedAction} on: {formattedDate}
          </Text>
        </Section>

        <Text style={emailStyles.bodyTextMuted}>
          A copy of this document has been saved for your records. You will receive another email
          when all parties have completed signing.
        </Text>

        {/* Download button if available */}
        {downloadUrl && (
          <Section className="my-[32px] text-center">
            <Button style={emailStyles.ctaButton} href={downloadUrl}>
              Download Document
            </Button>
          </Section>
        )}
      </Section>
    </EmailLayout>
  );
}

export default SigningComplete;
