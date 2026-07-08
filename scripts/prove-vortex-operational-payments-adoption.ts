import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const webSrcPath = join(repoRoot, "apps/web/src");
const vortexSurfacePath = join(
  repoRoot,
  "apps/web/src/components/payments/vortex-merchant-operational-surface.tsx",
);
const operationalRoutePaths = [
  "apps/web/src/routes/_authenticated/$slug/payments/balances.tsx",
  "apps/web/src/routes/_authenticated/$slug/payments/payouts.tsx",
  "apps/web/src/routes/_authenticated/$slug/payments/history.tsx",
  "apps/web/src/routes/_authenticated/$slug/payments/disputes.tsx",
  "apps/web/src/routes/_authenticated/$slug/payments/tax.tsx",
];
const fallbackRoutePaths = [
  "apps/web/src/routes/_authenticated/$slug/payments/index.tsx",
  "apps/web/src/routes/_authenticated/$slug/payments/subscriptions.tsx",
];
const forbiddenRouteFragments = [
  "ConnectBalances",
  "ConnectInstantPayoutsPromotion",
  "ConnectPayouts",
  "ConnectDisputesList",
  "ConnectPayments",
  "ConnectDocuments",
  "ConnectNotificationBanner",
];

const vortexSurface = readFileSync(vortexSurfacePath, "utf8");
const failures: string[] = [];

for (const sourcePath of collectSourceFiles(webSrcPath)) {
  const source = readFileSync(sourcePath, "utf8");
  const relativePath = sourcePath.slice(repoRoot.length);

  for (const forbiddenFragment of forbiddenRouteFragments) {
    if (source.includes(forbiddenFragment)) {
      failures.push(
        `${relativePath} still contains legacy provider Connect fragment: ${forbiddenFragment}`,
      );
    }
  }
}

for (const routePath of operationalRoutePaths) {
  const route = readFileSync(join(repoRoot, routePath), "utf8");

  if (!route.includes("VortexMerchantOperationalSurface")) {
    failures.push(`${routePath} must render VortexMerchantOperationalSurface.`);
  }
}

for (const routePath of fallbackRoutePaths) {
  const route = readFileSync(join(repoRoot, routePath), "utf8");

  if (!route.includes("NoVortexMerchantAccountState")) {
    failures.push(`${routePath} must use the Vortex merchant fallback state.`);
  }

}

for (const requiredSurfaceFragment of [
  'from "@vortex/payments/react"',
  "VortexPaymentsProvider",
  "VortexMerchantAccountPanel",
  "VortexMerchantActionQueue",
  "VortexPayoutReadinessPanel",
  "VortexBalanceWalletPanel",
  "VortexPaymentTimelineSummary",
  "NoVortexMerchantAccountState",
  "merchant-disputes-replacement",
  "merchant-tax-documents-replacement",
]) {
  if (!vortexSurface.includes(requiredSurfaceFragment)) {
    failures.push(`Vortex operational surface missing fragment: ${requiredSurfaceFragment}`);
  }
}

if (failures.length > 0) {
  console.error("Vortex operational payments adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex operational payments adoption proof passed:");
console.log("- Legacy provider embeds are removed from Seal operational payment routes.");
console.log("- Balances, payouts, and history render through @vortex/payments/react components.");
console.log("- Disputes and tax documents render explicit Vortex-owned replacement states.");
console.log(
  "- Legacy provider Connect packages, theme helpers, and shared wrapper components stay deleted.",
);

function collectSourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}
