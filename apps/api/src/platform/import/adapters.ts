export interface ImportItem {
  title: string;
  fileName: string;
  contentType?: string;
  size?: number;
  storageKey?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportBatch {
  items: ImportItem[];
  processedCount: number;
  totalCount: number;
  nextCursor: string | null;
}

export interface ImportPayload {
  files?: Array<{
    fileName: string;
    contentType?: string;
    size?: number;
    storageKey?: string;
    metadata?: Record<string, unknown>;
  }>;
  credentials?: Record<string, string>;
  options?: Record<string, unknown>;
}

const BATCH_SIZE = 2;

export function getSupportedAdapters(): string[] {
  return ["pdf", "docusign", "pandadoc"];
}

function parsePayload(payload: unknown): ImportPayload {
  if (typeof payload !== "string" && typeof payload !== "object") {
    throw new Error("import payload must be an object or JSON string");
  }

  const parsed: unknown =
    typeof payload === "string" ? JSON.parse(payload) : payload;

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("import payload must be an object");
  }

  return parsed as ImportPayload;
}

function pdfAdapter(payload: unknown, cursor: string | null): ImportBatch {
  const { files = [] } = parsePayload(payload);
  if (!Array.isArray(files)) {
    throw new Error("pdf adapter requires payload.files to be an array");
  }

  const offset = cursor ? Number(cursor) : 0;
  if (Number.isNaN(offset) || offset < 0) {
    throw new Error("invalid resume cursor");
  }

  const batch = files.slice(offset, offset + BATCH_SIZE);
  const items: ImportItem[] = batch.map((file) => ({
    title: file.fileName.replace(/\.pdf$/i, ""),
    fileName: file.fileName,
    contentType: file.contentType ?? "application/pdf",
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
