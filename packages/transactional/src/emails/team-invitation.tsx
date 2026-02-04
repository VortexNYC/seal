import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

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
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#f6f9fc] py-[40px] font-sans">
          <Container className="mx-auto my-[40px] w-[520px] rounded-lg border border-solid border-[#e6ebf1] bg-white p-[40px]">
            {/* Header */}
            <Section className="text-center">
              <Heading className="m-0 mb-[8px] text-[28px] font-semibold text-[#1a1a1a]">
                Seal
              </Heading>
              <Text className="m-0 text-[14px] text-[#6b7280]">Team Invitation</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Invitation icon */}
            <Section className="mb-[24px] text-center">
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="m-0 text-[32px]" style={{ lineHeight: "64px" }}>
                  ✉️
                </Text>
              </div>
            </Section>

            {/* Main content */}
            <Section>
              <Heading className="m-0 mb-[16px] text-center text-[22px] font-semibold text-[#1a1a1a]">
                You've been invited!
              </Heading>

              <Text className="m-0 mb-[24px] text-center text-[16px] leading-[26px] text-[#4b5563]">
                <strong className="text-[#1a1a1a]">{inviterName}</strong> (
                <Link href={`mailto:${inviterEmail}`} className="text-[#2563eb] no-underline">
                  {inviterEmail}
                </Link>
                ) has invited you to join{" "}
                <strong className="text-[#1a1a1a]">{organizationName}</strong> on Seal.
              </Text>

              {/* Organization card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[20px]">
                <Text className="m-0 mb-[8px] text-[18px] font-medium text-[#1a1a1a]">
                  {organizationName}
                </Text>
                <Text className="m-0 mb-[4px] text-[14px] text-[#6b7280]">
                  Your role: <strong className="text-[#1a1a1a]">{role}</strong>
                </Text>
                {expirationDate && (
                  <Text className="m-0 text-[14px] text-[#ef4444]">
                    Invitation expires: {expirationDate}
                  </Text>
                )}
              </Section>

              {/* What you'll get */}
              <Section className="mb-[24px]">
                <Text className="m-0 mb-[12px] text-[14px] font-medium text-[#1a1a1a]">
                  As a team member, you'll be able to:
                </Text>
                <Text className="m-0 mb-[4px] text-[14px] leading-[24px] text-[#4b5563]">
                  • Access shared documents and templates
                </Text>
                <Text className="m-0 mb-[4px] text-[14px] leading-[24px] text-[#4b5563]">
                  • Collaborate with team members
                </Text>
                <Text className="m-0 text-[14px] leading-[24px] text-[#4b5563]">
                  • Send documents for signature
                </Text>
              </Section>

              {/* CTA Button */}
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                  href={inviteUrl}
                >
                  Accept Invitation
                </Button>
              </Section>

              <Text className="m-0 mb-[16px] text-[14px] leading-[22px] text-[#6b7280]">
                Or copy and paste this link into your browser:
              </Text>
              <Link href={inviteUrl} className="text-[14px] break-all text-[#2563eb]">
                {inviteUrl}
              </Link>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This invitation was sent to {inviteeEmail}. If you don't want to join this team, you
                can safely ignore this email.
              </Text>
              <Text className="m-0 mt-[12px] text-[12px] leading-[20px] text-[#9ca3af]">
                © {new Date().getFullYear()} Seal. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default TeamInvitation;
