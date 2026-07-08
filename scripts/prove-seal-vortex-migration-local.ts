import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const repoRoot = new URL("..", import.meta.url).pathname;
const portableVortexProofScripts = [
  "scripts/prove-seal-saas-checkout-vortex.ts",
  "scripts/prove-seal-document-payment-vortex-live.ts",
  "scripts/prove-seal-document-payment-vortex-paid-state.ts",
  "scripts/prove-seal-vortex-onboarding-wiring.ts",
  "scripts/audit-seal-vortex-sandbox-settlement-boundary.ts",
  "scripts/audit-seal-vortex-production-readiness.ts",
] as const;

const localGateForbiddenProofScripts = [
  "prove:seal-catalog-from-vortex",
  "prove:seal-coupons-vortex",
  "prove:seal-saas-checkout-vortex",
  "prove:seal-saas-webhook-billing-state",
  "prove:seal-vortex-onboarding-wiring",
  "prove:seal-document-payment-vortex-live",
  "prove:seal-document-payment-vortex-paid-state",
] as const;

const catalogProofForbiddenPatterns = [
  "seedLegacyProviderEntitlementSafetyProof",
  "legacyProviderEntitlementSafety",
  "activeNonVortexProviderIdPresent: true",
  "`cus_catalog_safety_",
  "`sub_catalog_safety_",
  "`price_catalog_safety_",
  "`prod_catalog_safety_",
  '"cus_catalog_safety_',
  '"sub_catalog_safety_',
  '"price_catalog_safety_',
  '"prod_catalog_safety_',
] as const;

type ProofCommand = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const proofCommands: readonly ProofCommand[] = [
  {
    label: "No retired-provider package, path, or provider-shaped content residue",
    command: "bun",
    args: ["run", "prove:zero-retired-provider-residue"],
  },
  {
    label: "Vortex billing settings adoption",
    command: "bun",
    args: ["run", "prove:vortex-billing-settings-adoption"],
  },
  {
    label: "Vortex payments settings adoption",
    command: "bun",
    args: ["run", "prove:vortex-payments-settings-adoption"],
  },
  {
    label: "Vortex merchant settings adoption",
    command: "bun",
    args: ["run", "prove:vortex-merchant-settings-adoption"],
  },
  {
    label: "Vortex account creation and onboarding local proof",
    command: "bun",
    args: ["run", "prove:seal-account-onboarding-vortex-local"],
  },
  {
    label: "Vortex SaaS webhook projection",
    command: "bun",
    args: ["run", "prove:vortex-saas-webhook-projection"],
  },
  {
    label: "Vortex SaaS checkout, catalog, coupon, portal, and lifecycle local proof",
    command: "bun",
    args: ["run", "prove:seal-saas-vortex-local"],
  },
  {
    label: "Seal document payment Vortex local proof",
    command: "bun",
    args: ["run", "prove:seal-document-payment-vortex-local"],
  },
  {
    label: "Seal Vortex hosted outcomes boundary",
    command: "bun",
    args: ["run", "audit:seal-vortex-hosted-outcomes-boundary"],
  },
  {
    label: "Seal Vortex sandbox settlement boundary",
    command: "bun",
    args: ["run", "audit:seal-vortex-sandbox-settlement-boundary"],
  },
  {
    label: "Seal Vortex launch boundary",
    command: "bun",
    args: ["run", "audit:seal-vortex-launch-boundary"],
  },
];

console.log("\n[proof] Human-run Vortex proof scripts are checkout-path portable");
for (const relativePath of portableVortexProofScripts) {
  const contents = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  if (!contents.includes("VORTEX_PAYMENTS_REPO_ROOT")) {
    console.error(`[proof] ${relativePath} does not support VORTEX_PAYMENTS_REPO_ROOT`);
    process.exit(1);
  }
}
console.log("[proof] VORTEX_PAYMENTS_REPO_ROOT support is present on Vortex proof scripts.");

console.log("\n[proof] Local migration gate excludes live and env-mutating proof commands");
const localGateCommands = proofCommands.map((proofCommand) => proofCommand.args.join(" "));
for (const forbiddenScript of localGateForbiddenProofScripts) {
  const included = localGateCommands.some((command) => command.includes(forbiddenScript));
  if (included) {
    console.error(`[proof] ${forbiddenScript} must stay out of prove:seal-vortex-migration-local`);
    process.exit(1);
  }
}
console.log("[proof] Live and env-mutating proof commands stay outside the local gate.");

console.log("\n[proof] Catalog live proof uses Vortex-shaped entitlement safety controls");
for (const relativePath of [
  "scripts/prove-seal-catalog-from-vortex.ts",
  "apps/backend/convex/vortex_billing/proof_actions.ts",
] as const) {
  const contents = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  for (const forbiddenPattern of catalogProofForbiddenPatterns) {
    if (contents.includes(forbiddenPattern)) {
      console.error(
        `[proof] ${relativePath} still contains catalog safety non-Vortex-provider fragment: ${forbiddenPattern}`,
      );
      process.exit(1);
    }
  }
}
console.log("[proof] Catalog safety controls are Vortex-shaped.");

for (const proofCommand of proofCommands) {
  console.log(`\n[proof] ${proofCommand.label}`);
  console.log(`$ ${proofCommand.command} ${proofCommand.args.join(" ")}`);

  const result = spawnSync(proofCommand.command, [...proofCommand.args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    console.error(`[proof] ${proofCommand.label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "seal_vortex_migration_local",
      boundary:
        "Local non-mutating Seal Vortex migration proof only; live card payment, settlement reconciliation, payout proof, production credential mutation, and remote git push remain human-boundary work.",
      proven: [
        "tracked paths contain no retired-provider package or file names",
        "dependency graph and working-tree paths outside .git contain no retired-provider package residue",
        "tracked file contents contain no retired-provider token",
        "working-tree content outside .git contains no provider-shaped retired-provider residue",
        "active guidance and config files contain no retired-provider aliases",
        "account creation, merchant onboarding guards, and billing/payments/merchant settings use Vortex naming and actions",
        "SaaS checkout, catalog price resolution, coupon application, portal links, lifecycle guards, and webhook projection are Vortex-backed locally",
        "document payment creation and hosted outcome projection are Vortex-backed locally",
        "checked-in hosted outcome proof preserves paid capture, failed recovery, dunning, and settlement-boundary evidence",
        "operational payment surfaces and backend adapter seams route through Vortex-owned APIs",
        "human-run Vortex proof scripts support VORTEX_PAYMENTS_REPO_ROOT for portable checkout layouts",
        "live and env-mutating proof commands are excluded from the local non-mutating gate",
        "catalog live proof seeds Vortex-shaped entitlement safety controls only",
        "sandbox settlement handoff preserves captured Vortex ids and human-run proof commands",
        "launch boundary reports launchReady false until human settlement proof and production configuration are complete",
      ],
    },
    null,
    2,
  ),
);
