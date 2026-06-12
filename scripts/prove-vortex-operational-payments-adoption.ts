import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const webPackagePath = join(repoRoot, "apps/web/package.json");
const webSrcPath = join(repoRoot, "apps/web/src");
const vortexSurfacePath = join(
  repoRoot,
  "apps/web/src/components/payments/vortex-merchant-operational-surface.tsx",
);
const deletedStripeSurfacePaths = [
  "apps/web/src/lib/stripe-theme.ts",
  "apps/web/src/components/stripe",
  "apps/web/src/components/stripe/connect-provider.tsx",
  "apps/web/src/components/stripe/no-connect-state.tsx",
];
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
  "@stripe/react-connect-js",
  "@stripe/connect-js",
  "StripeConnectProvider",
  "NoStripeConnectState",
  "ConnectBalances",
  "ConnectInstantPayoutsPromotion",
  "ConnectPayouts",
  "ConnectDisputesList",
  "ConnectPayments",
  "ConnectDocuments",
  "ConnectNotificationBanner",
];

const webPackage = parseJsonObject(readFileSync(webPackagePath, "utf8"));
const dependencies = getObject(webPackage, "dependencies");
const vortexSurface = readFileSync(vortexSurfacePath, "utf8");
const failures: string[] = [];

for (const deletedPath of deletedStripeSurfacePaths) {
  if (existsSync(join(repoRoot, deletedPath))) {
    failures.push(`${deletedPath} must stay deleted.`);
  }
}

for (const dependencyName of ["@stripe/connect-js", "@stripe/react-connect-js"]) {
  if (dependencies[dependencyName] !== undefined) {
    failures.push(`apps/web/package.json must not depend on ${dependencyName}.`);
  }
}

for (const sourcePath of collectSourceFiles(webSrcPath)) {
  const source = readFileSync(sourcePath, "utf8");
  const relativePath = sourcePath.slice(repoRoot.length);

  for (const forbiddenFragment of forbiddenRouteFragments) {
    if (source.includes(forbiddenFragment)) {
      failures.push(`${relativePath} still contains Stripe Connect fragment: ${forbiddenFragment}`);
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

  for (const forbiddenFragment of [
    "NoStripeConnectState",
    "Connect Stripe",
    "Stripe not connected",
  ]) {
    if (route.includes(forbiddenFragment)) {
      failures.push(`${routePath} still contains Stripe fallback fragment: ${forbiddenFragment}`);
    }
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
console.log("- Stripe Connect embeds are removed from Seal operational payment routes.");
console.log("- Balances, payouts, and history render through @vortex/payments/react components.");
console.log("- Disputes and tax documents render explicit Vortex-owned replacement states.");
console.log(
  "- Stripe Connect packages, theme helpers, and shared wrapper components stay deleted.",
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

function parseJsonObject(source: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) {
    throw new Error("Expected package.json to parse as an object.");
  }
  return parsed;
}

function getObject(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) {
    return {};
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
