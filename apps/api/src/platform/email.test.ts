import { describe, expect, it } from "vitest";

import { htmlToPlainText, sendEmail, type EmailEnv } from "./email.js";

describe("htmlToPlainText", () => {
  it("strips tags and decodes common entities for Cloudflare text part", () => {
    const text = htmlToPlainText(
      "<p>Hello <strong>Signer</strong></p><p>Open <a href=\"https://app.seal.nyc/sign/tok\">here</a>.</p>"
    );
    expect(text).toContain("Hello Signer");
    expect(text).toContain("Open here");
    expect(text).not.toContain("<");
  });
});

describe("sendEmail", () => {
  it("retries Cloudflare EMAIL.send once after a transient failure", async () => {
    let calls = 0;
    const mockEmail = {
      send: async (): Promise<{ messageId: string }> => {
        calls += 1;
        if (calls === 1) {
          throw new Error("rate limited");
        }
        return { messageId: "test-message-id" };
      },
    } as NonNullable<EmailEnv["EMAIL"]>;
    const env: EmailEnv = {
      EMAIL_FROM: "sign@seal.nyc",
      APP_URL: "https://app.seal.nyc",
      EMAIL: mockEmail,
    };
    const result = await sendEmail(env, {
      to: "dogfood+signer@seal.nyc",
      subject: "Sign",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });
});
