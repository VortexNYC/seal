import { z } from "zod";

const importFileSchema = z.object({
  fileName: z.string(),
  title: z.string().optional(),
  contentType: z.string().default("application/pdf"),
  size: z.number().optional(),
  storageKey: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const importPayloadSchema = z.object({
  files: z.array(importFileSchema).default([]),
  credentials: z.record(z.string(), z.string()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const importItemSchema = z.object({
  title: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  size: z.number().optional(),
  storageKey: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ImportFile = z.infer<typeof importFileSchema>;
export type ImportItem = z.infer<typeof importItemSchema>;
export type ImportBatch = {
  items: ImportItem[];
  processedCount: number;
  totalCount: number;
  nextCursor: string | null;
};
export type ImportPayload = z.infer<typeof importPayloadSchema>;

const BATCH_SIZE = 2;

export function getSupportedAdapters(): string[] {
  return ["pdf", "docusign", "pandadoc"];
}

function parsePayload(payload: unknown): ImportPayload {
  const parsed: unknown =
    typeof payload === "string" ? JSON.parse(payload) : payload;

  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`invalid import payload: ${result.error.message}`);
  }
  return result.data;
}

function pdfAdapter(payload: unknown, cursor: string | null): ImportBatch {
  const { files } = parsePayload(payload);

  const offset = cursor ? Number(cursor) : 0;
  if (Number.isNaN(offset) || offset < 0 || !Number.isInteger(offset)) {
    throw new Error("invalid resume cursor");
  }

  const batch = files.slice(offset, offset + BATCH_SIZE);
  const items: ImportItem[] = batch.map((file) => ({
    title: file.title ?? file.fileName.replace(/\.pdf$/i, ""),
    fileName: file.fileName,
    contentType: file.contentType,
    size: file.size,
    storageKey: file.storageKey,
    metadata: file.metadata,
  }));

  const nextOffset = offset + batch.length;
  return {
    items,
    processedCount: nextOffset,
    totalCount: files.length,
    nextCursor: nextOffset < files.length ? String(nextOffset) : null,
  };
}

function docusignAdapter(): ImportBatch {
  throw new Error(
    "docusign adapter is not yet implemented: configure DocuSign credentials first"
  );
}

function pandadocAdapter(): ImportBatch {
  throw new Error(
    "pandadoc adapter is not yet implemented: configure PandaDoc credentials first"
  );
}

export function fetchImportBatch(
  adapter: string,
  payload: unknown,
  cursor: string | null
): ImportBatch {
  switch (adapter) {
    case "pdf":
      return pdfAdapter(payload, cursor);
    case "docusign":
      return docusignAdapter();
    case "pandadoc":
      return pandadocAdapter();
    default:
      throw new Error(`unknown import adapter: ${adapter}`);
  }
}
