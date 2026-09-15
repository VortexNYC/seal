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
  env: { SEAL_CONVERT_WORKER?: Fetcher },
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

  const file = new File([input.bytes], `${input.name}${extension}`, {
    type: input.contentType,
  });

  const form = new FormData();
  form.append("files", file);

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/convert", {
      method: "POST",
      body: form,
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
