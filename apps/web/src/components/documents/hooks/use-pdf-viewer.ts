import { useCallback, useEffect, useRef, useState } from "react";

import { downloadDocument } from "@/lib/api-client";
import { toast } from "@/lib/toast";

/**
 * Manages PDF viewer state: loading the PDF URL, responsive width, page navigation,
 * and zoom tracking. Returns refs needed for the PDF container DOM elements.
 */
export function usePdfViewer(
  organizationSlug: string,
  documentPublicId: string,
  reloadKey = 0
) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(700);
  const [pdfHeight, setPdfHeight] = useState(900);
  const [currentZoom, setCurrentZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfUrlRef = useRef<string | null>(null);

  // Fetch PDF download URL from Worker storage
  useEffect(() => {
    let cancelled = false;
    const fetchPdfUrl = async () => {
      try {
        const blob = await downloadDocument(organizationSlug, documentPublicId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (pdfUrlRef.current) {
          URL.revokeObjectURL(pdfUrlRef.current);
        }
        pdfUrlRef.current = url;
        setPdfUrl(url);
        setNumPages(null);
      } catch {
        if (!cancelled) toast.error("Failed to load PDF");
      }
    };
    void fetchPdfUrl();

    return () => {
      cancelled = true;
    };
  }, [documentPublicId, organizationSlug, reloadKey]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  // SEA-84: Keep PDF width in sync with container size on window resize
  useEffect(() => {
    const updatePdfWidth = () => {
      if (pdfWrapperRef.current) {
        const wrapperWidth = pdfWrapperRef.current.clientWidth;
        const optimalWidth = wrapperWidth - 40;
        setPdfWidth(Math.max(optimalWidth, 300));
      }
    };

    const timeoutId = setTimeout(updatePdfWidth, 100);
    let resizeTimeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(updatePdfWidth, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
  };

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Capture first-page height for percentage-based field coordinate conversion
  const handlePageDimensions = (
    pageNumber: number,
    _width: number,
    height: number
  ) => {
    if (pageNumber === 1) {
      setPdfHeight(height);
    }
  };

  return {
    numPages,
    pdfUrl,
    currentPage,
    setCurrentPage,
    pdfWidth,
    pdfHeight,
    currentZoom,
    setCurrentZoom,
    containerRef,
    pdfWrapperRef,
    pageRefs,
    onDocumentLoadSuccess,
    handlePageChange,
    handlePageDimensions,
  };
}
