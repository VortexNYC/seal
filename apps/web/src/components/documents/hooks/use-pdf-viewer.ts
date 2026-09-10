import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { downloadDocument } from "@/lib/api-client";

/**
 * Manages PDF viewer state: loading the PDF URL, responsive width, page navigation,
 * and zoom tracking. Returns refs needed for the PDF container DOM elements.
 */
export function usePdfViewer(documentPublicId: string) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(700);
  const [pdfHeight, setPdfHeight] = useState(900);
  const [currentZoom, setCurrentZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Fetch PDF download URL from Worker storage
  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const blob = await downloadDocument(documentPublicId);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch {
        toast.error("Failed to load PDF");
      }
    };
    void fetchPdfUrl();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [documentPublicId]);

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
