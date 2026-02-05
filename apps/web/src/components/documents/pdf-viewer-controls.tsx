import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useControls } from "react-zoom-pan-pinch";

import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

interface PdfViewerControlsProps {
  currentZoom?: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Enable keyboard shortcuts (Arrow keys for page navigation) */
  enableKeyboardShortcuts?: boolean;
  /** Callback to trigger fit-to-width calculation */
  onFitToWidth?: () => void;
  /** Additional class names for the container */
  className?: string;
}

/**
 * Combined zoom and page navigation controls for PDF viewer
 * SEA-78: Zoom controls (in, out, fit), page navigation (prev, next, jump to page), page counter
 * SEA-79: Keyboard shortcuts (arrow keys for pages)
 *
 * Responsive design:
 * - Desktop: Full controls with all features
 * - Mobile: Compact layout with essential controls
 */
export function PdfViewerControls({
  currentZoom: externalZoom,
  currentPage,
  totalPages,
  onPageChange,
  enableKeyboardShortcuts = true,
  onFitToWidth,
  className,
}: PdfViewerControlsProps) {
  const { zoomIn, zoomOut, resetTransform, zoomToElement, instance } = useControls();

  // Page input state for "jump to page" feature
  const [pageInput, setPageInput] = useState(String(currentPage));

  // Sync page input with current page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Use external zoom if provided, otherwise fall back to instance state
  const currentZoom = externalZoom ?? instance.transformState.scale;
  const zoomPercentage = Math.round(currentZoom * 100);

  const handleZoomChange = useCallback(
    (zoom: number) => {
      const element = instance.wrapperComponent;
      if (element) {
        zoomToElement(element, zoom, 0);
      }
    },
    [instance.wrapperComponent, zoomToElement],
  );

  const handleFitToWidth = useCallback(() => {
    if (onFitToWidth) {
      onFitToWidth();
    } else {
      // Fallback: reset to 100% if no fit callback provided
      handleZoomChange(1.0);
    }
  }, [onFitToWidth, handleZoomChange]);

  // Page navigation handlers
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = Number.parseInt(pageInput, 10);
    if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      // Reset to current page if invalid
      setPageInput(String(currentPage));
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = Number.parseInt(pageInput, 10);
    if (Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      setPageInput(String(currentPage));
    }
  };

  // SEA-79: Keyboard shortcuts for page navigation
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goToPreviousPage();
          break;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          goToNextPage();
          break;
        case "Home":
          e.preventDefault();
          onPageChange(1);
          break;
        case "End":
          e.preventDefault();
          onPageChange(totalPages);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, goToPreviousPage, goToNextPage, onPageChange, totalPages]);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "bg-background/95 flex items-center gap-1 rounded-lg border p-1.5 shadow-sm backdrop-blur-sm sm:gap-2 sm:p-2",
          className,
        )}
      >
        {/* Page Navigation */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Previous page (←)</p>
            </TooltipContent>
          </Tooltip>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-0.5 sm:gap-1">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              className="h-7 w-8 px-1 text-center text-xs sm:h-8 sm:w-10 sm:text-sm"
              aria-label="Current page"
            />
            <span className="text-muted-foreground text-xs whitespace-nowrap sm:text-sm">
              / {totalPages}
            </span>
          </form>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Next page (→)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Divider - hidden on very small screens */}
        <div className="bg-border hidden h-5 w-px sm:block sm:h-6" />

        {/* Zoom Controls */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomOut()}
                disabled={currentZoom <= 0.5}
                aria-label="Zoom out"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom out</p>
            </TooltipContent>
          </Tooltip>

          {/* Zoom percentage - hidden on mobile, shown as select on desktop */}
          <Select
            value={currentZoom.toFixed(2)}
            onValueChange={(value) => handleZoomChange(Number.parseFloat(value))}
          >
            <SelectTrigger
              className="hidden h-7 w-16 px-2 text-xs sm:flex sm:h-8 sm:w-[4.5rem]"
              size="sm"
            >
              <SelectValue>{zoomPercentage}%</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ZOOM_LEVELS.map((level) => (
                <SelectItem key={level} value={level.toFixed(2)}>
                  {Math.round(level * 100)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile-only zoom percentage display */}
          <span className="text-muted-foreground min-w-[2.5rem] text-center text-xs sm:hidden">
            {zoomPercentage}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomIn()}
                disabled={currentZoom >= 2.0}
                aria-label="Zoom in"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom in</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Divider - hidden on mobile */}
        <div className="bg-border hidden h-5 w-px sm:block sm:h-6" />

        {/* Reset & Fit - hidden on mobile */}
        <div className="hidden items-center gap-0.5 sm:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetTransform()}
                className="h-8 px-2 text-xs"
              >
                <RotateCcwIcon className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Reset zoom and position</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFitToWidth}
                className="h-8 px-2 text-xs"
              >
                <Maximize2Icon className="mr-1.5 h-3.5 w-3.5" />
                Fit
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Fit to width (100%)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
