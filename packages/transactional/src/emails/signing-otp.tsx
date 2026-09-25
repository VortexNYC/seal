/* vortex-allow-color-file: transactional email template — email clients require literal colors; CSS variables and Tailwind tokens are not supported in email HTML. */
import { Section, Text } from "@react-email/components";

import { email } from "../styles.js";
import { EmailLayout, emailStyles } from "./email-layout.js";

export interface SigningOtpProps {
  recipientName: string;
  documentName: string;
  code: string;
  expiresInMinutes: number;
}

export function SigningOtp({
  recipientName,
  documentName,
  code,
  expiresInMinutes,
}: SigningOtpProps) {
  return (
    <EmailLayout
      preview={`Your Seal verification code is ${code}`}
      subtitle="Signing verification"
      footerText="If you did not request this code, you can ignore this email."
    >
      <Section>
        <Text style={emailStyles.bodyText}>Hello {recipientName},</Text>
        <Text style={emailStyles.bodyTextSpaced}>
          Use this code to verify you control this inbox before signing{" "}
          <strong>{documentName}</strong>:
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Text
          style={{
            margin: "0",
            fontSize: "32px",
            letterSpacing: "8px",
            fontWeight: 700,
            color: email.bodyText,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {code}
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.bodyText}>
          This code expires in {expiresInMinutes} minutes.
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default SigningOtp;
