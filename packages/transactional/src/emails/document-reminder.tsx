import { Button, Link, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentReminderProps {
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
  reminderCount?: number;
}

export function DocumentReminder({
  recipientName = "Recipient",
  senderName = "Sender",
  documentName = "Document",
  signingUrl = "https://seal.nyc/sign/example",
  customMessage,
  expiresAt,
  reminderCount = 1,
}: DocumentReminderProps) {
  const previewText = `Reminder: "${documentName}" is waiting for your signature`;
  const expirationDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const isUrgent = expiresAt && expiresAt - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const urgentBadgeStyle = {
    display: "inline-block" as const,
    backgroundColor: isUrgent ? status.destructive + "14" : email.warningSurface,
    border: `1px solid ${isUrgent ? status.destructive + "40" : email.warning + "60"}`,
    borderRadius: "9999px",
    padding: "8px 16px",
  };

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Signature Reminder"
      footerText={`This reminder was sent by Seal on behalf of ${senderName}. If you've already signed this document, please disregard this email.`}
    >
      {/* Reminder badge */}
      <Section className="mb-[24px] text-center">
        <div style={urgentBadgeStyle}>
          <Text
            style={{
              margin: "0",
              fontSize: "14px",
              fontWeight: "500",
              color: isUrgent ? status.destructive : email.warning,
            }}
          >
            {isUrgent
              ? `Urgent Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`
              : `Friendly Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`}
          </Text>
        </div>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {recipientName},</Text>

        <Text style={emailStyles.bodyTextMuted}>
          This is a reminder that <strong style={emailStyles.strong}>{senderName}</strong> is
          waiting for your signature on the following document:
        </Text>

        {/* Document card */}
        <Section
          style={{
            ...emailStyles.documentCard,
            ...(isUrgent
              ? {
                  backgroundColor: status.destructive + "08",
                  borderColor: status.destructive + "30",
                }
              : {}),
          }}
        >
          <Text style={emailStyles.documentTitle}>{documentName}</Text>
          {expirationDate && (
            <Text
              style={{
                ...emailStyles.documentMeta,
                color: status.destructive,
                fontWeight: isUrgent ? "500" : undefined,
              }}
            >
              {isUrgent ? "Expires soon: " : "Expires: "}
              {expirationDate}
            </Text>
          )}
        </Section>

        {/* Custom message */}
        {customMessage && (
          <Section style={emailStyles.messageBox}>
            <Text
              style={{
                margin: "0",
                fontSize: "14px",
                color: email.warningText,
                fontStyle: "italic",
              }}
            >
              &ldquo;{customMessage}&rdquo;
            </Text>
            <Text style={{ margin: "4px 0 0 0", fontSize: "12px", color: email.warning }}>
              &mdash; {senderName}
            </Text>
          </Section>
        )}

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={signingUrl}>
            Review & Sign Now
          </Button>
        </Section>

        <Text style={emailStyles.smallText}>Or copy and paste this link into your browser:</Text>
        <Link
          href={signingUrl}
          style={{ fontSize: "14px", color: emailStyles.linkColor, wordBreak: "break-all" }}
        >
          {signingUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default DocumentReminder;
