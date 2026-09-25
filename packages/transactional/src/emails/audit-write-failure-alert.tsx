import { Button, Section, Text } from "@react-email/components";

import { email } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface AuditWriteFailureAlertProps {
  adminName: string;
  organizationName: string;
  organizationSlug: string;
  consecutiveFailures: number;
  lastFailureReason?: string | null;
  settingsUrl: string;
}

export function AuditWriteFailureAlert({
  adminName,
  organizationName,
  consecutiveFailures,
  lastFailureReason,
  settingsUrl,
}: AuditWriteFailureAlertProps) {
  const previewText = `Audit logging failed ${consecutiveFailures} times for ${organizationName}`;

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Audit Health Alert"
      footerText="This alert was sent by Seal because audit log writes failed repeatedly for your workspace."
    >
      <Section
        style={{
          backgroundColor: email.warningSurface,
          border: `1px solid ${email.warning}60`,
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <Text
          style={{
            margin: "0",
            fontSize: "16px",
            fontWeight: "600",
            color: email.warningText,
          }}
        >
          Audit logging is failing
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>Hello {adminName},</Text>

        <Text style={emailStyles.bodyTextSpaced}>
          Seal could not write sealed audit log entries for{" "}
          <strong>{organizationName}</strong>{" "}
          <strong>{consecutiveFailures}</strong> times in a row. Signed
          documents may be missing evidentiary records until this recovers.
        </Text>

        {lastFailureReason ? (
          <Text style={emailStyles.bodyTextSpaced}>
            Last error: <code>{lastFailureReason}</code>
          </Text>
        ) : null}

        <Text style={emailStyles.bodyTextSpaced}>
          Check workspace settings and contact support if failures continue.
          Successful audit writes clear this alert automatically.
        </Text>
      </Section>

      <Section style={{ textAlign: "center", marginTop: "8px" }}>
        <Button href={settingsUrl} style={emailStyles.ctaButton}>
          Open audit log
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default AuditWriteFailureAlert;
