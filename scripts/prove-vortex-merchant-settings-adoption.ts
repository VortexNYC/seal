import { existsSync, readFileSync } from "node:fs";
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

for (const deletedPath of ["apps/web/src/lib/stripe-theme.ts", "apps/web/src/components/stripe"]) {
  if (existsSync(join(repoRoot, deletedPath))) {
    failures.push(`${deletedPath} must stay deleted.`);
  }
}

if (dependencies["@vortex/payments"] === undefined) {
  failures.push("apps/web must depend on @vortex/payments.");
}

for (const dependencyName of ["@stripe/connect-js", "@stripe/react-connect-js"]) {
  if (dependencies[dependencyName] !== undefined) {
    failures.push(`apps/web/package.json must not depend on ${dependencyName}.`);
  }
}

for (const requiredFragment of [
  'from "@vortex/payments/react"',
  "VortexPaymentsProvider",
  "VortexMerchantAccountPanel",
  "VortexMerchantActionQueue",
  "VortexMerchantAccountPanelProps",
  "type VortexMerchantAccount = VortexMerchantAccountPanelProps",
  "Vortex Connect",
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
  "Vortex Connect",
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
  'Id<"stripe_accounts">',
]) {
  if (paymentsRoute.includes(forbiddenFragment)) {
    failures.push(
      `payments route still contains legacy provider UI fragment: ${forbiddenFragment}`,
    );
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
  "- Seal payments settings renders Vortex Connect state through Vortex package components.",
);
console.log("- Legacy provider embedded account UI and theme helpers stay deleted.");
console.log("- Merchant account data reads through the Vortex Payments boundary.");

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
