import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";

import { DraggableField, type PlacedField } from "./draggable-field";

interface PdfCanvasLayerProps {
  pageNumber: number;
  pdfWidth: number;
  pdfHeight: number;
  scrollOffset?: { x: number; y: number };
  onCanvasReady?: (stage: Konva.Stage) => void;
  fields?: PlacedField[];
  selectedFieldId?: string | null;
  onFieldSelect?: (fieldId: string | null) => void;
  onFieldUpdate?: (fieldId: string, x: number, y: number, width: number, height: number) => void;
}

/**
 * Canvas layer component that overlays the PDF for interactive field placement
 * Syncs dimensions, zoom, and position with the underlying PDF page
 */
export function PdfCanvasLayer({
  pageNumber,
  pdfWidth,
  pdfHeight,
  scrollOffset: _scrollOffset = { x: 0, y: 0 },
  onCanvasReady,
  fields = [],
  selectedFieldId,
  onFieldSelect,
  onFieldUpdate,
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

  // Filter fields for this page
  const pageFields = fields.filter((field) => field.pageNumber === pageNumber);

  // Convert fields from percentage coordinates (stored in DB) to pixel coordinates (for rendering)
  const pageFieldsInPixels = pageFields.map((field) => ({
    ...field,
    x: (field.x / 100) * pdfWidth,
    y: (field.y / 100) * pdfHeight,
    width: (field.width / 100) * pdfWidth,
    height: (field.height / 100) * pdfHeight,
  }));

  // Handle stage click to deselect fields
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Deselect when clicking on empty area
    if (e.target === e.target.getStage()) {
      onFieldSelect?.(null);
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 10,
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        className="pointer-events-auto"
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* SEA-90: Render placed fields */}
          {pageFieldsInPixels.map((field) => (
            <DraggableField
              key={field.id}
              field={field}
              isSelected={selectedFieldId === field.id}
              onSelect={() => onFieldSelect?.(field.id)}
              onDragEnd={(xPixels, yPixels) => {
                // Convert pixel coordinates back to percentages for database storage
                const xPercent = (xPixels / pdfWidth) * 100;
                const yPercent = (yPixels / pdfHeight) * 100;
                const widthPercent = (field.width / pdfWidth) * 100;
                const heightPercent = (field.height / pdfHeight) * 100;
                onFieldUpdate?.(field.id, xPercent, yPercent, widthPercent, heightPercent);
              }}
              onTransformEnd={(xPixels, yPixels, widthPixels, heightPixels) => {
                // Convert pixel coordinates back to percentages for database storage
                const xPercent = (xPixels / pdfWidth) * 100;
                const yPercent = (yPixels / pdfHeight) * 100;
                const widthPercent = (widthPixels / pdfWidth) * 100;
                const heightPercent = (heightPixels / pdfHeight) * 100;
                onFieldUpdate?.(field.id, xPercent, yPercent, widthPercent, heightPercent);
              }}
            />
          ))}

        </Layer>
      </Stage>
    </div>
  );
}
