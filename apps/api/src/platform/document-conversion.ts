/**
 * Document conversion helpers for turning DOCX/XLSX/PPTX/CSV into
 * fixed-layout PDFs via the seal-convert-worker service binding.
 */

export const CONVERTIBLE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
]);

const EXTENSIONS: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/csv": ".csv",
};

export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly detail?: string
  ) {
    super(message);
  }
}

export interface ConvertInput {
  contentType: string;
  bytes: ArrayBuffer | Uint8Array;
  name: string;
}

export function isConvertibleFileType(contentType: string): boolean {
  return EXTENSIONS[contentType] !== undefined;
}

export function getConvertibleFileExtension(
  contentType: string
): string | undefined {
  return EXTENSIONS[contentType];
}

export async function convertBytesToPdf(
  env: CloudflareBindings,
  input: ConvertInput
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const extension = EXTENSIONS[input.contentType];
  if (!extension) {
    throw new ConversionError(
      "unsupported_file_type",
      400,
      `No conversion handler for ${input.contentType}`
    );
  }

  // File/Blob reject Uint8Array<ArrayBufferLike> under TS 5.7+.
  const file = new File(
    [new Uint8Array(input.bytes)],
    `${input.name}${extension}`,
    {
      type: input.contentType,
    }
  );

  const form = new FormData();
  form.append("files", file);

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/convert", {
      method: "POST",
      body: form,
      headers: {
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "conversion_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}

export interface OptimizePdfInput {
  bytes: ArrayBuffer | Uint8Array;
  imageQuality?: number;
}

/**
 * Re-encode a draft PDF's images via the convert-worker's Gotenberg
 * pdfengines /optimize route. Text, vectors, fonts, and structure survive;
 * the engine never enlarges the file.
 */
export async function optimizePdfBytes(
  env: CloudflareBindings,
  input: OptimizePdfInput
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const file = new File([new Uint8Array(input.bytes)], "document.pdf", {
    type: "application/pdf",
  });
  const form = new FormData();
  form.append("files", file);
  if (input.imageQuality !== undefined) {
    form.append("imageQuality", String(input.imageQuality));
  }

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/optimize-pdf", {
      method: "POST",
      body: form,
      headers: {
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "compress_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}

export interface EncryptPdfInput {
  bytes: ArrayBuffer | Uint8Array;
  userPassword?: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
  allowAnnotating?: boolean;
  allowFillingForms?: boolean;
  allowAssembling?: boolean;
}

/** Encrypt a PDF via convert-worker (Gotenberg pdfengines /encrypt). */
export async function encryptPdfBytes(
  env: CloudflareBindings,
  input: EncryptPdfInput
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const file = new File([new Uint8Array(input.bytes)], "document.pdf", {
    type: "application/pdf",
  });
  const form = new FormData();
  form.append("files", file);
  if (input.userPassword) form.append("userPassword", input.userPassword);
  if (input.ownerPassword) form.append("ownerPassword", input.ownerPassword);
  for (const [key, value] of Object.entries({
    allowPrinting: input.allowPrinting,
    allowCopying: input.allowCopying,
    allowModifying: input.allowModifying,
    allowAnnotating: input.allowAnnotating,
    allowFillingForms: input.allowFillingForms,
    allowAssembling: input.allowAssembling,
  })) {
    if (value !== undefined) form.append(key, String(value));
  }

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/encrypt-pdf", {
      method: "POST",
      body: form,
      headers: {
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "encrypt_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}

/** Flatten a PDF via convert-worker (Gotenberg pdfengines /flatten). */
export async function flattenPdfBytes(
  env: CloudflareBindings,
  bytes: ArrayBuffer | Uint8Array
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const file = new File([new Uint8Array(bytes)], "document.pdf", {
    type: "application/pdf",
  });
  const form = new FormData();
  form.append("files", file);

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/flatten-pdf", {
      method: "POST",
      body: form,
      headers: {
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "flatten_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}

/** Rasterise a PDF to per-page images; returns a ZIP of page-*.{png,jpg}. */
export async function pdfToImagesZip(
  env: CloudflareBindings,
  input: { bytes: ArrayBuffer | Uint8Array; format?: "png" | "jpeg"; dpi?: number }
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const format = input.format === "jpeg" ? "jpeg" : "png";
  const dpi = Math.max(50, Math.min(600, Math.round(input.dpi ?? 150)));
  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request(
      `http://internal/pdf-to-images?format=${format}&dpi=${dpi}`,
      {
        method: "POST",
        body: new Uint8Array(input.bytes),
        headers: {
          "Content-Type": "application/pdf",
          "x-internal-api-key": env.INTERNAL_API_KEY,
        },
      }
    )
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "export_images_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}

/** Decrypt a password-protected PDF via convert-worker (LibreOffice roundtrip). */
export async function decryptPdfBytes(
  env: CloudflareBindings,
  input: { bytes: ArrayBuffer | Uint8Array; password: string }
): Promise<ArrayBuffer> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const file = new File([new Uint8Array(input.bytes)], "document.pdf", {
    type: "application/pdf",
  });
  const form = new FormData();
  form.append("files", file);
  form.append("password", input.password);

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/decrypt-pdf", {
      method: "POST",
      body: form,
      headers: {
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "decrypt_failed",
      response.status === 400 ? 400 : response.status === 504 ? 504 : 502,
      text
    );
  }

  return response.arrayBuffer();
}
