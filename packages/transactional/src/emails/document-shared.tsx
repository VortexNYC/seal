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
              <Text className="m-0 text-[14px] text-[#6b7280]">Document Shared</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Sharing icon */}
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
                  📄
                </Text>
              </div>
            </Section>

            {/* Main content */}
            <Section>
              <Heading className="m-0 mb-[16px] text-center text-[22px] font-semibold text-[#1a1a1a]">
                A document was shared with you
              </Heading>

              <Text className="m-0 mb-[24px] text-center text-[16px] leading-[26px] text-[#4b5563]">
                Hi {recipientName},
              </Text>

              <Text className="m-0 mb-[24px] text-center text-[16px] leading-[26px] text-[#4b5563]">
                <strong className="text-[#1a1a1a]">{sharerName}</strong> (
                <Link href={`mailto:${sharerEmail}`} className="text-[#2563eb] no-underline">
                  {sharerEmail}
                </Link>
                ) has shared a document with you on Seal.
              </Text>

              {/* Document card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[20px]">
                <Text className="m-0 mb-[8px] text-[18px] font-medium text-[#1a1a1a]">
                  {documentName}
                </Text>
                <Text className="m-0 mb-[4px] text-[14px] text-[#6b7280]">
                  Your access level:{" "}
                  <strong className="text-[#1a1a1a]">{permissionLabels[permissionLevel]}</strong>
                </Text>
                <Text className="m-0 text-[14px] text-[#4b5563]">
                  {permissionDescriptions[permissionLevel]}
                </Text>
              </Section>

              {/* CTA Button */}
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                  href={documentUrl}
                >
                  View Document
                </Button>
              </Section>

              <Text className="m-0 mb-[16px] text-[14px] leading-[22px] text-[#6b7280]">
                Or copy and paste this link into your browser:
              </Text>
              <Link href={documentUrl} className="text-[14px] break-all text-[#2563eb]">
                {documentUrl}
              </Link>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This email was sent to {recipientEmail} because a document was shared with you. If
                you believe this was sent in error, you can safely ignore this email.
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

export default DocumentShared;
