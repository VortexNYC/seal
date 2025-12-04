import type Konva from "konva";
import { useState } from "react";
import { Page } from "react-pdf";
import { useTransformContext } from "react-zoom-pan-pinch";
import type { PlacedField } from "./draggable-field";
import { PdfCanvasLayer } from "./pdf-canvas-layer";

interface PdfPageWithCanvasProps {
	pageNumber: number;
	width: number;
	renderTextLayer?: boolean;
	renderAnnotationLayer?: boolean;
	className?: string;
	fields?: PlacedField[];
	selectedFieldId?: string | null;
	onFieldSelect?: (fieldId: string | null) => void;
	onFieldUpdate?: (
		fieldId: string,
		x: number,
		y: number,
		width: number,
		height: number,
	) => void;
	onPageDimensions?: (
		pageNumber: number,
		width: number,
		height: number,
	) => void;
	/** SEA-78: Callback to register page ref for scroll navigation */
	onPageRef?: (pageNumber: number, element: HTMLDivElement | null) => void;
}

/**
 * Wrapper component that combines a PDF page with an interactive canvas layer
 * Handles dimension synchronization between PDF and canvas
 * Syncs with zoom/pan state from react-zoom-pan-pinch
 */
export function PdfPageWithCanvas({
	pageNumber,
	width,
	renderTextLayer = true,
	renderAnnotationLayer = true,
	className,
	fields,
	selectedFieldId,
	onFieldSelect,
	onFieldUpdate,
	onPageDimensions,
	onPageRef,
}: PdfPageWithCanvasProps) {
	const [pageDimensions, setPageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);

	// Get zoom/pan state from TransformWrapper context
	const transformContext = useTransformContext();
	const { positionX, positionY } = transformContext?.transformState || {
		positionX: 0,
		positionY: 0,
	};

	const handlePageLoadSuccess = (page: { width: number; height: number }) => {
		// Calculate actual rendered dimensions based on the width prop
		const scale = width / page.width;
		const renderedHeight = page.height * scale;
		setPageDimensions({
			width: width,
			height: renderedHeight,
		});
		// Notify parent of page dimensions for coordinate conversion
		onPageDimensions?.(pageNumber, width, renderedHeight);
	};

	const handleCanvasReady = (stage: Konva.Stage) => {
		// Canvas is ready for interaction
		// TODO: Add field placement logic here
		console.log(`Canvas ready for page ${pageNumber}`, stage);
	};

	// SEA-78: Ref callback for page scroll navigation
	const handleRef = (element: HTMLDivElement | null) => {
		onPageRef?.(pageNumber, element);
	};

	return (
		<div className="relative" ref={handleRef} data-page-number={pageNumber}>
			<Page
				pageNumber={pageNumber}
				width={width}
				renderTextLayer={renderTextLayer}
				renderAnnotationLayer={renderAnnotationLayer}
				className={className}
				onLoadSuccess={handlePageLoadSuccess}
			/>
			{pageDimensions && (
				<PdfCanvasLayer
					pageNumber={pageNumber}
					pdfWidth={pageDimensions.width}
					pdfHeight={pageDimensions.height}
					scrollOffset={{ x: positionX, y: positionY }}
					onCanvasReady={handleCanvasReady}
					fields={fields}
					selectedFieldId={selectedFieldId}
					onFieldSelect={onFieldSelect}
					onFieldUpdate={onFieldUpdate}
				/>
			)}
		</div>
	);
}
