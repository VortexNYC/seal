/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Button, Heading, Section, Text } from "@react-email/components";

import { email, status } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

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
    <EmailLayout
      preview={previewText}
      subtitle="Welcome to Seal"
      footerText={`This email was sent to ${userEmail} because you created an account on Seal. If you didn't create this account, please ignore this email.`}
    >
      {/* Welcome banner */}
      <Section className="mb-[24px] text-center">
        <div
          style={{
            width: "80px",
            height: "80px",
            backgroundColor: status.successSurface,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ margin: "0", fontSize: "40px", lineHeight: "80px" }}>&#x1F44B;</Text>
        </div>
      </Section>

      <Section>
        <Heading
          style={{
            margin: "0 0 16px 0",
            textAlign: "center",
            fontSize: "22px",
            fontWeight: "600",
            color: email.foreground,
          }}
        >
          Welcome to Seal, {userName}!
        </Heading>

        <Text style={{ ...emailStyles.bodyTextSpaced, textAlign: "center" }}>
          Your account has been created successfully. You&apos;re now ready to start sending
          documents for signature.
        </Text>

        {/* Features list */}
        <Section style={{ ...emailStyles.documentCard, padding: "24px" }}>
          <Text
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "500",
              color: email.foreground,
            }}
          >
            Here&apos;s what you can do with Seal:
          </Text>
          <Text
            style={{ margin: "0 0 8px 0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}
          >
            &#x2713; Upload and prepare documents for signing
          </Text>
          <Text
            style={{ margin: "0 0 8px 0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}
          >
            &#x2713; Add signature fields and assign recipients
          </Text>
          <Text
            style={{ margin: "0 0 8px 0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}
          >
            &#x2713; Track document status in real-time
          </Text>
          <Text style={{ margin: "0", fontSize: "14px", lineHeight: "24px", color: "#6b6560" }}>
            &#x2713; Get notified when documents are signed
          </Text>
        </Section>

        {/* CTA Button */}
        <Section className="my-[32px] text-center">
          <Button style={emailStyles.ctaButton} href={dashboardUrl}>
            Go to Dashboard
          </Button>
        </Section>

        <Text
          style={{ ...emailStyles.smallText, textAlign: "center", color: email.mutedForeground }}
        >
          If you have any questions, feel free to reply to this email. We&apos;re here to help!
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default Welcome;
