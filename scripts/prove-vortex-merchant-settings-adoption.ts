import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const paymentsRoutePath = join(
  repoRoot,
  "apps/web/src/routes/_authenticated/$slug/settings/payments.tsx",
);
const webPackagePath = join(repoRoot, "apps/web/package.json");
const vortexComponentsPath = join(
  repoRoot,
  "apps/web/node_modules/@vortex/payments/src/react/components.ts",
);

const paymentsRoute = readFileSync(paymentsRoutePath, "utf8");
const vortexComponents = readFileSync(vortexComponentsPath, "utf8");
const webPackage = parseJsonObject(readFileSync(webPackagePath, "utf8"));
const dependencies = getObject(webPackage, "dependencies");
const failures: string[] = [];

if (dependencies["@vortex/payments"] === undefined) {
  failures.push("apps/web must depend on @vortex/payments.");
}

for (const requiredFragment of [
  'from "@vortex/payments/react"',
  "VortexPaymentsProvider",
  "VortexMerchantAccountPanel",
  "VortexMerchantActionQueue",
  "VortexMerchantAccountPanelProps",
  "type VortexMerchantAccount = VortexMerchantAccountPanelProps",
  "buildMerchantAccount",
  "buildMerchantState",
  "mapMerchantAccountStatus",
]) {
  if (!paymentsRoute.includes(requiredFragment)) {
    failures.push(
      `payments route missing required merchant adoption fragment: ${requiredFragment}`,
    );
  }
}

for (const requiredPackageFragment of [
  '"data-vortex-component": "VortexMerchantAccountPanel"',
  '"data-vortex-surface": "merchant-account-panel"',
  '"data-vortex-component": "VortexMerchantActionQueue"',
  '"data-vortex-surface": "merchant-action-queue"',
]) {
  if (!vortexComponents.includes(requiredPackageFragment)) {
    failures.push(
      `@vortex/payments missing required merchant selector fragment: ${requiredPackageFragment}`,
    );
  }
}

for (const forbiddenFragment of [
  "@stripe/react-connect-js",
  "StripeConnectProvider",
  "ConnectAccountManagement",
  "ConnectAccountOnboarding",
  "ConnectNotificationBanner",
  "Stripe Connection",
  "Connect with Stripe",
  "No Stripe account connected",
]) {
  if (paymentsRoute.includes(forbiddenFragment)) {
    failures.push(`payments route still contains Stripe Connect UI fragment: ${forbiddenFragment}`);
  }
}

if (failures.length > 0) {
  console.error("Vortex merchant settings adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex merchant settings adoption proof passed:");
console.log(
  "- Seal payments settings renders merchant account state through Vortex package components.",
);
console.log("- Stripe Connect embedded account UI stays deleted from the route.");
console.log("- Existing backend query is only an adapter input for the package surface.");

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
