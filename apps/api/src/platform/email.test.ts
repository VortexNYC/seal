import { describe, expect, it } from "vitest";

import { htmlToPlainText } from "./email.js";

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
