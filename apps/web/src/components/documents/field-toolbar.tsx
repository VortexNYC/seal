import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownSquareIcon,
  CircleDotIcon,
  CreditCardIcon,
  GripVerticalIcon,
  HashIcon,
  PaperclipIcon,
  PenToolIcon,
  TypeIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { FIELD_DIMENSIONS } from "./draggable-field";

export type FieldType =
  | "signature"
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "dropdown"
  | "radio"
  | "attachment"
  | "payment";

export const FIELD_TYPES = [
  "signature",
  "text",
  "number",
  "date",
  "checkbox",
  "dropdown",
  "radio",
  "attachment",
  "payment",
] as const satisfies readonly FieldType[];

interface FieldToolbarProps {
  onFieldDragStart?: (fieldType: FieldType) => void;
  onFieldDragEnd?: () => void;
  disabled?: boolean;
  merchantPaymentsReady?: boolean;
  documentId?: string;
}

interface FieldButtonProps {
  type: FieldType;
  icon: React.ReactNode;
  label: string;
  onDragStart: (fieldType: FieldType) => void;
  onDragEnd: () => void;
  disabled?: boolean;
  disabledReason?: string;
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
    accentColor: "var(--field-signature)",
  },
  text: {
    label: "Text",
    accentColor: "var(--field-text)",
  },
  number: {
    label: "Number",
    accentColor: "var(--field-number)",
  },
  date: {
    label: "Date",
    accentColor: "var(--field-date)",
  },
  checkbox: {
    label: "Check",
    accentColor: "var(--field-checkbox)",
  },
  dropdown: {
    label: "Select",
    accentColor: "var(--field-dropdown)",
  },
  radio: {
    label: "Choice",
    accentColor: "var(--field-radio)",
  },
  attachment: {
    label: "File",
    accentColor: "var(--field-attachment)",
  },
  payment: {
    label: "Payment",
    accentColor: "var(--field-payment)",
  },
};

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  signature: <PenToolIcon className="h-4 w-4" />,
  text: <TypeIcon className="h-4 w-4" />,
  number: <HashIcon className="h-4 w-4" />,
  date: <CalendarIcon className="h-4 w-4" />,
  checkbox: <CheckSquareIcon className="h-4 w-4" />,
  dropdown: <ChevronDownSquareIcon className="h-4 w-4" />,
  radio: <CircleDotIcon className="h-4 w-4" />,
  attachment: <PaperclipIcon className="h-4 w-4" />,
  payment: <CreditCardIcon className="h-4 w-4" />,
};

/**
 * Draggable field button
 */
function FieldButton({
  type,
  icon,
  label,
  onDragStart,
  onDragEnd,
  disabled,
  disabledReason,
}: FieldButtonProps) {
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
			color: var(--foreground);
			letter-spacing: 0.5px;
			text-transform: uppercase;
		`;
    dragImage.textContent = config.label;

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(
      dragImage,
      dimensions.width / 2,
      dimensions.height / 2
    );

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
      title={disabled ? disabledReason : undefined}
      className={cn(
        "group bg-card border-border relative flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-border cursor-grab active:cursor-grabbing",
        isDragging && "scale-95 border-dashed opacity-40"
      )}
    >
      <div className="text-muted-foreground flex items-center transition-colors">
        <GripVerticalIcon className="h-3 w-3" />
      </div>
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
        style={{
          backgroundColor: isHovered ? config.accentColor : "var(--card)",
          borderColor: isHovered ? config.accentColor : "var(--border)",
          color: isHovered
            ? "var(--primary-foreground)"
            : "var(--muted-foreground)",
        }}
      >
        {icon}
      </div>
      <span className="text-foreground text-sm font-medium">{label}</span>
    </button>
  );
}

function getPaymentDisabledReason(merchantPaymentsReady: boolean): string {
  return merchantPaymentsReady
    ? "Payment fields are temporarily disabled while payments are migrated to the Worker backend."
    : "Connect a merchant account to add payment fields.";
}

/**
 * Field toolbar - Provides draggable field types for document annotation
 */
export function FieldToolbar({
  onFieldDragStart,
  onFieldDragEnd,
  disabled,
  merchantPaymentsReady = false,
  documentId,
}: FieldToolbarProps) {
  void documentId;

  const handleDragStart = (fieldType: FieldType) => {
    onFieldDragStart?.(fieldType);
  };

  const handleDragEnd = () => {
    onFieldDragEnd?.();
  };

  return (
    <div className="bg-muted border-border rounded-xl border p-4">
      <div className="border-border mb-3 flex items-baseline justify-between border-b border-dashed pb-2.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Fields
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {FIELD_TYPES.map((type) => {
          const isPayment = type === "payment";
          const isDisabled =
            disabled ||
            (isPayment && true); // Payment fields disabled while Vortex Payments is rewired
          const disabledReason = isPayment
            ? getPaymentDisabledReason(merchantPaymentsReady)
            : "Document fields are temporarily disabled while the field editor is migrated to the Worker backend.";

          return (
            <FieldButton
              key={type}
              type={type}
              icon={FIELD_ICONS[type]}
              label={FIELD_CONFIG[type].label}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              disabled={isDisabled}
              disabledReason={disabledReason}
            />
          );
        })}
      </div>
    </div>
  );
}
