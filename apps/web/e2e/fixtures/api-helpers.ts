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
          isApiRequest(response.url()) && response.url().includes(urlIncludes),
        { timeout: timeout * 0.6 }
      );
    } else {
      await page.waitForResponse((response) => isApiRequest(response.url()), {
        timeout,
      });
    }
  } catch {
    // If the API doesn't emit a matching request (for example local no-op
    // transitions), let the call continue and rely on subsequent UI assertions.
  }

  // Allow time for real-time updates to propagate
  await page.waitForTimeout(500);
}

/**
 * @deprecated Use {@link waitForApiResponse} with the API path fragment.
 */
export async function waitForConvexQuery(
  page: Page,
  _queryName: string,
  timeout = 10000
): Promise<void> {
  await waitForApiResponse(page, undefined, timeout);
}

/**
 * @deprecated Use {@link waitForApiResponse} with the API path fragment.
 */
export async function waitForConvexMutation(
  page: Page,
  mutationName?: string,
  timeout = 10000
): Promise<void> {
  const fragment = mutationName
    ? mapMutationNameToPath(mutationName)
    : undefined;
  await waitForApiResponse(page, fragment, timeout);
}

function mapMutationNameToPath(name: string): string | undefined {
  switch (name) {
    case "createDocument":
      return "/api/documents";
    case "createField":
      return "/signature-fields";
    case "sendDocument":
      return "/send";
    case "grantAccess":
      return "/share";
    case "updateAccessLevel":
      return "/permission";
    case "revokeAccess":
      return "/revoke";
    default:
      return undefined;
  }
}

/**
 * @deprecated No longer needed with the Seal API. Tests should drive state through
 * API fixtures or UI, not mock backend responses.
 */
export async function mockConvexQuery(
  _page: Page,
  _queryName: string,
  _mockData: unknown
): Promise<void> {
  // No-op: the Cloudflare Worker API is the real backend in E2E tests.
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
