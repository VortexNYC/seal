import { useEffect, useState } from "react";

import {
  type ThumbnailPage,
} from "@/components/kumo-docs";
import { generatePageThumbnailsFromUrl } from "@/lib/pdf-utils";

/**
 * Builds ThumbnailSidebar pages from a PDF object URL once page count is known.
 */
export function usePdfPageThumbnails(
  pdfUrl: string | null,
  numPages: number | null
): { pages: ThumbnailPage[]; loading: boolean } {
  const [pages, setPages] = useState<ThumbnailPage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfUrl || !numPages || numPages < 1) {
      setPages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void generatePageThumbnailsFromUrl(pdfUrl, { maxPages: numPages }).then(
      (thumbs) => {
        if (cancelled) return;
        const byPage = new Map(thumbs.map((t) => [t.page, t.src]));
        setPages(
          Array.from({ length: numPages }, (_, i) => {
            const page = i + 1;
            return { page, src: byPage.get(page) ?? null };
          })
        );
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, numPages]);

  return { pages, loading };
}
