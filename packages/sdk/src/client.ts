export interface SealClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

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
}

export function createSealClient(options?: SealClientOptions): SealClient {
  return new SealClient(options);
}
