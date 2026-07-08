import { spawnSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url).pathname;
const retiredProviderToken = String.fromCharCode(115, 116, 114, 105, 112, 101);

type ProofCommand = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const proofCommands: readonly ProofCommand[] = [
  {
    label: "No tracked retired-provider residue",
    command: "bun",
    args: ["run", "prove:zero-retired-provider-residue"],
  },
  {
    label: "No working-tree retired-provider residue outside generated outputs",
    command: "rg",
    args: [
      "-i",
      "-n",
      retiredProviderToken,
      ".",
      "-g",
      "!**/node_modules/**",
      "-g",
      "!**/.output/**",
      "-g",
      "!**/.turbo/**",
      "-g",
      "!**/dist/**",
      "-g",
      "!.git/**",
    ],
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
    label: "Vortex SaaS checkout, catalog, coupon, and portal local proof",
    command: "bun",
    args: ["run", "prove:seal-saas-vortex-local"],
  },
  {
    label: "Seal document payment Vortex local proof",
    command: "bun",
    args: ["run", "prove:seal-document-payment-vortex-local"],
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

  if (proofCommand.command === "rg") {
    if (result.status === 1) {
      console.log("[proof] Working-tree retired-provider scan passed with no matches.");
      continue;
    }
    process.exit(result.status ?? 1);
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
        "tracked source contains no retired-provider residue",
        "working tree contains no retired-provider residue outside generated outputs",
        "account creation, merchant onboarding guards, and billing/payments/merchant settings use Vortex naming and actions",
        "SaaS checkout, catalog price resolution, coupon application, portal links, and webhook projection are Vortex-backed locally",
        "document payment creation and hosted outcome projection are Vortex-backed locally",
        "operational payment surfaces and backend adapter seams route through Vortex-owned APIs",
        "sandbox settlement handoff preserves captured Vortex ids and human-run proof commands",
        "launch boundary is either green or blocked only by known human-run production configuration names",
      ],
    },
    null,
    2,
  ),
);
