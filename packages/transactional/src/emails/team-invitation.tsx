import { Button, Heading, Link, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface TeamInvitationProps {
  inviteeEmail: string;
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresAt?: number;
}

export function TeamInvitation({
  inviteeEmail = "invitee@example.com",
  inviterName = "John Doe",
  inviterEmail = "john@example.com",
  organizationName = "Acme Inc",
  role = "Member",
  inviteUrl = "https://seal.nyc/invite/abc123",
  expiresAt,
}: TeamInvitationProps) {
  const previewText = `${inviterName} invited you to join ${organizationName} on Seal`;
  const expirationDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <EmailLayout
      preview={previewText}
      subtitle="Team Invitation"
      footerText={`This invitation was sent to ${inviteeEmail}. If you don't want to join this team, you can safely ignore this email.`}
    >
      {/* Invitation icon */}
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
            &#x2709;&#xFE0F;
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
          You&apos;ve been invited!
        </Heading>

        <Text style={{ ...emailStyles.bodyTextSpaced, textAlign: "center" }}>
          <strong style={emailStyles.strong}>{inviterName}</strong> (
          <Link
            href={`mailto:${inviterEmail}`}
            style={{ color: status.info, textDecoration: "none" }}
          >
            {inviterEmail}
          </Link>
          ) has invited you to join <strong style={emailStyles.strong}>{organizationName}</strong>{" "}
          on Seal.
        </Text>

        {/* Organization card */}
        <Section style={emailStyles.documentCard}>
          <Text style={{ ...emailStyles.documentTitle, marginBottom: "8px" }}>
            {organizationName}
          </Text>
          <Text style={{ ...emailStyles.documentMeta, marginBottom: "4px" }}>
            Your role: <strong style={emailStyles.strong}>{role}</strong>
          </Text>
          {expirationDate && (
            <Text style={{ ...emailStyles.documentMeta, color: status.destructive }}>
              Invitation expires: {expirationDate}
            </Text>
          )}
        </Section>

        {/* What you'll get */}
        <Section style={{ marginBottom: "24px" }}>
          <Text
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "500",
              color: email.foreground,
            }}
          >
            As a team member, you&apos;ll be able to:
          </Text>
          <Text
            style={{ margin: "0 0 4px 0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}
          >
            &bull; Access shared documents and templates
          </Text>
          <Text
            style={{ margin: "0 0 4px 0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}
          >
            &bull; Collaborate with team members
          </Text>
          <Text style={{ margin: "0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}>
            &bull; Send documents for signature
          </Text>
        </Section>

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={inviteUrl}>
            Accept Invitation
          </Button>
        </Section>

        <Text style={emailStyles.smallText}>Or copy and paste this link into your browser:</Text>
        <Link
          href={inviteUrl}
          style={{ fontSize: "14px", color: emailStyles.linkColor, wordBreak: "break-all" }}
        >
          {inviteUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default TeamInvitation;
