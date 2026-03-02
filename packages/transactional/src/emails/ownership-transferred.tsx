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
              <Text className="m-0 text-[14px] text-[#6b7280]">Document Ownership Transfer</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {newOwnerName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                You are now the owner of the following document:
              </Text>

              {/* Document card */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[20px]">
                <Text className="m-0 mb-[4px] text-[18px] font-medium text-[#1a1a1a]">
                  {documentName}
                </Text>
                <Text className="m-0 text-[14px] text-[#6b7280]">
                  Transferred on: {formattedDate}
                </Text>
              </Section>

              <Text className="m-0 mb-[24px] text-[14px] leading-[22px] text-[#4b5563]">
                As the new owner, you have full control over this document including editing,
                sharing, and managing recipients.
              </Text>

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
                This notification was sent by Seal. If you have questions, contact your organization
                admin.
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

export default OwnershipTransferred;
