import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./email-layout.js";

export interface OwnershipTransferredProps {
  newOwnerName: string;
  documentName: string;
  documentUrl: string;
  transferredAt: number;
}

export function OwnershipTransferred({
  newOwnerName = "User",
  documentName = "Document",
  documentUrl = "https://app.seal.so/documents/example",
  transferredAt = Date.now(),
}: OwnershipTransferredProps) {
  const previewText = `You are now the owner of "${documentName}"`;

  const formattedDate = new Date(transferredAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Ownership Transfer"
      footerText="This notification was sent by Seal. If you have questions, contact your organization admin."
    >
      <Section>
        <Text style={emailStyles.bodyText}>Hello {newOwnerName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          You are now the owner of the following document:
        </Text>

        {/* Document card */}
        <Section style={emailStyles.documentCard}>
          <Text style={emailStyles.documentTitle}>{documentName}</Text>
          <Text style={emailStyles.documentMeta}>Transferred on: {formattedDate}</Text>
        </Section>

        <Text style={{ ...emailStyles.infoText, marginBottom: "24px" }}>
          As the new owner, you have full control over this document including editing, sharing, and
          managing recipients.
        </Text>

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

export default OwnershipTransferred;
