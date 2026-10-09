import { describe, expect, it, vi } from "vitest";

import { syncVortexOrderForm } from "./vortex-order-form.js";

const env = {
  VORTEX_API_KEY: "vp_test",
  VORTEX_API_BASE_URL: "https://api.vortex.test",
};

function dbWith(row: {
  id: string;
  publicId: string;
  vortexOrderFormId: string | null;
  vortexOrderId: string | null;
}) {
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [row],
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
  };
  return { db, updates };
}

describe("syncVortexOrderForm", () => {
  it("does nothing without an API key", async () => {
    const fetchImpl = vi.fn();
    const { db } = dbWith({
      id: "doc_1",
      publicId: "pub_1",
      vortexOrderFormId: "of_1",
      vortexOrderId: null,
    });
    await syncVortexOrderForm(
      db as never,
      {},
      { documentId: "doc_1", phase: "sent" },
      fetchImpl as never
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("registers the document id as the signature request on send", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("{}", { status: 200 });
    });
    const { db } = dbWith({
      id: "doc_1",
      publicId: "pub_1",
      vortexOrderFormId: "of_1",
      vortexOrderId: null,
    });
    await syncVortexOrderForm(
      db as never,
      env,
      { documentId: "doc_1", phase: "sent" },
      fetchImpl as never
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api.vortex.test/v1/order-forms/of_1/signature-request"
    );
    expect(init.headers).toMatchObject({
      authorization: "Bearer vp_test",
      "idempotency-key": "seal-sigreq-doc_1",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      signatureRequestRef: "doc_1",
    });
  });

  it("signs and executes on completion", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith("/sign")) {
        return new Response(
          JSON.stringify({ data: { order: { orderId: "ordr_9" } } }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    const { db, updates } = dbWith({
      id: "doc_1",
      publicId: "pub_1",
      vortexOrderFormId: "of_1",
      vortexOrderId: null,
    });
    await syncVortexOrderForm(
      db as never,
      env,
      { documentId: "doc_1", phase: "completed" },
      fetchImpl as never
    );
    expect(updates).toEqual([
      expect.objectContaining({ vortexOrderId: "ordr_9" }),
    ]);
    const modeCall = fetchImpl.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(modeCall[0]).toBe("https://api.vortex.test/v1/orders/ordr_9");
    expect(modeCall[1].method).toBe("PATCH");
    const executeCall = fetchImpl.mock.calls[2] as unknown as [
      string,
      RequestInit,
    ];
    expect(executeCall[0]).toBe(
      "https://api.vortex.test/v1/orders/ordr_9/execute"
    );
    expect(JSON.parse(String(executeCall[1].body))).toEqual({
      idempotencyKey: "seal-exec-doc_1",
    });
  });
});
