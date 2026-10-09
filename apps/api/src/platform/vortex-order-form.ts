import { eq } from "drizzle-orm";

import type { createD1 } from "../global/db.js";
import { documents } from "../global/schema.js";

export interface VortexOrderFormEnv {
  VORTEX_API_KEY?: string;
  VORTEX_API_BASE_URL?: string;
}

const DEFAULT_BASE_URL = "https://api.vortex.nyc";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function orderIdFromSignBody(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const data = isRecord(body.data) ? body.data : body;
  if (isRecord(data.order) && typeof data.order.orderId === "string") {
    return data.order.orderId;
  }
  if (typeof data.orderId === "string") return data.orderId;
  return null;
}

async function vortexFetch(
  env: VortexOrderFormEnv,
  path: string,
  idempotencyKey: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const apiKey = env.VORTEX_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, body: null };
  }
  const base = (env.VORTEX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetchImpl(`${base}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }
  return { ok: response.ok, status: response.status, body: parsed };
}

/**
 * Register, sign, and execute a Vortex order form linked to a Seal document.
 * Signing completion never depends on this call succeeding.
 */
export async function syncVortexOrderForm(
  db: ReturnType<typeof createD1>,
  env: VortexOrderFormEnv,
  input: { documentId: string; phase: "sent" | "completed" },
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!env.VORTEX_API_KEY) return;

  const rows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
      vortexOrderFormId: documents.vortexOrderFormId,
      vortexOrderId: documents.vortexOrderId,
    })
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  const doc = rows[0];
  if (!doc?.vortexOrderFormId) return;

  try {
    if (input.phase === "sent") {
      const registered = await vortexFetch(
        env,
        `/v1/order-forms/${encodeURIComponent(doc.vortexOrderFormId)}/signature-request`,
        `seal-sigreq-${doc.id}`,
        { signatureRequestRef: doc.id },
        fetchImpl
      );
      if (!registered.ok && registered.status !== 409) {
        console.error(
          "[vortex] signature-request failed:",
          doc.id,
          registered.status
        );
      }
      return;
    }

    let orderId = doc.vortexOrderId;
    if (!orderId) {
      const signed = await vortexFetch(
        env,
        `/v1/order-forms/${encodeURIComponent(doc.vortexOrderFormId)}/sign`,
        `seal-sign-${doc.id}`,
        {
          signatureRequestRef: doc.id,
          signedDocumentRef: doc.publicId,
          executionMode: "execute_in_vortex",
        },
        fetchImpl
      );
      orderId = orderIdFromSignBody(signed.body);
      if (!orderId) {
        console.error("[vortex] sign failed:", doc.id, signed.status);
        return;
      }
      await db
        .update(documents)
        .set({ vortexOrderId: orderId, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }

    const executed = await vortexFetch(
      env,
      `/v1/orders/${encodeURIComponent(orderId)}/execute`,
      `seal-exec-${doc.id}`,
      { idempotencyKey: `seal-exec-${doc.id}` },
      fetchImpl
    );
    if (!executed.ok && executed.status !== 409) {
      console.error("[vortex] execute failed:", doc.id, executed.status);
    }
  } catch (err) {
    console.error("[vortex] order form sync failed:", doc.id, err);
  }
}
