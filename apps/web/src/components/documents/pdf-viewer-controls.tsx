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
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

interface PdfViewerControlsProps {
	currentZoom?: number;
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	/** Enable keyboard shortcuts (Arrow keys for page navigation) */
	enableKeyboardShortcuts?: boolean;
}

/**
 * Combined zoom and page navigation controls for PDF viewer
 * SEA-78: Zoom controls (in, out, fit), page navigation (prev, next, jump to page), page counter
 * SEA-79: Keyboard shortcuts (arrow keys for pages)
 */
export function PdfViewerControls({
	currentZoom: externalZoom,
	currentPage,
	totalPages,
	onPageChange,
	enableKeyboardShortcuts = true,
}: PdfViewerControlsProps) {
	const { zoomIn, zoomOut, resetTransform, zoomToElement, instance } =
		useControls();

	// Page input state for "jump to page" feature
	const [pageInput, setPageInput] = useState(String(currentPage));

	// Sync page input with current page
	useEffect(() => {
		setPageInput(String(currentPage));
	}, [currentPage]);

	// Use external zoom if provided, otherwise fall back to instance state
	const currentZoom = externalZoom ?? instance.transformState.scale;
	const zoomPercentage = Math.round(currentZoom * 100);

	const handleZoomChange = (zoom: number) => {
		const element = instance.wrapperComponent;
		if (element) {
			zoomToElement(element, zoom, 0);
		}
	};

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
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
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
	}, [
		enableKeyboardShortcuts,
		goToPreviousPage,
		goToNextPage,
		onPageChange,
		totalPages,
	]);

	return (
		<TooltipProvider>
			<div className="flex items-center gap-2 p-2 bg-background border rounded-lg shadow-sm">
				{/* Page Navigation */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={goToPreviousPage}
								disabled={currentPage <= 1}
								aria-label="Previous page"
							>
								<ChevronLeftIcon className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Previous page (←)</p>
						</TooltipContent>
					</Tooltip>

					<form
						onSubmit={handlePageInputSubmit}
						className="flex items-center gap-1"
					>
						<Input
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							value={pageInput}
							onChange={handlePageInputChange}
							onBlur={handlePageInputBlur}
							className="w-12 h-8 text-center text-sm px-1"
							aria-label="Current page"
						/>
						<span className="text-sm text-muted-foreground whitespace-nowrap">
							of {totalPages}
						</span>
					</form>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={goToNextPage}
								disabled={currentPage >= totalPages}
								aria-label="Next page"
							>
								<ChevronRightIcon className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Next page (→)</p>
						</TooltipContent>
					</Tooltip>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border" />

				{/* Zoom Controls */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => zoomOut()}
								disabled={currentZoom <= 0.5}
								aria-label="Zoom out"
							>
								<MinusIcon className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Zoom out</p>
						</TooltipContent>
					</Tooltip>

					<Select
						value={currentZoom.toFixed(2)}
						onValueChange={(value) =>
							handleZoomChange(Number.parseFloat(value))
						}
					>
						<SelectTrigger className="w-20 h-8">
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

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => zoomIn()}
								disabled={currentZoom >= 2.0}
								aria-label="Zoom in"
							>
								<PlusIcon className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Zoom in</p>
						</TooltipContent>
					</Tooltip>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border" />

				{/* Reset & Fit */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => resetTransform()}
								className="h-8"
							>
								<RotateCcwIcon className="h-4 w-4 mr-1" />
								Reset
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Reset zoom and position</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleZoomChange(1.0)}
								className="h-8"
							>
								<Maximize2Icon className="h-4 w-4 mr-1" />
								Fit
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Fit to width</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}

/**
 * Standalone page navigation controls (without zoom)
 * For use outside TransformWrapper context
 */
interface PdfPageControlsProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	enableKeyboardShortcuts?: boolean;
}

export function PdfPageControls({
	currentPage,
	totalPages,
	onPageChange,
	enableKeyboardShortcuts = true,
}: PdfPageControlsProps) {
	const [pageInput, setPageInput] = useState(String(currentPage));

	useEffect(() => {
		setPageInput(String(currentPage));
	}, [currentPage]);

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
			setPageInput(String(currentPage));
		}
	};

	const handlePageInputBlur = () => {
		const pageNum = Number.parseInt(pageInput, 10);
		if (Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
			setPageInput(String(currentPage));
		}
	};

	// Keyboard shortcuts
	useEffect(() => {
		if (!enableKeyboardShortcuts) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
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
	}, [
		enableKeyboardShortcuts,
		goToPreviousPage,
		goToNextPage,
		onPageChange,
		totalPages,
	]);

	return (
		<TooltipProvider>
			<div className="flex items-center gap-2 p-2 bg-background border rounded-lg shadow-sm">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={goToPreviousPage}
							disabled={currentPage <= 1}
							aria-label="Previous page"
						>
							<ChevronLeftIcon className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Previous page (←)</p>
					</TooltipContent>
				</Tooltip>

				<form
					onSubmit={handlePageInputSubmit}
					className="flex items-center gap-1"
				>
					<Input
						type="text"
						inputMode="numeric"
						pattern="[0-9]*"
						value={pageInput}
						onChange={handlePageInputChange}
						onBlur={handlePageInputBlur}
						className="w-12 h-8 text-center text-sm px-1"
						aria-label="Current page"
					/>
					<span className="text-sm text-muted-foreground whitespace-nowrap">
						of {totalPages}
					</span>
				</form>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={goToNextPage}
							disabled={currentPage >= totalPages}
							aria-label="Next page"
						>
							<ChevronRightIcon className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Next page (→)</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}
