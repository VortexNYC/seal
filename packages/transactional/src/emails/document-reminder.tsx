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

export interface DocumentReminderProps {
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
  reminderCount?: number;
}

export function DocumentReminder({
  recipientName = "Recipient",
  senderName = "Sender",
  documentName = "Document",
  signingUrl = "https://seal.nyc/sign/example",
  customMessage,
  expiresAt,
  reminderCount = 1,
}: DocumentReminderProps) {
  const previewText = `Reminder: "${documentName}" is waiting for your signature`;
  const expirationDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const isUrgent = expiresAt && expiresAt - Date.now() < 3 * 24 * 60 * 60 * 1000; // Less than 3 days

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
              <Text className="m-0 text-[14px] text-[#6b7280]">Signature Reminder</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Reminder badge */}
            <Section className="mb-[24px] text-center">
              <div
                style={{
                  display: "inline-block",
                  backgroundColor: isUrgent ? "#fef2f2" : "#fefce8",
                  border: `1px solid ${isUrgent ? "#fecaca" : "#fde68a"}`,
                  borderRadius: "9999px",
                  padding: "8px 16px",
                }}
              >
                <Text
                  className={`m-0 text-[14px] font-medium ${isUrgent ? "text-[#dc2626]" : "text-[#ca8a04]"}`}
                >
                  {isUrgent
                    ? `⚠️ Urgent Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`
                    : `📬 Friendly Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`}
                </Text>
              </div>
            </Section>

            {/* Main content */}
            <Section>
              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#1a1a1a]">
                Hello {recipientName},
              </Text>

              <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-[#4b5563]">
                This is a reminder that <strong className="text-[#1a1a1a]">{senderName}</strong> is
                waiting for your signature on the following document:
              </Text>

              {/* Document card */}
              <Section
                className={`mb-[24px] rounded-lg border border-solid p-[20px] ${isUrgent ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#e5e7eb] bg-[#f9fafb]"}`}
              >
                <Text className="m-0 mb-[4px] text-[18px] font-medium text-[#1a1a1a]">
                  {documentName}
                </Text>
                {expirationDate && (
                  <Text
                    className={`m-0 text-[14px] ${isUrgent ? "font-medium text-[#dc2626]" : "text-[#ef4444]"}`}
                  >
                    {isUrgent ? "⏰ Expires soon: " : "Expires: "}
                    {expirationDate}
                  </Text>
                )}
              </Section>

              {/* Custom message */}
              {customMessage && (
                <Section className="mb-[24px] border-l-4 border-solid border-[#eab308] bg-[#fefce8] py-[12px] pr-[12px] pl-[16px]">
                  <Text className="m-0 text-[14px] text-[#713f12] italic">"{customMessage}"</Text>
                  <Text className="m-0 mt-[4px] text-[12px] text-[#a16207]">— {senderName}</Text>
                </Section>
              )}

              {/* CTA Button */}
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                  href={signingUrl}
                >
                  Review & Sign Now
                </Button>
              </Section>

              <Text className="m-0 mb-[16px] text-[14px] leading-[22px] text-[#6b7280]">
                Or copy and paste this link into your browser:
              </Text>
              <Link href={signingUrl} className="text-[14px] break-all text-[#2563eb]">
                {signingUrl}
              </Link>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This reminder was sent by Seal on behalf of {senderName}. If you've already signed
                this document, please disregard this email.
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

export default DocumentReminder;
