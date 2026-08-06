import type { Page } from "@playwright/test";

/**
 * Helpers for interacting with Convex backend during tests
 */

/**
 * Wait for Convex query to resolve with expected data
 */
export async function waitForConvexQuery(
  page: Page,
  queryName: string,
  timeout = 10000
): Promise<void> {
  // Wait for network request to the Convex API
  await page.waitForResponse(
    (response) =>
      response.url().includes("convex.cloud") &&
      response.url().includes(queryName),
    { timeout }
  );

  // Allow time for React to re-render
  await page.waitForTimeout(500);
}

/**
 * Intercept Convex mutations to track completion
 */
function isConvexRequest(url: string): boolean {
  return (
    url.includes("convex") ||
    url.includes("api.convex") ||
    url.includes("convex.cloud")
  );
}

export async function waitForConvexMutation(
  page: Page,
  mutationName?: string,
  timeout = 10000
): Promise<void> {
  try {
    if (mutationName) {
      await page.waitForResponse(
        (response) =>
          isConvexRequest(response.url()) &&
          response.url().includes(mutationName),
        { timeout: timeout * 0.6 }
      );
      return;
    }
  } catch {
    // Continue to fallback if the mutation name changed or response fails.
  }

  try {
    await page.waitForResponse((response) => isConvexRequest(response.url()), {
      timeout: timeout,
    });
  } catch {
    // If Convex doesn't emit a matching request (for example due local no-op
    // transitions), let the call continue and rely on subsequent UI assertions.
  }

  // Allow time for real-time updates to propagate
  await page.waitForTimeout(1000);
}

/**
 * Mock Convex query response for testing
 */
export async function mockConvexQuery(
  page: Page,
  queryName: string,
  mockData: unknown
): Promise<void> {
  await page.route("**/convex.cloud/**", (route) => {
    const url = route.request().url();
    if (url.includes(queryName)) {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockData),
      });
    } else {
      void route.continue();
    }
  });
}

/**
 * Get all Convex network requests
 */
export async function getConvexRequests(page: Page): Promise<string[]> {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("convex.cloud")) {
      requests.push(request.url());
    }
  });

  return requests;
}
