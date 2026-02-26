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

export interface DocumentViewedProps {
  ownerName: string;
  documentName: string;
  documentUrl: string;
  recipientName: string;
  recipientEmail: string;
  viewedAt: number;
}

export function DocumentViewed({
  ownerName = "User",
  documentName = "Document",
  documentUrl = "https://seal.nyc/documents/example",
  recipientName = "Recipient",
  recipientEmail = "recipient@example.com",
  viewedAt = Date.now(),
}: DocumentViewedProps) {
  const previewText = `${recipientName} viewed "${documentName}"`;

  const formattedDate = new Date(viewedAt).toLocaleDateString("en-US", {
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
              <Text className="m-0 text-[14px] text-[#6b7280]">Document Activity</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Info banner */}
            <Section className="mb-[24px] rounded-lg border border-solid border-[#bfdbfe] bg-[#eff6ff] p-[20px] text-center">
              <Text className="m-0 mb-[8px] text-[32px]">👁</Text>
              <Text className="m-0 text-[18px] font-semibold text-[#1e40af]">Document Viewed</Text>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {ownerName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                A recipient has opened your document:
              </Text>

              {/* Details card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[20px]">
                <Text className="m-0 mb-[4px] text-[18px] font-medium text-[#1a1a1a]">
                  {documentName}
                </Text>
                <Hr className="my-[12px] border-[#e5e7eb]" />
                <Text className="m-0 text-[14px] font-medium text-[#1a1a1a]">{recipientName}</Text>
                <Text className="m-0 mt-[2px] text-[12px] text-[#6b7280]">{recipientEmail}</Text>
                <Text className="m-0 mt-[8px] text-[12px] text-[#6b7280]">
                  Viewed on: {formattedDate}
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
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This notification was sent by Seal based on your organization&apos;s notification
                settings. You can disable viewed notifications in Settings &gt; Notifications.
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

export default DocumentViewed;
