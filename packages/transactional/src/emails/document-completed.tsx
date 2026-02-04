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

export function DocumentCompleted({
  senderName = "User",
  documentName = "Document",
  documentUrl = "https://seal.nyc/documents/example",
  completedAt = Date.now(),
  recipientsSummary = [],
}: DocumentCompletedProps) {
  const previewText = `All signatures collected for "${documentName}"`;

  const formattedDate = new Date(completedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getRoleLabel = (role: RecipientSummary["role"]) => {
    switch (role) {
      case "signer":
        return "Signed";
      case "approver":
        return "Approved";
      case "viewer":
        return "Viewed";
    }
  };

  const formatRecipientDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              <Text className="m-0 text-[14px] text-[#6b7280]">Document Complete</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Success banner */}
            <Section className="mb-[24px] rounded-lg border border-solid border-[#bbf7d0] bg-[#f0fdf4] p-[20px] text-center">
              <Text className="m-0 mb-[8px] text-[32px]">✓</Text>
              <Text className="m-0 text-[18px] font-semibold text-[#166534]">
                All Signatures Collected
              </Text>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {senderName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                Great news! All recipients have completed their actions on your document. Here's the
                summary:
              </Text>

              {/* Document card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[20px]">
                <Text className="m-0 mb-[4px] text-[18px] font-medium text-[#1a1a1a]">
                  {documentName}
                </Text>
                <Text className="m-0 text-[14px] text-[#6b7280]">
                  Completed on: {formattedDate}
                </Text>
              </Section>

              {/* Recipients summary */}
              {recipientsSummary.length > 0 && (
                <Section className="mb-[24px]">
                  <Text className="m-0 mb-[12px] text-[14px] font-semibold text-[#1a1a1a]">
                    Recipient Activity:
                  </Text>
                  {recipientsSummary.map((recipient, index) => (
                    <Section
                      key={recipient.email}
                      className={`py-[12px] ${index < recipientsSummary.length - 1 ? "border-b border-solid border-[#e5e7eb]" : ""}`}
                    >
                      <Text className="m-0 text-[14px] font-medium text-[#1a1a1a]">
                        {recipient.name}
                      </Text>
                      <Text className="m-0 mt-[2px] text-[12px] text-[#6b7280]">
                        {recipient.email}
                      </Text>
                      <Text className="m-0 mt-[4px] text-[12px] text-[#059669]">
                        {getRoleLabel(recipient.role)} •{" "}
                        {formatRecipientDate(recipient.completedAt)}
                      </Text>
                    </Section>
                  ))}
                </Section>
              )}

              {/* CTA Button */}
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                  href={documentUrl}
                >
                  View Completed Document
                </Button>
              </Section>

              <Text className="m-0 text-[14px] leading-[22px] text-[#4b5563]">
                The signed document is now available in your Seal dashboard. You can download it at
                any time.
              </Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This notification was sent by Seal. Please keep this email for your records.
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

export default DocumentCompleted;
