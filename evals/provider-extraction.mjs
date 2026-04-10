/**
 * Promptfoo provider for payment extraction evals.
 *
 * Reads contract text from evals/corpus/contracts/<id>.txt,
 * calls the /dev/eval/extract-payment endpoint, and returns
 * the JSON result as a string for assertion checking.
 *
 * The `prompt` variable is the contract filename stem (e.g. "01-saas-subscription").
 */

import { readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(__dirname, "corpus/contracts");

const CONVEX_SITE_URL = (() => {
  if (process.env.CONVEX_SITE_URL) return process.env.CONVEX_SITE_URL;
  const envFiles = [
    resolve(__dirname, "../.test-env"),
    resolve(__dirname, "../apps/backend/.env.local"),
    resolve(__dirname, "../apps/backend/.env"),
  ];
  for (const f of envFiles) {
    try {
      const content = readFileSync(f, "utf8");
      const match = content.match(/CONVEX_SITE_URL\s*=\s*(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }
  throw new Error("CONVEX_SITE_URL not found. Set env var or check .test-env");
})();

const ENDPOINT = `${CONVEX_SITE_URL.replace(/\/$/, "")}/dev/eval/extract-payment`;

export default {
  id: "seal-extraction",

  async callApi(prompt, _context) {
    // prompt is the contract stem name e.g. "01-saas-subscription"
    const contractPath = join(CONTRACTS_DIR, `${prompt}.txt`);
    let contractText;
    try {
      contractText = readFileSync(contractPath, "utf8");
    } catch {
      return { error: `Contract file not found: ${contractPath}` };
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractText }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}: ${text}` };
    }

    const result = await res.json();
    return { output: JSON.stringify(result) };
  },
};
