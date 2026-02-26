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

export interface DocumentExpirationAlertProps {
  ownerName: string;
  documentName: string;
  documentUrl: string;
  expiresAt: number;
  daysRemaining: number;
  pendingRecipients: Array<{
    name: string;
    email: string;
  }>;
}

export function DocumentExpirationAlert({
  ownerName = "User",
  documentName = "Document",
  documentUrl = "https://seal.nyc/documents/example",
  expiresAt = Date.now() + 3 * 24 * 60 * 60 * 1000,
  daysRemaining = 3,
  pendingRecipients = [],
}: DocumentExpirationAlertProps) {
  const previewText = `"${documentName}" expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  const formattedExpiry = new Date(expiresAt).toLocaleDateString("en-US", {
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
              <Text className="m-0 text-[14px] text-[#6b7280]">Expiration Alert</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Warning banner */}
            <Section className="mb-[24px] rounded-lg border border-solid border-[#fde68a] bg-[#fffbeb] p-[20px] text-center">
              <Text className="m-0 mb-[8px] text-[32px]">⏰</Text>
              <Text className="m-0 text-[18px] font-semibold text-[#92400e]">
                Expires in {daysRemaining} Day{daysRemaining === 1 ? "" : "s"}
              </Text>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {ownerName},
              </Text>

              <Text className="m-0 mb-[24px] text-[16px] leading-[26px] text-[#4b5563]">
                Your document <strong>&ldquo;{documentName}&rdquo;</strong> has a deadline
                approaching on <strong>{formattedExpiry}</strong> and still has pending signatures.
              </Text>

              {/* Pending recipients */}
              {pendingRecipients.length > 0 && (
                <Section className="mb-[24px]">
                  <Text className="m-0 mb-[12px] text-[14px] font-semibold text-[#1a1a1a]">
                    Still waiting on:
                  </Text>
                  {pendingRecipients.map((recipient) => (
                    <Section key={recipient.email} className="py-[8px]">
                      <Text className="m-0 text-[14px] font-medium text-[#1a1a1a]">
                        {recipient.name}
                      </Text>
                      <Text className="m-0 mt-[2px] text-[12px] text-[#6b7280]">
                        {recipient.email}
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
                  View Document
                </Button>
              </Section>

              <Text className="m-0 text-[14px] leading-[22px] text-[#4b5563]">
                You can send a manual reminder to pending recipients from the document page, or
                extend the deadline if more time is needed.
              </Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This notification was sent by Seal based on your organization&apos;s notification
                settings.
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

export default DocumentExpirationAlert;
