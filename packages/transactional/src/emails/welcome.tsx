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

export interface WelcomeProps {
  userName: string;
  userEmail: string;
  dashboardUrl?: string;
}

export function Welcome({
  userName = "there",
  userEmail = "user@example.com",
  dashboardUrl = "https://seal.nyc/dashboard",
}: WelcomeProps) {
  const previewText = "Welcome to Seal - Your document signing journey starts here";

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
              <Text className="m-0 text-[14px] text-[#6b7280]">Welcome to Seal</Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Welcome banner */}
            <Section className="mb-[24px] text-center">
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="m-0 text-[40px]" style={{ lineHeight: "80px" }}>
                  👋
                </Text>
              </div>
            </Section>

            {/* Main content */}
            <Section>
              <Heading className="m-0 mb-[16px] text-center text-[22px] font-semibold text-[#1a1a1a]">
                Welcome to Seal, {userName}!
              </Heading>

              <Text className="m-0 mb-[24px] text-center text-[16px] leading-[26px] text-[#4b5563]">
                Your account has been created successfully. You're now ready to start sending
                documents for signature.
              </Text>

              {/* Features list */}
              <Section className="mb-[24px] rounded-lg border border-solid border-[#e5e7eb] bg-[#f9fafb] p-[24px]">
                <Text className="m-0 mb-[16px] text-[16px] font-medium text-[#1a1a1a]">
                  Here's what you can do with Seal:
                </Text>

                <Text className="m-0 mb-[8px] text-[14px] leading-[24px] text-[#4b5563]">
                  ✓ Upload and prepare documents for signing
                </Text>
                <Text className="m-0 mb-[8px] text-[14px] leading-[24px] text-[#4b5563]">
                  ✓ Add signature fields and assign recipients
                </Text>
                <Text className="m-0 mb-[8px] text-[14px] leading-[24px] text-[#4b5563]">
                  ✓ Track document status in real-time
                </Text>
                <Text className="m-0 text-[14px] leading-[24px] text-[#4b5563]">
                  ✓ Get notified when documents are signed
                </Text>
              </Section>

              {/* CTA Button */}
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-lg bg-[#0f172a] px-[32px] py-[14px] text-center text-[16px] font-medium text-white no-underline"
                  href={dashboardUrl}
                >
                  Go to Dashboard
                </Button>
              </Section>

              <Text className="m-0 text-center text-[14px] leading-[22px] text-[#6b7280]">
                If you have any questions, feel free to reply to this email. We're here to help!
              </Text>
            </Section>

            <Hr className="my-[24px] border-[#e6ebf1]" />

            {/* Footer */}
            <Section>
              <Text className="m-0 text-[12px] leading-[20px] text-[#9ca3af]">
                This email was sent to {userEmail} because you created an account on Seal. If you
                didn't create this account, please ignore this email.
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

export default Welcome;
