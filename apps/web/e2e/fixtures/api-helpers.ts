import type { Page } from "@playwright/test";

import { getApiBaseUrl } from "./api-test-client";

function isApiRequest(url: string): boolean {
  try {
    const apiBase = getApiBaseUrl();
    return url.startsWith(apiBase) || url.includes("/api/");
  } catch {
    return url.includes("/api/");
  }
}

export async function waitForApiResponse(
  page: Page,
  urlIncludes?: string,
  timeout = 10000
): Promise<void> {
  try {
    if (urlIncludes) {
      await page.waitForResponse(
        (response) =>
          isApiRequest(response.url()) &&
          response.url().includes(urlIncludes),
        { timeout: timeout * 0.6 }
      );
    } else {
      await page.waitForResponse(
        (response) => isApiRequest(response.url()),
        { timeout }
      );
    }
  } catch {
    // If the API doesn't emit a matching request (for example local no-op
    // transitions), let the call continue and rely on subsequent UI assertions.
  }

  // Allow time for real-time updates to propagate
  await page.waitForTimeout(500);
}

export async function getApiRequests(page: Page): Promise<string[]> {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (isApiRequest(request.url())) {
      requests.push(request.url());
    }
  });

  return requests;
}
