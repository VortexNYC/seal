import { Button, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

interface RecipientSummary {
  name: string;
  email: string;
  role: "signer" | "approver" | "viewer";
  completedAt: number;
}

export interface DocumentCompletedProps {
  senderName: string;
  documentName: string;
  documentUrl: string;
  completedAt: number;
  recipientsSummary: RecipientSummary[];
}

function formatCompletedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRoleLabel(role: RecipientSummary["role"]): string {
  switch (role) {
    case "signer":
      return "Signed";
    case "approver":
      return "Approved";
    case "viewer":
      return "Viewed";
  }
}

function formatRecipientDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SuccessBanner() {
  return (
    <Section
      style={{
        backgroundColor: status.successSurface,
        border: `1px solid #6ee7b7`,
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "24px",
        textAlign: "center",
      }}
    >
      <Text style={{ margin: "0 0 8px 0", fontSize: "32px" }}>&#x2713;</Text>
      <Text style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: status.success }}>
        All Signatures Collected
      </Text>
    </Section>
  );
}

function RecipientActivitySection({
  recipientsSummary,
}: Pick<DocumentCompletedProps, "recipientsSummary">) {
  if (recipientsSummary.length === 0) {
    return null;
  }

  return (
    <Section style={{ marginBottom: "24px" }}>
      <Text
        style={{
          margin: "0 0 12px 0",
          fontSize: "14px",
          fontWeight: "600",
          color: email.foreground,
        }}
      >
        Recipient Activity:
      </Text>
      {recipientsSummary.map((recipient, index) => (
        <Section
          key={recipient.email}
          style={{
            padding: "12px 0",
            borderBottom:
              index < recipientsSummary.length - 1 ? `1px solid ${email.border}` : undefined,
          }}
        >
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
          <Text style={{ margin: "2px 0 0 0", fontSize: "12px", color: email.mutedForeground }}>
            {recipient.email}
          </Text>
          <Text style={{ margin: "4px 0 0 0", fontSize: "12px", color: status.success }}>
            {getRoleLabel(recipient.role)} &bull; {formatRecipientDate(recipient.completedAt)}
          </Text>
        </Section>
      ))}
    </Section>
  );
}

export function DocumentCompleted({
  senderName = "User",
  documentName = "Document",
  documentUrl = "https://seal.nyc/documents/example",
  completedAt = Date.now(),
  recipientsSummary = [],
}: DocumentCompletedProps) {
  const previewText = `All signatures collected for "${documentName}"`;
  const formattedDate = formatCompletedDate(completedAt);

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Complete"
      footerText="This notification was sent by Seal. Please keep this email for your records."
    >
      <SuccessBanner />

      <Section>
        <Text style={emailStyles.bodyText}>Hello {senderName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          Great news! All recipients have completed their actions on your document. Here&apos;s the
          summary:
        </Text>

        {/* Document card */}
        <Section style={emailStyles.documentCard}>
          <Text style={emailStyles.documentTitle}>{documentName}</Text>
          <Text style={emailStyles.documentMeta}>Completed on: {formattedDate}</Text>
        </Section>

        <RecipientActivitySection recipientsSummary={recipientsSummary} />

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={documentUrl}>
            View Completed Document
          </Button>
        </Section>

        <Text style={emailStyles.infoText}>
          The signed document is now available in your Seal dashboard. You can download it at any
          time.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default DocumentCompleted;
