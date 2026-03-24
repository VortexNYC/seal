import { expect, type Page } from "@playwright/test";

const ignoredConsoleErrorPatterns = [/\/favicon\.ico(?:\?|$)/i];
const ignoredConsoleMessages = [
  "Failed to load resource: the server responded with a status of 404 ()",
];
const ignoredRequestFailurePatterns = [/ERR_ABORTED/i, /NS_BINDING_ABORTED/i, /cancelled/i];

export function trackBrowserErrors(page: Page): { assertNoErrors: () => Promise<void> } {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (ignoredConsoleMessages.includes(text)) {
      return;
    }

    if (ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) {
      return;
    }

    errors.push(`console: ${text}`);
  });

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (!failure) {
      return;
    }

    if (ignoredRequestFailurePatterns.some((pattern) => pattern.test(failure.errorText))) {
      return;
    }

    const url = request.url();
    if (ignoredConsoleErrorPatterns.some((pattern) => pattern.test(url))) {
      return;
    }

    errors.push(`requestfailed: ${request.method()} ${url} ${failure.errorText}`);
  });

  return {
    async assertNoErrors(): Promise<void> {
      expect(errors, errors.join("\n")).toEqual([]);
    },
  };
}
