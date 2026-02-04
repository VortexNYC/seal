import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface SigningCompleteProps {
  recipientName: string;
  documentName: string;
  signedAt: number;
  role: "signer" | "approver" | "viewer";
  downloadUrl?: string;
}

export function SigningComplete({
  recipientName = "Recipient",
  documentName = "Document",
  signedAt = Date.now(),
  role = "signer",
  downloadUrl,
}: SigningCompleteProps) {
  const actionText = role === "signer" ? "signed" : role === "approver" ? "approved" : "viewed";
  const actionPastTense =
    role === "signer" ? "signature" : role === "approver" ? "approval" : "review";
  const previewText = `You have successfully ${actionText} "${documentName}"`;

  const formattedDate = new Date(signedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
              <Text className="m-0 text-[14px] text-[#6b7280]">
                {actionPastTense.charAt(0).toUpperCase() + actionPastTense.slice(1)} Confirmation
              </Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Success icon */}
            <Section className="mb-[24px] text-center">
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#dcfce7",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="m-0 text-[32px]" style={{ lineHeight: "64px" }}>
                  ✓
                </Text>
              </div>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {recipientName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                You have successfully <strong>{actionText}</strong> the following document:
              </Text>

              {/* Document card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#bbf7d0] bg-[#f0fdf4] p-[20px]">
                <Text className="m-0 mb-[8px] text-[18px] font-medium text-[#166534]">
                  {documentName}
                </Text>
                <Text className="m-0 text-[14px] text-[#15803d]">
                  {actionPastTense.charAt(0).toUpperCase() + actionPastTense.slice(1)} on:{" "}
                  {formattedDate}
                </Text>
              </Section>

              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#4b5563]">
                A copy of this document has been saved for your records. You will receive another
                email when all parties have completed signing.
              </Text>

              {/* Download button if available */}
              {downloadUrl && (
                <Section className="my-[32px] text-center">
                  <Button
                    className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                    href={downloadUrl}
                  >
                    Download Document
                  </Button>
                </Section>
              )}
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This confirmation was sent by Seal. Please keep this email for your records.
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

export default SigningComplete;
