import { eq } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { documents, importJobs } from "../../global/schema.js";
import { fetchImportBatch, type ImportItem } from "./adapters.js";

export interface ImportRunResult {
  publicId: string;
  status: string;
  processedCount: number;
  totalCount: number | null;
  cursor: string | null;
  error: string | null;
}

export async function runImportJob(
  env: CloudflareBindings,
  publicId: string,
  organizationId: string
): Promise<ImportRunResult> {
  const db = createD1(env.D1);

  const job = await db.query.importJobs.findFirst({
    where: eq(importJobs.publicId, publicId),
  });

  if (!job) {
    throw new Error("import job not found");
  }

  if (job.organizationId !== organizationId) {
    throw new Error("import job does not belong to this organization");
  }

  if (job.status === "completed" || job.status === "failed") {
    throw new Error(`import job is already ${job.status}`);
  }

  if (job.status === "pending_approval") {
    throw new Error("import job must be approved before running");
  }

  const batch = fetchImportBatch(job.adapter, job.payload, job.cursor ?? null);

  const docs = batch.items.map((item: ImportItem) => ({
    id: crypto.randomUUID(),
    publicId: crypto.randomUUID(),
    organizationId: job.organizationId,
    ownerId: job.createdBy,
    name: item.title,
    description: `Imported via ${job.adapter} from ${item.fileName}`,
    status: "draft",
    contentType: item.contentType ?? null,
    size: item.size ?? null,
    storageKey: item.storageKey ?? null,
  }));

  if (docs.length > 0) {
    await db.insert(documents).values(docs);
  }

  const nextStatus = batch.nextCursor === null ? "completed" : "running";

  await db
    .update(importJobs)
    .set({
      cursor: batch.nextCursor,
      processedCount: batch.processedCount,
      totalCount: batch.totalCount,
      status: nextStatus,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(importJobs.publicId, publicId));

  return {
    publicId,
    status: nextStatus,
    processedCount: batch.processedCount,
    totalCount: batch.totalCount,
    cursor: batch.nextCursor,
    error: null,
  };
}
