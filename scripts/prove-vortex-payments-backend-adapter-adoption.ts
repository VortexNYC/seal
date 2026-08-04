import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type RequiredFragment = {
  readonly path: string;
  readonly fragments: readonly string[];
};

const repoRoot = new URL("..", import.meta.url).pathname;
const backendRoot = join(repoRoot, "apps/backend");
const backendPackagePath = join(backendRoot, "package.json");
const backendConvexRoot = join(backendRoot, "convex");
const backendScriptsRoot = join(backendRoot, "scripts");

const forbiddenPackageNameFragments = ["finix", "payments-provider"] as const;
const forbiddenRuntimeFragments = [
  "FINIX_",
  "api.finix",
  "finix.com",
  "payments-provider",
] as const;

// Adapter boundary is now the published typed SDK: assert each backend module drives Vortex
// Billing through @vortexnyc/payments-sdk functions, not a bespoke HTTP wrapper or literal paths.
const requiredFragments: readonly RequiredFragment[] = [
  {
    path: "apps/backend/convex/vortex_billing/payable_actions.ts",
    fragments: [
      'from "@vortexnyc/payments-sdk"',
      "createPayable",
      "createRecurringPayable",
      "createInstallmentPayable",
      "createDepositBalancePayable",
    ],
  },
  {
    path: "apps/backend/convex/payments/vortex_billing_processor.ts",
    fragments: [
      'from "@vortexnyc/payments-sdk"',
      "createClient",
      "createCheckoutSession",
      "listCoupons",
      "applyCoupon",
      "getCustomerEntitlements",
    ],
  },
  {
    path: "apps/backend/convex/payments/vortex_merchant_actions.ts",
    fragments: [
      'from "@vortexnyc/payments-sdk"',
      "createMerchantAccount",
      "getMerchantAccountState",
      "getMerchantAccountSettlements",
      "createMerchantOnboardingLink",
      "readRemoteVortexMerchantPayoutData",
    ],
  },
  {
    path: "apps/backend/convex/vortex_billing/catalog_sync.ts",
    fragments: ['from "@vortexnyc/payments-sdk"', "getV1CatalogExact"],
  },
  {
    path: "apps/backend/scripts/seed-vortex-saas-catalog.ts",
    fragments: [
      'from "@vortexnyc/payments-sdk"',
      "createProduct",
      "createPrice",
    ],
  },
];

const failures: string[] = [];
const backendPackage = JSON.parse(readFileSync(backendPackagePath, "utf8")) as {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
};

for (const dependencyName of dependencyNames(backendPackage)) {
  const normalized = dependencyName.toLowerCase();
  if (
    forbiddenPackageNameFragments.some((fragment) =>
      normalized.includes(fragment)
    )
  ) {
    failures.push(
      `apps/backend/package.json must not depend on direct provider package ${dependencyName}`
    );
  }
}

for (const sourcePath of [
  ...collectFiles(backendConvexRoot, /\.(ts|tsx)$/),
  ...collectFiles(backendScriptsRoot, /\.ts$/),
]) {
  const source = readFileSync(sourcePath, "utf8");
  const withoutComments = stripComments(source);
  const relativePath = relative(repoRoot, sourcePath);

  for (const importSpecifier of readImportSpecifiers(withoutComments)) {
    const normalized = importSpecifier.toLowerCase();
    if (
      forbiddenPackageNameFragments.some((fragment) =>
        normalized.includes(fragment)
      )
    ) {
      failures.push(
        `${relativePath} imports direct provider package ${importSpecifier}`
      );
    }
  }

  if (relativePath.startsWith("apps/backend/convex/")) {
    for (const forbiddenFragment of forbiddenRuntimeFragments) {
      if (withoutComments.includes(forbiddenFragment)) {
        failures.push(
          `${relativePath} contains direct provider runtime fragment ${forbiddenFragment}`
        );
      }
    }
  }

  if (
    isVortexAdapterPath(relativePath) &&
    /fetch\(\s*["']https?:\/\//.test(withoutComments)
  ) {
    failures.push(
      `${relativePath} must not call raw external URLs; use Vortex API helpers/SDK seams`
    );
  }
}

for (const required of requiredFragments) {
  const source = readFileSync(join(repoRoot, required.path), "utf8");
  for (const fragment of required.fragments) {
    if (!source.includes(fragment)) {
      failures.push(
        `${required.path} missing required Vortex backend adapter fragment: ${fragment}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Vortex Payments backend adapter adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex Payments backend adapter adoption proof passed:");
console.log(
  "- Seal backend has no direct provider package dependency or import."
);
console.log(
  "- Seal Convex runtime has no direct provider credential or host fragment."
);
console.log(
  "- SaaS checkout and SaaS catalog use Vortex SDK/public API surfaces."
);
console.log(
  "- Merchant, payout, settlement, and document payable paths use Vortex public API helpers."
);

function dependencyNames(input: {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}): readonly string[] {
  return [
    ...Object.keys(input.dependencies ?? {}),
    ...Object.keys(input.devDependencies ?? {}),
    ...Object.keys(input.peerDependencies ?? {}),
    ...Object.keys(input.optionalDependencies ?? {}),
  ];
}

function collectFiles(root: string, pattern: RegExp): readonly string[] {
  const rootStat = statSync(root, { throwIfNoEntry: false });
  if (rootStat === undefined) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, pattern));
      continue;
    }
    if (entry.isFile() && pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readImportSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const fromImportPattern = /\bfrom\s+["']([^"']+)["']/g;
  const sideEffectImportPattern = /\bimport\s+["']([^"']+)["']/g;

  for (const match of source.matchAll(fromImportPattern)) {
    const specifier = match[1];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  for (const match of source.matchAll(sideEffectImportPattern)) {
    const specifier = match[1];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function isVortexAdapterPath(relativePath: string): boolean {
  return (
    relativePath.startsWith("apps/backend/convex/vortex_billing/") ||
    relativePath ===
      "apps/backend/convex/payments/vortex_billing_processor.ts" ||
    relativePath === "apps/backend/convex/payments/vortex_merchant_actions.ts"
  );
}
