import {
  Body,
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

export interface DocumentExpiredProps {
  ownerName: string;
  documentName: string;
  expiredAt: string;
}

export function DocumentExpired({
  ownerName = "User",
  documentName = "Document",
  expiredAt = "January 1, 2026",
}: DocumentExpiredProps) {
  const previewText = `Your document "${documentName}" has expired`;

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
              <Text className="m-0 text-[14px] text-[#6b7280]">Document Expired</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Expired banner */}
            <Section className="mb-[24px] rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2] p-[20px] text-center">
              <Text className="m-0 mb-[8px] text-[32px]">&#x23F0;</Text>
              <Text className="m-0 text-[18px] font-semibold text-[#991b1b]">Document Expired</Text>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {ownerName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                Your document <strong>&ldquo;{documentName}&rdquo;</strong> expired on{" "}
                <strong>{expiredAt}</strong>. All unsigned recipients have been marked as expired
                and can no longer sign this document.
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                If you still need signatures, you can re-send the document with a new expiration
                period from your dashboard.
              </Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This notification was sent by Seal because a document you own has expired.
              </Text>
              <Text className="m-0 mt-[12px] text-[12px] leading-[20px] text-[#9ca3af]">
                &copy; {new Date().getFullYear()} Seal. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default DocumentExpired;
