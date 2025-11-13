import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";

interface PdfCanvasLayerProps {
	pageNumber: number;
	pdfWidth: number;
	pdfHeight: number;
	zoom?: number;
	scrollOffset?: { x: number; y: number };
	onCanvasReady?: (stage: Konva.Stage) => void;
}

/**
 * Canvas layer component that overlays the PDF for interactive field placement
 * Syncs dimensions, zoom, and position with the underlying PDF page
 */
export function PdfCanvasLayer({
	pageNumber,
	pdfWidth,
	pdfHeight,
	zoom = 1,
	scrollOffset = { x: 0, y: 0 },
	onCanvasReady,
}: PdfCanvasLayerProps) {
	const stageRef = useRef<Konva.Stage>(null);
	const [dimensions, setDimensions] = useState({
		width: pdfWidth,
		height: pdfHeight,
	});

	// Sync canvas dimensions with PDF dimensions and zoom
	useEffect(() => {
		setDimensions({
			width: pdfWidth,
			height: pdfHeight,
		});
	}, [pdfWidth, pdfHeight]);

	// Notify parent when canvas is ready
	useEffect(() => {
		if (stageRef.current && onCanvasReady) {
			onCanvasReady(stageRef.current);
		}
	}, [onCanvasReady]);

	return (
		<div
			className="absolute inset-0 pointer-events-none"
			style={{
				width: dimensions.width,
				height: dimensions.height,
			}}
		>
			<Stage
				ref={stageRef}
				width={dimensions.width}
				height={dimensions.height}
				className="pointer-events-auto"
				scaleX={zoom}
				scaleY={zoom}
			>
				<Layer>
					{/* Fields will be added here dynamically */}
					{/* For now, render a test rectangle to verify canvas is working */}
					{/* TODO: Remove this test shape once field placement is implemented */}
				</Layer>
			</Stage>
		</div>
	);
}
