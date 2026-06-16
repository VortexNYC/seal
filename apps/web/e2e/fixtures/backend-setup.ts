import { getTestWorkspaceConfig } from "./auth-helpers";
import { assertConvexE2eHelperAvailability, ensurePdfStorageId } from "./convex-test-api";
import { sampleDocumentPath } from "./paths";
import { readCachedWorkspaceSlug } from "./workspace-state";

function getConvexSetupContext(): {
  convexUrl: string;
  deployKey: string;
  organizationSlug: string;
} {
  const convexUrl = process.env.VITE_CONVEX_URL || "https://coordinated-lemur-768.convex.cloud";
  const deployKey = process.env.CONVEX_DEPLOY_KEY || "";
  const organizationSlug = readCachedWorkspaceSlug() || getTestWorkspaceConfig().organizationSlug;

  return { convexUrl, deployKey, organizationSlug };
}

export async function cleanupPendingInvitations(): Promise<void> {
  const { convexUrl, deployKey, organizationSlug } = getConvexSetupContext();
  if (!deployKey) {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping E2E invitation cleanup");
    return;
  }

  try {
    let totalRevoked = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const cleanupRes = await fetch(`${convexUrl}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${deployKey}`,
        },
        body: JSON.stringify({
          path: "test_e2e_helpers:purgeE2EPendingInvitations",
          args: { organizationSlug, batchSize: 50 },
          format: "json",
        }),
      });

      if (!cleanupRes.ok) {
        console.warn(
          "[setup] purgeE2EPendingInvitations HTTP error:",
          cleanupRes.status,
          await cleanupRes.text(),
        );
        break;
      }

      const cleanupData = (await cleanupRes.json()) as {
        status: string;
        value?: { revoked?: number; hasMore?: boolean };
      };
      const revoked = cleanupData.value?.revoked ?? 0;
      totalRevoked += revoked;

      if (!cleanupData.value?.hasMore || revoked === 0) {
        break;
      }
    }

    if (totalRevoked > 0) {
      console.info(`[setup] Revoked ${totalRevoked} stale E2E invitation(s)`);
    }
  } catch (err) {
    console.warn("[setup] purgeE2EPendingInvitations failed:", err);
  }
}

export async function purgeE2eDocuments(): Promise<void> {
  const { convexUrl, deployKey, organizationSlug } = getConvexSetupContext();
  if (!deployKey) {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping E2E document purge");
    return;
  }

  try {
    let totalPurged = 0;
    for (let attempt = 0; attempt < 25; attempt++) {
      const purgeRes = await fetch(`${convexUrl}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${deployKey}`,
        },
        body: JSON.stringify({
          path: "test_e2e_helpers:purgeE2EDocuments",
          args: { organizationSlug, batchSize: 200 },
          format: "json",
        }),
      });

      if (!purgeRes.ok) {
        console.warn(
          "[setup] purgeE2EDocuments HTTP error:",
          purgeRes.status,
          await purgeRes.text(),
        );
        break;
      }

      const purgeData = (await purgeRes.json()) as {
        status: string;
        value?: { deleted?: number; hasMore?: boolean };
      };
      const deleted = purgeData.value?.deleted ?? 0;
      totalPurged += deleted;

      if (!purgeData.value?.hasMore || deleted === 0) {
        break;
      }
    }

    if (totalPurged > 0) {
      console.info(`[setup] Purged ${totalPurged} stale E2E document(s)`);
    }
  } catch (err) {
    console.warn("[setup] purgeE2EDocuments failed:", err);
  }
}

export async function seedProSubscription(): Promise<void> {
  const { convexUrl, deployKey, organizationSlug } = getConvexSetupContext();
  if (!deployKey) {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping pro subscription seed");
    return;
  }

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
}

/**
 * Provision a Stripe sandbox customer on `organizations.stripeCustomerId`
 * for the E2E workspace. Required for any test that exercises a Stripe
 * action that looks up the real customer record (e.g. portal sessions).
 *
 * Calls `seedStripeCustomerForE2E` (a Convex action — needs external HTTP
 * to Stripe). Idempotent on the backend: returns `already_seeded` if the
 * org already has a customer id.
 */
export async function seedStripeCustomer(): Promise<void> {
  const { convexUrl, deployKey, organizationSlug } = getConvexSetupContext();
  if (!deployKey) {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping Stripe customer seed");
    return;
  }

  try {
    const res = await fetch(`${convexUrl}/api/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${deployKey}`,
      },
      body: JSON.stringify({
        path: "test_e2e_helpers:seedStripeCustomerForE2E",
        args: { organizationSlug },
        format: "json",
      }),
    });
    if (!res.ok) {
      console.warn("[setup] seedStripeCustomerForE2E HTTP error:", res.status, await res.text());
      return;
    }

    const data = (await res.json()) as {
      status: string;
      value?: { seeded?: boolean; stripeCustomerId?: string; reason?: string };
    };
    if (data.value?.seeded) {
      console.info(`[setup] Stripe customer seeded: ${data.value.stripeCustomerId}`);
    } else if (data.value?.reason === "already_seeded") {
      // Quiet: idempotent re-runs are normal.
    } else if (data.value?.reason) {
      console.warn(`[setup] seedStripeCustomerForE2E: ${data.value.reason}`);
    }
  } catch (err) {
    console.warn("[setup] seedStripeCustomerForE2E failed:", err);
  }
}

export async function prepareBackendState(): Promise<void> {
  await assertConvexE2eHelperAvailability();
  await cleanupPendingInvitations();
  await purgeE2eDocuments();
  await seedProSubscription();
  await seedStripeCustomer();

  try {
    const storageId = await ensurePdfStorageId(sampleDocumentPath);
    console.info(`[setup] PDF storageId cached: ${storageId}`);
  } catch (err) {
    console.warn("[setup] PDF upload failed — API document creation will fall back to UI:", err);
  }
}
