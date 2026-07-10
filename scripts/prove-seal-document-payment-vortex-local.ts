import { spawnSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url).pathname;

type ProofCommand = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const proofCommands: readonly ProofCommand[] = [
  {
    label: "Vortex document payment creation stores Vortex ids without non-Vortex provider ids",
    command: "bun",
    args: [
      "run",
      "--cwd",
      "apps/backend",
      "test",
      "convex/vortex_billing/__tests__/document_payable_local_proof.test.ts",
    ],
  },
  {
    label: "Vortex payable webhook projection updates Seal document payment state",
    command: "bun",
    args: [
      "run",
      "--cwd",
      "apps/backend",
      "test",
      "convex/vortex_billing/__tests__/webhook_projection.test.ts",
    ],
  },
  {
    label: "Vortex operational payments adoption guard",
    command: "bun",
    args: ["run", "prove:vortex-operational-payments-adoption"],
  },
  {
    label: "Vortex Payments backend adapter adoption guard",
    command: "bun",
    args: ["run", "prove:vortex-payments-backend-adapter-adoption"],
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

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "seal_document_payment_vortex_local",
      boundary:
        "Local Seal-side document payment proof only; live sandbox card payment, platform-fee movement, settlements, and payouts still require live proof.",
      proven: [
        "document payment creation stores Vortex payable/payment request ids for one-time, recurring, installments, and deposit/balance without non-Vortex provider ids",
        "payable_object.updated paid projection marks document payment paid and completes waiting document without non-Vortex provider ids",
        "payable_object.updated failed projection marks document payment failed and starts dunning without non-Vortex provider ids",
        "unknown payable ids are ignored without webhook dedupe rows",
        "document payment object creation uses Vortex-owned payment link naming",
        "operational payment surfaces use Vortex components instead of non-Vortex Connect embeds",
        "backend payment adapters use Vortex public API/SDK seams without direct provider imports or credentials",
      ],
    },
    null,
    2,
  ),
);
