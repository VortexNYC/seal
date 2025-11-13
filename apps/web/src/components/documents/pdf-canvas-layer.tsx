import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Circle, Layer, Rect, Stage, Text } from "react-konva";

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

					{/* SEA-84: Coordinate system test markers */}
					{/* These test elements verify that canvas coordinates map correctly to PDF */}
					{/* TODO: Remove these test markers once field placement is implemented and tested */}

					{/* Top-left corner marker (0, 0) */}
					<Circle
						x={10}
						y={10}
						radius={5}
						fill="red"
						opacity={0.5}
					/>
					<Text
						x={20}
						y={5}
						text="(0,0)"
						fontSize={12}
						fill="red"
						opacity={0.7}
					/>

					{/* Bottom-right corner marker */}
					<Circle
						x={dimensions.width - 10}
						y={dimensions.height - 10}
						radius={5}
						fill="blue"
						opacity={0.5}
					/>
					<Text
						x={dimensions.width - 60}
						y={dimensions.height - 20}
						text={`(${dimensions.width},${dimensions.height})`}
						fontSize={12}
						fill="blue"
						opacity={0.7}
					/>

					{/* Center test marker */}
					<Rect
						x={dimensions.width / 2 - 50}
						y={dimensions.height / 2 - 25}
						width={100}
						height={50}
						stroke="green"
						strokeWidth={2}
						opacity={0.5}
					/>
					<Text
						x={dimensions.width / 2 - 40}
						y={dimensions.height / 2 - 10}
						text="CENTER TEST"
						fontSize={14}
						fill="green"
						opacity={0.7}
					/>
				</Layer>
			</Stage>
		</div>
	);
}
