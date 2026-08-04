import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const billingRoutePath = join(
  repoRoot,
  "apps/web/src/routes/_authenticated/$slug/settings/billing.tsx"
);
const webPackagePath = join(repoRoot, "apps/web/package.json");
const vortexComponentsPath = join(
  repoRoot,
  "apps/web/node_modules/@vortexnyc/payments-react/dist/index.js"
);

const billingRoute = readFileSync(billingRoutePath, "utf8");
const vortexComponents = readFileSync(vortexComponentsPath, "utf8");
const webPackage = parseJsonObject(readFileSync(webPackagePath, "utf8"));
const dependencies = getObject(webPackage, "dependencies");
const failures: string[] = [];

if (dependencies["@vortexnyc/payments-react"] === undefined) {
  failures.push("apps/web must depend on @vortexnyc/payments-react.");
}

for (const requiredFragment of [
  'from "@vortexnyc/payments-react"',
  "VortexPaymentsProvider",
  "VortexSubscriptionActionSummary",
  "VortexPlanComparison",
  "buildSubscriptionActionSummary",
  "buildPlanComparison",
]) {
  if (!billingRoute.includes(requiredFragment)) {
    failures.push(
      `billing route missing required Vortex adoption fragment: ${requiredFragment}`
    );
  }
}

for (const requiredPackageFragment of [
  '"data-vortex-component": "VortexSubscriptionActionSummary"',
  '"data-vortex-component": "VortexPlanComparison"',
]) {
  if (!vortexComponents.includes(requiredPackageFragment)) {
    failures.push(
      `@vortexnyc/payments-react missing required selector fragment: ${requiredPackageFragment}`
    );
  }
}

for (const forbiddenFragment of [
  "function getStatusBadge",
  "function formatPrice",
  "function formatInterval",
  "Sparkles",
  "CreditCard",
  "currentFeatures",
  "Plan Card",
  "Current Free plan",
  "Pro upgrade",
  "Included features",
]) {
  if (billingRoute.includes(forbiddenFragment)) {
    failures.push(
      `billing route still contains local replacement UI/provider fragment: ${forbiddenFragment}`
    );
  }
}

if (
  billingRoute.includes("<VortexPlanComparison") &&
  !billingRoute.includes("onPlanSelect={handlePlanSelect}")
) {
  failures.push(
    "VortexPlanComparison must own plan selection through handlePlanSelect."
  );
}

if (
  billingRoute.includes("<VortexSubscriptionActionSummary") &&
  !billingRoute.includes("onAction={handleSubscriptionAction}")
) {
  failures.push(
    "VortexSubscriptionActionSummary must own subscription action handoff."
  );
}

if (failures.length > 0) {
  console.error("Vortex billing settings adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex billing settings adoption proof passed:");
console.log("- Seal billing settings imports @vortexnyc/payments-react.");
console.log(
  "- Subscription and plan UI render through Vortex package components."
);
console.log(
  "- Local plan comparison and subscription summary fragments stay deleted."
);

function parseJsonObject(source: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) {
    throw new Error("Expected package.json to parse as an object.");
  }
  return parsed;
}

function getObject(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) {
    return {};
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
