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
  "VortexFeePolicyPanel",
  "VortexFeePolicyOwnerMode",
  "VortexFeePolicyState",
  "buildFeePolicy",
  "handleVortexFeePolicyChange",
  "onPolicyChange={handleVortexFeePolicyChange}",
  'feeHandling === "pass_to_recipient" ? "customer_pays" : "merchant_pays"',
]) {
  if (!paymentsRoute.includes(requiredFragment)) {
    failures.push(`payments route missing required Vortex adoption fragment: ${requiredFragment}`);
  }
}

for (const requiredPackageFragment of [
  '"data-vortex-component": "VortexFeePolicyPanel"',
  '"data-vortex-surface": "fee-policy-panel"',
  '"data-vortex-fee-policy-owner-mode"',
  '"data-vortex-fee-policy-option"',
]) {
  if (!vortexComponents.includes(requiredPackageFragment)) {
    failures.push(
      `@vortex/payments missing required fee-policy selector fragment: ${requiredPackageFragment}`,
    );
  }
}

for (const forbiddenFragment of [
  "RadioGroup",
  "RadioGroupItem",
  "Who pays the platform fee?",
  "I'll absorb the fee",
  "Vortex Payments payment processing fees",
]) {
  if (paymentsRoute.includes(forbiddenFragment)) {
    failures.push(
      `payments route still contains local fee-policy/provider fragment: ${forbiddenFragment}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Vortex payments settings adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex payments settings adoption proof passed:");
console.log("- Seal payments settings imports @vortex/payments/react.");
console.log("- Merchant fee ownership renders through VortexFeePolicyPanel.");
console.log("- Local fee policy radio/card fragments stay deleted.");

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
