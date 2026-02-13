import {
  CalendarIcon,
  CreditCardIcon,
  GripVerticalIcon,
  PenToolIcon,
  TypeIcon,
} from "lucide-react";
import { useState } from "react";

import { FIELD_DIMENSIONS } from "./draggable-field";

export type FieldType =
  | "signature"
  | "text"
  | "date"
  | "checkbox"
  | "dropdown"
  | "radio"
  | "attachment"
  | "payment";

interface FieldToolbarProps {
  onFieldDragStart?: (fieldType: FieldType) => void;
  onFieldDragEnd?: () => void;
  disabled?: boolean;
  stripeConnected?: boolean;
}

interface FieldButtonProps {
  type: FieldType;
  icon: React.ReactNode;
  label: string;
  onDragStart: (fieldType: FieldType) => void;
  onDragEnd: () => void;
  disabled?: boolean;
}

/**
 * Field type configurations
 */
const FIELD_CONFIG: Record<
  FieldType,
  {
    label: string;
    accentColor: string;
  }
> = {
  signature: {
    label: "Signature",
    accentColor: "#3b82f6",
  },
  text: {
    label: "Text",
    accentColor: "#22c55e",
  },
  date: {
    label: "Date",
    accentColor: "#8b5cf6",
  },
  checkbox: {
    label: "Check",
    accentColor: "#f97316",
  },
  dropdown: {
    label: "Select",
    accentColor: "#06b6d4",
  },
  radio: {
    label: "Choice",
    accentColor: "#ec4899",
  },
  attachment: {
    label: "File",
    accentColor: "#84cc16",
  },
  payment: {
    label: "Payment",
    accentColor: "#10b981",
  },
};

/**
 * Draggable field button
 */
function FieldButton({ type, icon, label, onDragStart, onDragEnd, disabled }: FieldButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const config = FIELD_CONFIG[type];

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("fieldType", type);

    // Create drag image
    const dimensions = FIELD_DIMENSIONS[type];
    const dragImage = document.createElement("div");
    dragImage.style.cssText = `
			position: absolute;
			top: -9999px;
			width: ${dimensions.width}px;
			height: ${dimensions.height}px;
			background: ${config.accentColor}10;
			border: 2px dashed ${config.accentColor};
			border-radius: 6px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: system-ui, sans-serif;
			font-size: 12px;
			font-weight: 600;
			color: #374151;
			letter-spacing: 0.5px;
			text-transform: uppercase;
		`;
    dragImage.textContent = config.label;

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, dimensions.width / 2, dimensions.height / 2);

    requestAnimationFrame(() => {
      document.body.removeChild(dragImage);
    });

    onDragStart(type);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`group relative flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors dark:border-slate-700 dark:bg-slate-900 ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-grab hover:border-gray-300 active:cursor-grabbing dark:hover:border-slate-600"
      } ${isDragging ? "scale-95 border-dashed opacity-40" : ""}`}
    >
      <div className="flex items-center text-gray-400 transition-colors group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400">
        <GripVerticalIcon className="h-3 w-3" />
      </div>
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
        style={{
          backgroundColor: isHovered ? config.accentColor : "white",
          borderColor: isHovered ? config.accentColor : "#e5e7eb",
          color: isHovered ? "white" : "#4b5563",
        }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </button>
  );
}

/**
 * Field toolbar - Provides draggable field types for document annotation
 */
export function FieldToolbar({
  onFieldDragStart,
  onFieldDragEnd,
  disabled,
  stripeConnected = false,
}: FieldToolbarProps) {
  const handleDragStart = (fieldType: FieldType) => {
    onFieldDragStart?.(fieldType);
  };

  const handleDragEnd = () => {
    onFieldDragEnd?.();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-baseline justify-between border-b border-dashed border-gray-300 pb-2.5 dark:border-slate-600">
        <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
          Fields
        </span>
        <span className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-[9px] font-normal text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-500">
          {disabled ? "Add a signer first" : "Drag to place"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FieldButton
          type="signature"
          icon={<PenToolIcon className="h-4 w-4" />}
          label="Signature"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          disabled={disabled}
        />

        <FieldButton
          type="text"
          icon={<TypeIcon className="h-4 w-4" />}
          label="Text"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          disabled={disabled}
        />

        <FieldButton
          type="date"
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Date"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          disabled={disabled}
        />

        <FieldButton
          type="payment"
          icon={<CreditCardIcon className="h-4 w-4" />}
          label="Payment"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          disabled={disabled || !stripeConnected}
        />

        {/* TODO: Re-enable checkbox field once multi-option rendering is complete
				<FieldButton
					type="checkbox"
					icon={<CheckSquareIcon className="w-4 h-4" />}
					label="Checkbox"
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					disabled={disabled}
				/>
				*/}
      </div>
    </div>
  );
}
