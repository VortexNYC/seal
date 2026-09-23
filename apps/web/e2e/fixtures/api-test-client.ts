import { readFileSync } from "node:fs";

import { type APIRequestContext, type APIResponse } from "@playwright/test";

import { getTestWorkspaceConfig } from "./auth-helpers";
import { readCachedWorkspaceSlug } from "./workspace-state";

export function getApiBaseUrl(): string {
  const value = process.env.VITE_API_URL?.trim();
  if (!value) {
    throw new Error(
      "VITE_API_URL is not set. E2E tests need the Seal API base URL (e.g. http://localhost:8787)."
    );
  }
  return value.replace(/\/$/, "");
}

function organizationSlug(): string {
  return (
    readCachedWorkspaceSlug() ?? getTestWorkspaceConfig().organizationSlug
  );
}

function documentsBasePath(): string {
  return `/api/documents/${encodeURIComponent(organizationSlug())}`;
}

export type PdfFile = {
  contentBase64: string;
  contentType: string;
  size: number;
};

export async function loadSamplePdf(pdfPath: string): Promise<PdfFile> {
  const bytes = readFileSync(pdfPath);
  return {
    contentBase64: Buffer.from(bytes).toString("base64"),
    contentType: "application/pdf",
    size: bytes.length,
  };
}

async function parseError(response: APIResponse): Promise<string> {
  try {
    const text = await response.text();
    return text || `HTTP ${response.status()}`;
  } catch {
    return `HTTP ${response.status()}`;
  }
}

async function apiRequest<T>(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response: APIResponse = await request.fetch(url, {
    method: method.toUpperCase(),
    headers,
    data: body,
  });

  if (!response.ok()) {
    const error = await parseError(response);
    throw new Error(
      `Seal API ${method.toUpperCase()} ${path} failed (${response.status()}): ${error}`
    );
  }

  const data: T = await response.json();
  return data;
}

export async function createDocument(
  request: APIRequestContext,
  args: { name: string; pdfFile: PdfFile }
): Promise<{
  id: string;
  publicId: string;
  name: string;
  status: string;
}> {
  const created = await apiRequest<{
    id: string;
    publicId: string;
    name: string;
    status: string;
  }>(request, "post", documentsBasePath(), {
    name: args.name,
    fileSize: args.pdfFile.size,
    contentType: args.pdfFile.contentType,
    pageCount: 1,
  });

  await apiRequest<{ storageKey: string; contentType: string; size: number }>(
    request,
    "post",
    `${documentsBasePath()}/${encodeURIComponent(created.publicId)}/upload`,
    {
      contentBase64: args.pdfFile.contentBase64,
      contentType: args.pdfFile.contentType,
    }
  );

  return created;
}

export type ApiRecipient = {
  id: string;
  publicId: string;
  documentId: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  signingToken: string | null;
  signedAt: number | null;
  createdAt: number;
};

export async function addRecipient(
  request: APIRequestContext,
  documentPublicId: string,
  recipient: { email: string; name?: string; role?: string }
): Promise<ApiRecipient> {
  const results = await apiRequest<ApiRecipient[]>(
    request,
    "post",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}/recipients`,
    {
      recipients: [
        {
          email: recipient.email,
          name: recipient.name ?? null,
          role: recipient.role ?? "signer",
        },
      ],
    }
  );

  const first = results[0];
  if (!first) {
    throw new Error("addRecipient returned no recipients");
  }
  return first;
}

export type ApiSignatureField = {
  id: string;
  publicId: string;
  documentId: string;
  recipientId: string | null;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isMainSignature: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  createdAt: number;
};

export async function createSignatureField(
  request: APIRequestContext,
  documentPublicId: string,
  recipientPublicId: string,
  field: {
    fieldType?: string;
    label?: string;
    isRequired?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    page?: number;
  }
): Promise<ApiSignatureField> {
  return apiRequest<ApiSignatureField>(
    request,
    "post",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}/signature-fields`,
    {
      recipientPublicId,
      fieldType: field.fieldType ?? "signature",
      label: field.label ?? "Signature",
      isRequired: field.isRequired ?? true,
      x: field.x ?? 10,
      y: field.y ?? 10,
      width: field.width ?? 30,
      height: field.height ?? 15,
      page: field.page ?? 1,
    }
  );
}

export async function sendDocument(
  request: APIRequestContext,
  documentPublicId: string
): Promise<void> {
  await apiRequest<{ success: boolean }>(
    request,
    "post",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}/send`,
    {}
  );
}

export async function getDocument(
  request: APIRequestContext,
  documentPublicId: string
): Promise<{
  id: string;
  publicId: string;
  name: string;
  status: string;
  workflowStatus: string;
}> {
  return apiRequest(
    request,
    "get",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}`
  );
}

export async function listRecipients(
  request: APIRequestContext,
  documentPublicId: string
): Promise<ApiRecipient[]> {
  return apiRequest(
    request,
    "get",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}/recipients`
  );
}

export type ApiActivity = {
  id: string;
  action: string;
  actorName: string;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: number;
};

export async function listActivity(
  request: APIRequestContext,
  limit = 100
): Promise<ApiActivity[]> {
  return apiRequest<ApiActivity[]>(
    request,
    "get",
    `/api/activity?limit=${limit}`
  );
}

export async function deleteDocument(
  request: APIRequestContext,
  documentPublicId: string
): Promise<void> {
  await apiRequest(
    request,
    "delete",
    `${documentsBasePath()}/${encodeURIComponent(documentPublicId)}`
  );
}

export async function listDocuments(
  request: APIRequestContext,
  filter: "all" | "owned" | "shared" = "all"
): Promise<Array<{ publicId: string; name: string }>> {
  return apiRequest(
    request,
    "get",
    `${documentsBasePath()}?filter=${filter}`
  );
}

export async function assertApiReachability(
  request: APIRequestContext
): Promise<void> {
  const url = `${getApiBaseUrl()}/health`;
  const response = await request.get(url, {
    headers: { Accept: "application/json" },
  });

  if (response.status() >= 500) {
    const text = await response.text().catch(() => "");
    throw new Error(`Seal API unreachable: ${response.status()} ${text}`);
  }
}
