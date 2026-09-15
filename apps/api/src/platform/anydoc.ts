import { z } from "zod";

const parseResultSchema = z.object({
  format: z.string().optional(),
  markdown: z.string().nullable().optional(),
  pageCount: z.number().optional(),
});

export async function parseDocumentFromStorage(
  env: CloudflareBindings,
  storageKey: string
): Promise<{
  format: string;
  markdown: string | null;
  pageCount: number | undefined;
} | null> {
  const object = await env.DOCUMENTS_BUCKET.get(storageKey);
  if (!object) return null;

  try {
    const response = await env.ANYDOC.fetch(
      new Request("http://anydoc/parse", {
        method: "POST",
        body: object.body,
      })
    );

    if (!response.ok) return null;

    const json = parseResultSchema.parse(await response.json());
    return {
      format: json.format ?? "unknown",
      markdown: json.markdown ?? null,
      pageCount: json.pageCount,
    };
  } catch {
    return null;
  }
}
