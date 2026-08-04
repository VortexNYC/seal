/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Heading, Link, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface DocumentSharedProps {
  recipientEmail: string;
  recipientName: string;
  sharerName: string;
  sharerEmail: string;
  documentName: string;
  permissionLevel: "view" | "edit" | "manage";
  documentUrl: string;
}

const permissionDescriptions = {
  view: "You can view this document",
  edit: "You can view and edit this document",
  manage: "You have full access to manage this document",
};

const permissionLabels = {
  view: "View",
  edit: "Edit",
  manage: "Manage",
};

export function DocumentShared({
  recipientEmail = "recipient@example.com",
  recipientName = "John",
  sharerName = "Jane Doe",
  sharerEmail = "jane@example.com",
  documentName = "Employment Agreement",
  permissionLevel = "view",
  documentUrl = "https://seal.nyc/documents/abc123",
}: DocumentSharedProps) {
  const previewText = `${sharerName} shared "${documentName}" with you on Seal`;

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Document Shared"
      footerText={`This email was sent to ${recipientEmail} because a document was shared with you. If you believe this was sent in error, you can safely ignore this email.`}
    >
      {/* Sharing icon */}
      <Section className="mb-[24px] text-center">
        <div
          style={{
            width: "64px",
            height: "64px",
            backgroundColor: status.infoSurface,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ margin: "0", fontSize: "32px", lineHeight: "64px" }}>
            &#x1F4C4;
          </Text>
        </div>
      </Section>

      <Section>
        <Heading
          style={{
            margin: "0 0 16px 0",
            textAlign: "center",
            fontSize: "22px",
            fontWeight: "600",
            color: email.foreground,
          }}
        >
          A document was shared with you
        </Heading>

        <Text style={{ ...emailStyles.bodyTextSpaced, textAlign: "center" }}>
          Hi {recipientName},
        </Text>

        <Text style={{ ...emailStyles.bodyTextSpaced, textAlign: "center" }}>
          <strong style={emailStyles.strong}>{sharerName}</strong> (
          <Link
            href={`mailto:${sharerEmail}`}
            style={{ color: status.info, textDecoration: "none" }}
          >
            {sharerEmail}
          </Link>
          ) has shared a document with you on Seal.
        </Text>

        {/* Document card */}
        <Section style={emailStyles.documentCard}>
          <Text style={{ ...emailStyles.documentTitle, marginBottom: "8px" }}>
            {documentName}
          </Text>
          <Text style={{ ...emailStyles.documentMeta, marginBottom: "4px" }}>
            Your access level:{" "}
            <strong style={emailStyles.strong}>
              {permissionLabels[permissionLevel]}
            </strong>
          </Text>
          <Text style={{ ...emailStyles.documentMeta, color: "#6b6560" }}>
            {permissionDescriptions[permissionLevel]}
          </Text>
        </Section>

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={documentUrl}>
            View Document
          </Button>
        </Section>

        <Text style={emailStyles.smallText}>
          Or copy and paste this link into your browser:
        </Text>
        <Link
          href={documentUrl}
          style={{
            fontSize: "14px",
            color: emailStyles.linkColor,
            wordBreak: "break-all",
          }}
        >
          {documentUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default DocumentShared;
