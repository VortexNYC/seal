import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const scannedRoots = ["packages/payments/src", "apps/backend/convex"] as const;

const forbiddenRawPaymentMethodFields = [
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "securityCode",
  "routingNumber",
  "routing_number",
] as const;

function listFiles(root: string): readonly string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...listFiles(path));
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      result.push(path);
    }
  }
  return result;
}

describe("Finix certification guardrails", () => {
  test("customer payment method APIs do not accept raw card or bank routing fields", () => {
    const offenders: string[] = [];
    for (const root of scannedRoots) {
      for (const file of listFiles(root)) {
        if (file.endsWith("finix-certification-guardrails.test.ts")) {
          continue;
        }
        const text = readFileSync(file, "utf8");
        for (const field of forbiddenRawPaymentMethodFields) {
          if (text.includes(field)) {
            offenders.push(`${file}:${field}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
