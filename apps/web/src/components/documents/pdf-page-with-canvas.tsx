import type Konva from "konva";
import { useState } from "react";
import { Page } from "react-pdf";
import { useTransformContext } from "react-zoom-pan-pinch";
import { PdfCanvasLayer } from "./pdf-canvas-layer";

interface PdfPageWithCanvasProps {
	pageNumber: number;
	width: number;
	renderTextLayer?: boolean;
	renderAnnotationLayer?: boolean;
	className?: string;
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
}: PdfPageWithCanvasProps) {
	const [pageDimensions, setPageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);

	// Get zoom/pan state from TransformWrapper context
	const transformContext = useTransformContext();
	const { scale, positionX, positionY } = transformContext?.transformState || {
		scale: 1,
		positionX: 0,
		positionY: 0,
	};

	const handlePageLoadSuccess = (page: { width: number; height: number }) => {
		// Calculate actual rendered dimensions based on the width prop
		const scale = width / page.width;
		setPageDimensions({
			width: width,
			height: page.height * scale,
		});
	};

	const handleCanvasReady = (stage: Konva.Stage) => {
		// Canvas is ready for interaction
		// TODO: Add field placement logic here
		console.log(`Canvas ready for page ${pageNumber}`, stage);
	};

	return (
		<div className="relative">
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
					zoom={scale}
					scrollOffset={{ x: positionX, y: positionY }}
					onCanvasReady={handleCanvasReady}
				/>
			)}
		</div>
	);
}
