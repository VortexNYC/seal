import { getTestWorkspaceConfig } from "./auth-helpers";
import {
  assertConvexE2eHelperAvailability,
  ensurePdfStorageId,
} from "./convex-test-api";
import { sampleDocumentPath } from "./paths";
import { readCachedWorkspaceSlug } from "./workspace-state";

function getConvexSetupContext(): {
  convexUrl: string;
  deployKey: string;
  organizationSlug: string;
} {
  const convexUrl =
    process.env.VITE_CONVEX_URL || "https://coordinated-lemur-768.convex.cloud";
  const deployKey = process.env.CONVEX_DEPLOY_KEY || "";
  const organizationSlug =
    readCachedWorkspaceSlug() || getTestWorkspaceConfig().organizationSlug;

  return { convexUrl, deployKey, organizationSlug };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type BatchPurgeInput = {
  convexUrl: string;
  deployKey: string;
  path: string;
  args: Record<string, unknown>;
  countKey: string;
  label: string;
  maxAttempts: number;
};

/**
 * Run a batched purge mutation until it reports no more work. Batches are
 * sequential by design — each one must land before the next request — so the
 * repetition is expressed as recursion instead of an awaited loop.
 */
async function runBatchedPurge(
  input: BatchPurgeInput,
  attempt = 0,
  total = 0
): Promise<number> {
  if (attempt >= input.maxAttempts) return total;

  const res = await fetch(`${input.convexUrl}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${input.deployKey}`,
    },
    body: JSON.stringify({
      path: input.path,
      args: input.args,
      format: "json",
    }),
  });

  if (!res.ok) {
    console.warn(
      `[setup] ${input.label} HTTP error:`,
      res.status,
      await res.text()
    );
    return total;
  }

  const data: unknown = await res.json();
  const value = isRecord(data) && isRecord(data.value) ? data.value : undefined;
  const countField = value?.[input.countKey];
  const count = typeof countField === "number" ? countField : 0;
  const hasMore = value?.hasMore === true;

  if (!hasMore || count === 0) return total + count;
  return runBatchedPurge(input, attempt + 1, total + count);
}

export async function cleanupPendingInvitations(): Promise<void> {
  const { convexUrl, deployKey, organizationSlug } = getConvexSetupContext();
  if (!deployKey) {
    console.warn(
      "[setup] CONVEX_DEPLOY_KEY not set — skipping E2E invitation cleanup"
    );
    return;
  }

  try {
    const totalRevoked = await runBatchedPurge({
      convexUrl,
      deployKey,
      path: "test_e2e_helpers:purgeE2EPendingInvitations",
      args: { organizationSlug, batchSize: 50 },
      countKey: "revoked",
      label: "purgeE2EPendingInvitations",
      maxAttempts: 2,
    });

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
    console.warn(
      "[setup] CONVEX_DEPLOY_KEY not set — skipping E2E document purge"
    );
    return;
  }

  try {
    const totalPurged = await runBatchedPurge({
      convexUrl,
      deployKey,
      path: "test_e2e_helpers:purgeE2EDocuments",
      args: { organizationSlug, batchSize: 200 },
      countKey: "deleted",
      label: "purgeE2EDocuments",
      maxAttempts: 25,
    });

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
    console.warn(
      "[setup] CONVEX_DEPLOY_KEY not set — skipping pro subscription seed"
    );
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
      console.warn(
        "[setup] seedProSubscriptionForE2E HTTP error:",
        res.status,
        await res.text()
      );
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
    console.warn(
      "[setup] PDF upload failed — API document creation will fall back to UI:",
      err
    );
  }
}
