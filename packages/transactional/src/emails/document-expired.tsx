import { Section, Text } from "@react-email/components";

import { status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentExpiredProps {
  ownerName: string;
  documentName: string;
  expiredAt: string;
}

export function DocumentExpired({
  ownerName = "User",
  documentName = "Document",
  expiredAt = "January 1, 2026",
}: DocumentExpiredProps) {
  const previewText = `Your document "${documentName}" has expired`;

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Expired"
      footerText="This notification was sent by Seal because a document you own has expired."
    >
      {/* Expired banner */}
      <Section
        style={{
          backgroundColor: status.destructive + "14",
          border: `1px solid ${status.destructive}40`,
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <Text style={{ margin: "0 0 8px 0", fontSize: "32px" }}>&#x23F0;</Text>
        <Text
          style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: status.destructive }}
        >
          Document Expired
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {ownerName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          Your document <strong>&ldquo;{documentName}&rdquo;</strong> expired on{" "}
          <strong>{expiredAt}</strong>. All unsigned recipients have been marked as expired and can
          no longer sign this document.
        </Text>

        <Text style={emailStyles.bodyTextMuted}>
          If you still need signatures, you can re-send the document with a new expiration period
          from your dashboard.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default DocumentExpired;
