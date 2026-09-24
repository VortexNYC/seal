export interface SealClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function guessContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SealClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private fetchImpl: typeof fetch;

  constructor({
    baseUrl = "https://api.seal.nyc",
    apiKey,
    fetchImpl = fetch,
  }: SealClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async request(
    method: HttpMethod,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    if (!VALID_METHODS.includes(method)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }

    const url = new URL(path, this.baseUrl).toString();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await this.fetchImpl(url, init);
    const text = await res.text();

    if (!res.ok) {
      const error = text
        ? (JSON.parse(text) as unknown)
        : { status: res.status, statusText: res.statusText };
      throw new Error(`Seal API ${res.status}: ${JSON.stringify(error)}`);
    }

    return text ? (JSON.parse(text) as unknown) : undefined;
  }

  /**
   * Upload a document file: generate-url → binary POST → storage_id.
   * Returns snake_case storage_id for create-document bodies.
   */
  async upload(
    bytes: Uint8Array,
    options?: { filename?: string; contentType?: string }
  ): Promise<{ storage_id: string; content_type: string }> {
    const contentType =
      options?.contentType ??
      (options?.filename
        ? guessContentType(options.filename)
        : "application/pdf");

    const generated = await this.request(
      "POST",
      "/api/v1/uploads/generate-url",
      {}
    );
    if (!isRecord(generated) || typeof generated.upload_url !== "string") {
      throw new Error("Seal API: generate-url missing upload_url");
    }

    const uploadUrl = generated.upload_url;
    const body = Uint8Array.from(bytes);
    const res = await this.fetchImpl(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Seal upload ${res.status}: ${text || res.statusText}`);
    }

    const parsed: unknown = text ? JSON.parse(text) : {};
    if (!isRecord(parsed)) {
      throw new Error("Seal upload: unexpected response");
    }
    const storageId =
      (typeof parsed.storage_id === "string" && parsed.storage_id) ||
      (typeof parsed.storageId === "string" && parsed.storageId) ||
      (typeof parsed.id === "string" && parsed.id) ||
      (typeof parsed.key === "string" && parsed.key) ||
      "";
    if (!storageId) {
      throw new Error(`Seal upload: no storage_id in ${text}`);
    }

    return { storage_id: storageId, content_type: contentType };
  }
}

export function createSealClient(options?: SealClientOptions): SealClient {
  return new SealClient(options);
}
