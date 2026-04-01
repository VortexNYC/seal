import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { ensurePdfStorageId } from "../fixtures/convex-test-api";

import { ensureWorkspace, getTestWorkspaceConfig, signInTestUser } from "../fixtures/auth-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authStatePath = path.resolve(__dirname, "../../playwright/.clerk/user.json");

// Clerk's official protocol: clerkSetup() must run first, serially, to obtain
// a Testing Token that bypasses Cloudflare bot detection for all subsequent tests.
setup.describe.configure({ mode: "serial" });

setup("initialize clerk testing environment", async () => {
  await clerkSetup();
});

setup("authenticate clerk test user", async ({ page }) => {
  setup.setTimeout(60000);
  mkdirSync(path.dirname(authStatePath), { recursive: true });

  // Sign in and verify Convex auth is ready
  await signInTestUser(page);

  // Save auth state FIRST — this is what tests depend on
  await page.context().storageState({ path: authStatePath });

  // Workspace setup happens AFTER auth is saved, never blocks tests.
  // The org is persistent in the test deployment so this is usually a no-op.
  await ensureWorkspace(page);

  // Clean up pending Clerk invitations from previous test runs.
  // The Clerk org has a membership quota (5). Stale pending invitations from
  // previous runs will block new invitations until revoked.
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const clerkOrgId = process.env.E2E_CLERK_ORG_ID || "org_3BLR7tViJcVbpYwfByrDfPhR0Bn";
  if (clerkSecretKey) {
    try {
      const invRes = await fetch(
        `https://api.clerk.com/v1/organizations/${clerkOrgId}/invitations?status=pending&limit=100`,
        { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
      );
      if (invRes.ok) {
        const invData = (await invRes.json()) as { data: { id: string }[] };
        for (const inv of invData.data) {
          await fetch(
            `https://api.clerk.com/v1/organizations/${clerkOrgId}/invitations/${inv.id}/revoke`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            },
          ).catch(() => {});
        }
        if (invData.data.length > 0) {
          console.info(`[setup] Revoked ${invData.data.length} stale pending invitation(s)`);
        }
      }
    } catch (err) {
      console.warn("[setup] Failed to clean up pending invitations:", err);
    }
  }

  // Seed a pro subscription so invite button / document quota are enabled.
  // Calls test_e2e_helpers:seedProSubscriptionForE2E via Convex HTTP API.
  // Non-fatal — tests degrade gracefully without pro plan.
  //
  // Use the actual active org slug from the URL (the app may redirect to a Clerk
  // org slug rather than the personal workspace slug derived from the email).
  let organizationSlug = getTestWorkspaceConfig().organizationSlug;
  try {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/[\w-]+\/home/, { timeout: 8000, waitUntil: "domcontentloaded" });
    const urlMatch = page.url().match(/\/([\w-]+)\/home/);
    if (urlMatch?.[1]) {
      organizationSlug = urlMatch[1];
    }
  } catch {
    // Fall back to config-derived slug — org may already be set up
  }

  const convexUrl = process.env.VITE_CONVEX_URL || "https://coordinated-lemur-768.convex.cloud";
  const deployKey = process.env.CONVEX_DEPLOY_KEY;

  if (deployKey) {
    try {
      const res = await fetch(`${convexUrl}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${deployKey}`,
        },
        body: JSON.stringify({
          path: "test_e2e_helpers:seedProSubscriptionForE2E",
          args: { organizationSlug },
          format: "json",
        }),
      });
      if (!res.ok) {
        console.warn("[setup] seedProSubscriptionForE2E HTTP error:", res.status, await res.text());
      }
    } catch (err) {
      console.warn("[setup] seedProSubscriptionForE2E failed:", err);
    }
  } else {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping pro subscription seed");
  }

  // Upload the sample PDF to Convex storage once and cache the storageId.
  // All tests reuse this storageId for API-level document creation (~300ms vs ~15s UI).
  const pdfPath = path.resolve(__dirname, "../fixtures/sample-document.pdf");
  try {
    const storageId = await ensurePdfStorageId(pdfPath);
    console.info(`[setup] PDF storageId cached: ${storageId}`);
  } catch (err) {
    console.warn("[setup] PDF upload failed — API document creation will fall back to UI:", err);
  }
});
