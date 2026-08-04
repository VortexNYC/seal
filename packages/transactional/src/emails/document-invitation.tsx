/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Link, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentInvitationProps {
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
  invoiceUrl?: string;
  invoiceAmount?: number;
  invoiceCurrency?: string;
}

function formatExpirationDate(expiresAt?: number): string | null {
  return expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

function formatInvoiceAmount(
  invoiceAmount?: number,
  invoiceCurrency?: string
): string | null {
  return invoiceAmount && invoiceCurrency
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: invoiceCurrency.toUpperCase(),
      }).format(invoiceAmount / 100)
    : null;
}

function CustomMessageSection({
  customMessage,
  senderName,
}: Pick<DocumentInvitationProps, "customMessage" | "senderName">) {
  if (!customMessage) {
    return null;
  }

  return (
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
      <Text
        style={{ margin: "4px 0 0 0", fontSize: "12px", color: email.warning }}
      >
        &mdash; {senderName}
      </Text>
    </Section>
  );
}

function InvoiceSection({
  invoiceUrl,
  invoiceAmountFormatted,
}: {
  invoiceUrl?: string;
  invoiceAmountFormatted: string | null;
}) {
  if (!invoiceUrl) {
    return null;
  }

  return (
    <Section
      style={{
        backgroundColor: status.infoSurface,
        border: `1px solid #bfdbfe`,
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "24px",
      }}
    >
      <Text
        style={{
          margin: "0",
          fontSize: "14px",
          fontWeight: "600",
          color: "#1e3a8a",
        }}
      >
        Invoice attached
      </Text>
      <Text style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#1e40af" }}>
        {invoiceAmountFormatted
          ? `Amount due: ${invoiceAmountFormatted}`
          : "Please review and pay the invoice before signing."}
      </Text>
      <Section className="mt-[12px] text-center">
        <Button style={emailStyles.ctaButtonSecondary} href={invoiceUrl}>
          Review Invoice
        </Button>
      </Section>
      <Text
        style={{
          margin: "10px 0 0 0",
          fontSize: "12px",
          color: email.mutedForeground,
        }}
      >
        Or open this link:{" "}
        <Link
          href={invoiceUrl}
          style={{ color: "#2563eb", wordBreak: "break-all" }}
        >
          {invoiceUrl}
        </Link>
      </Text>
    </Section>
  );
}

export function DocumentInvitation({
  recipientName = "Recipient",
  senderName = "Sender",
  documentName = "Document",
  signingUrl = "https://seal.nyc/sign/example",
  customMessage,
  expiresAt,
  invoiceUrl,
  invoiceAmount,
  invoiceCurrency,
}: DocumentInvitationProps) {
  const previewText = invoiceUrl
    ? `${senderName} sent you "${documentName}" with an invoice`
    : `${senderName} sent you "${documentName}" to sign`;
  const expirationDate = formatExpirationDate(expiresAt);
  const invoiceAmountFormatted = formatInvoiceAmount(
    invoiceAmount,
    invoiceCurrency
  );

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Signature Request"
      footerText={`This email was sent by Seal on behalf of ${senderName}. If you didn't expect this email, you can safely ignore it.`}
    >
      <Section>
        <Text style={emailStyles.bodyText}>Hello {recipientName},</Text>

        <Text style={emailStyles.bodyTextMuted}>
          <strong style={emailStyles.strong}>{senderName}</strong> has sent you
          a document to sign:
        </Text>

        {/* Document card */}
        <Section style={emailStyles.documentCard}>
          <Text style={emailStyles.documentTitle}>{documentName}</Text>
          {expirationDate && (
            <Text
              style={{ ...emailStyles.documentMeta, color: status.destructive }}
            >
              Expires: {expirationDate}
            </Text>
          )}
        </Section>

        <CustomMessageSection
          customMessage={customMessage}
          senderName={senderName}
        />

        <InvoiceSection
          invoiceUrl={invoiceUrl}
          invoiceAmountFormatted={invoiceAmountFormatted}
        />

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={signingUrl}>
            Review & Sign Document
          </Button>
        </Section>

        <Text style={emailStyles.smallText}>
          Or copy and paste this link into your browser:
        </Text>
        <Link
          href={signingUrl}
          style={{
            fontSize: "14px",
            color: emailStyles.linkColor,
            wordBreak: "break-all",
          }}
        >
          {signingUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default DocumentInvitation;
