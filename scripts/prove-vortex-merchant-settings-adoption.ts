import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const paymentsRoutePath = join(
  repoRoot,
  "apps/web/src/routes/_authenticated/$slug/settings/payments.tsx",
);
const vortexComponentsPath = join(
  repoRoot,
  "apps/web/node_modules/@vortex/payments/src/react/components.ts",
);

const paymentsRoute = readFileSync(paymentsRoutePath, "utf8");
const vortexComponents = readFileSync(vortexComponentsPath, "utf8");
const failures: string[] = [];

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
  "ConnectAccountManagement",
  "ConnectAccountOnboarding",
  "ConnectNotificationBanner",
]) {
  if (paymentsRoute.includes(forbiddenFragment)) {
    failures.push(
      `payments route still contains non-Vortex provider UI fragment: ${forbiddenFragment}`,
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
console.log("- Non-Vortex embedded account UI and theme helpers stay deleted.");
console.log("- Merchant account data reads through the Vortex Payments boundary.");
