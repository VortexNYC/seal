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
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const clerkOrgId = process.env.E2E_CLERK_ORG_ID || "org_3BLR7tViJcVbpYwfByrDfPhR0Bn";

  if (!clerkSecretKey) {
    return;
  }

  try {
    const invRes = await fetch(
      `https://api.clerk.com/v1/organizations/${clerkOrgId}/invitations?status=pending&limit=100`,
      { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
    );
    if (!invRes.ok) {
      return;
    }

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
  } catch (err) {
    console.warn("[setup] Failed to clean up pending invitations:", err);
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

export async function prepareBackendState(): Promise<void> {
  await assertConvexE2eHelperAvailability();
  await cleanupPendingInvitations();
  await purgeE2eDocuments();
  await seedProSubscription();

  try {
    const storageId = await ensurePdfStorageId(sampleDocumentPath);
    console.info(`[setup] PDF storageId cached: ${storageId}`);
  } catch (err) {
    console.warn("[setup] PDF upload failed — API document creation will fall back to UI:", err);
  }
}
