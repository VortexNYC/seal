import { eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documentInvoices,
  documents,
  paymentFieldConfigs,
  vortexBillingWebhookEvents,
} from "../global/schema.js";

type PaymentStatus =
  | "pending"
  | "created"
  | "awaiting"
  | "paid"
  | "failed"
  | "cancelled";

type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible" | "deleted";

export interface ProjectPayableObjectInput {
  eventId: string;
  payableId: string;
  status: "paid" | "failed" | "awaiting_payment";
  paymentRequestId?: string;
  hostedInvoiceUrl?: string;
}

export interface ProjectPayableObjectResult {
  processed: boolean;
  duplicate: boolean;
  ignored: boolean;
  payableId: string;
}

function paymentStatusForPayableStatus(
  status: "paid" | "failed" | "awaiting_payment"
): PaymentStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "awaiting_payment":
      return "awaiting";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unsupported payable status: ${String(_exhaustive)}`);
    }
  }
}

function invoiceStatusForPayableStatus(
  status: "paid" | "failed" | "awaiting_payment"
): InvoiceStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "uncollectible";
    case "awaiting_payment":
      return "open";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unsupported payable status: ${String(_exhaustive)}`);
    }
  }
}

function shouldSkipTerminalInvoiceUpdate(
  currentStatus: InvoiceStatus,
  incomingStatus: InvoiceStatus
): boolean {
  const terminalStatuses = new Set<InvoiceStatus>(["paid", "void", "deleted"]);
  return (
    terminalStatuses.has(currentStatus) && incomingStatus !== currentStatus
  );
}

function shouldSkipTerminalConfigUpdate(
  currentStatus: PaymentStatus,
  incomingStatus: PaymentStatus
): boolean {
  const terminalStatuses = new Set<PaymentStatus>(["paid", "cancelled"]);
  return (
    terminalStatuses.has(currentStatus) && !terminalStatuses.has(incomingStatus)
  );
}

function shouldIgnoreTerminalPayableProjection({
  currentInvoiceStatus,
  currentPaymentStatus,
  incomingInvoiceStatus,
  incomingPaymentStatus,
}: {
  currentInvoiceStatus: InvoiceStatus | null;
  currentPaymentStatus: PaymentStatus | null;
  incomingInvoiceStatus: InvoiceStatus;
  incomingPaymentStatus: PaymentStatus;
}): boolean {
  if (currentInvoiceStatus) {
    if (
      shouldSkipTerminalInvoiceUpdate(
        currentInvoiceStatus,
        incomingInvoiceStatus
      )
    ) {
      return true;
    }
  } else if (currentPaymentStatus) {
    if (
      shouldSkipTerminalConfigUpdate(
        currentPaymentStatus,
        incomingPaymentStatus
      )
    ) {
      return true;
    }
  }
  return false;
}

function documentInvoicePatch(
  invoice: typeof documentInvoices.$inferSelect,
  invoiceStatus: InvoiceStatus,
  now: Date
) {
  return {
    status: invoiceStatus,
    ...(invoiceStatus === "paid" && { paidAt: now }),
    ...(invoiceStatus === "void" && { voidedAt: now }),
    ...(invoiceStatus === "open" &&
      !invoice.finalizedAt && { finalizedAt: now }),
    updatedAt: now,
  };
}

async function patchPayableLineage(
  db: ReturnType<typeof createD1>,
  input: {
    configId: string | undefined;
    invoiceRecordId: string | undefined;
    paymentRequestId: string | undefined;
    hostedInvoiceUrl: string | undefined;
    now: Date;
  }
) {
  const patch = {
    ...(input.paymentRequestId !== undefined && {
      vortexPaymentRequestId: input.paymentRequestId,
    }),
    ...(input.hostedInvoiceUrl !== undefined && {
      hostedInvoiceUrl: input.hostedInvoiceUrl,
    }),
    updatedAt: input.now,
  };

  if (
    input.paymentRequestId === undefined &&
    input.hostedInvoiceUrl === undefined
  ) {
    return;
  }

  if (input.configId !== undefined) {
    await db
      .update(paymentFieldConfigs)
      .set(patch)
      .where(eq(paymentFieldConfigs.id, input.configId));
  }

  if (input.invoiceRecordId !== undefined) {
    await db
      .update(documentInvoices)
      .set(patch)
      .where(eq(documentInvoices.id, input.invoiceRecordId));
  }
}

async function cancelInvoiceDunning(
  db: ReturnType<typeof createD1>,
  invoiceId: string,
  now: Date
) {
  const invoice = await db
    .select()
    .from(documentInvoices)
    .where(eq(documentInvoices.id, invoiceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!invoice || invoice.dunningStatus !== "active") {
    return;
  }

  await db
    .update(documentInvoices)
    .set({
      dunningStatus: "cancelled",
      dunningCompletedAt: now,
      nextDunningAt: null,
      updatedAt: now,
    })
    .where(eq(documentInvoices.id, invoiceId));
}

async function startInvoiceDunning(
  db: ReturnType<typeof createD1>,
  invoiceId: string,
  now: Date
) {
  const invoice = await db
    .select()
    .from(documentInvoices)
    .where(eq(documentInvoices.id, invoiceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!invoice) return false;

  if (
    invoice.dunningStatus === "active" ||
    invoice.dunningStatus === "completed" ||
    invoice.dunningStatus === "cancelled"
  ) {
    return false;
  }

  if (invoice.status !== "open" && invoice.status !== "uncollectible") {
    return false;
  }

  await db
    .update(documentInvoices)
    .set({
      dunningStatus: "active",
      dunningStep: 0,
      dunningStartedAt: now,
      nextDunningAt: now,
      updatedAt: now,
    })
    .where(eq(documentInvoices.id, invoiceId));

  return true;
}

async function finalizeDocumentIfPaymentComplete(
  db: ReturnType<typeof createD1>,
  documentId: string,
  now: Date
) {
  const document = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!document || document.workflowStatus !== "waiting_for_payment") {
    return;
  }

  const configs = await db
    .select({ paymentStatus: paymentFieldConfigs.paymentStatus })
    .from(paymentFieldConfigs)
    .where(eq(paymentFieldConfigs.documentId, documentId));

  const allPaid = configs.every(
    (c) => c.paymentStatus === "paid" || c.paymentStatus === "cancelled"
  );

  if (allPaid) {
    await db
      .update(documents)
      .set({
        workflowStatus: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(documents.id, documentId));
  }
}

export async function projectPayableObjectUpdated(
  env: { D1: D1Database },
  input: ProjectPayableObjectInput
): Promise<ProjectPayableObjectResult> {
  const db = createD1(env.D1);
  const now = new Date();

  const existing = await db
    .select()
    .from(vortexBillingWebhookEvents)
    .where(eq(vortexBillingWebhookEvents.eventId, input.eventId))
    .limit(1);

  if (existing.length > 0) {
    return {
      processed: false,
      duplicate: true,
      ignored: false,
      payableId: input.payableId,
    };
  }

  const [config] = await db
    .select()
    .from(paymentFieldConfigs)
    .where(eq(paymentFieldConfigs.vortexPayableId, input.payableId))
    .limit(1);

  const [invoiceRecord] = await db
    .select()
    .from(documentInvoices)
    .where(eq(documentInvoices.vortexPayableId, input.payableId))
    .limit(1);

  if (!config && !invoiceRecord) {
    return {
      processed: false,
      duplicate: false,
      ignored: true,
      payableId: input.payableId,
    };
  }

  const paymentStatus = paymentStatusForPayableStatus(input.status);
  const invoiceStatus = invoiceStatusForPayableStatus(input.status);

  if (
    shouldIgnoreTerminalPayableProjection({
      currentInvoiceStatus: (invoiceRecord?.status ?? null) as InvoiceStatus | null,
      currentPaymentStatus: (config?.paymentStatus ?? null) as PaymentStatus | null,
      incomingInvoiceStatus: invoiceStatus,
      incomingPaymentStatus: paymentStatus,
    })
  ) {
    await db.insert(vortexBillingWebhookEvents).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      eventType: "payable_object.updated",
      processedAt: now,
    });

    return {
      processed: false,
      duplicate: false,
      ignored: true,
      payableId: input.payableId,
    };
  }

  if (config) {
    await db
      .update(paymentFieldConfigs)
      .set({ paymentStatus, updatedAt: now })
      .where(eq(paymentFieldConfigs.id, config.id));
  }

  if (invoiceRecord && invoiceStatus) {
    const patch = documentInvoicePatch(invoiceRecord, invoiceStatus, now);
    await db
      .update(documentInvoices)
      .set(patch)
      .where(eq(documentInvoices.id, invoiceRecord.id));
  }

  await patchPayableLineage(db, {
    configId: config?.id,
    invoiceRecordId: invoiceRecord?.id,
    paymentRequestId: input.paymentRequestId,
    hostedInvoiceUrl: input.hostedInvoiceUrl,
    now,
  });

  if (input.status === "paid") {
    if (invoiceRecord) {
      await cancelInvoiceDunning(db, invoiceRecord.id, now);
    }
    const documentId = config?.documentId ?? invoiceRecord?.documentId;
    if (documentId) {
      await finalizeDocumentIfPaymentComplete(db, documentId, now);
    }
  } else if (input.status === "failed" && invoiceRecord) {
    await startInvoiceDunning(db, invoiceRecord.id, now);
  }

  await db.insert(vortexBillingWebhookEvents).values({
    id: crypto.randomUUID(),
    eventId: input.eventId,
    eventType: "payable_object.updated",
    processedAt: now,
  });

  return {
    processed: true,
    duplicate: false,
    ignored: false,
    payableId: input.payableId,
  };
}
