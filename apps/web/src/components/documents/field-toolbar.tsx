import {
  CalendarCheckIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownSquareIcon,
  CircleDotIcon,
  Columns3Icon,
  CreditCardIcon,
  GripVerticalIcon,
  HashIcon,
  HeadingIcon,
  IdCardIcon,
  ImageIcon,
  ListChecksIcon,
  PaperclipIcon,
  PenLineIcon,
  PenToolIcon,
  PhoneIcon,
  StampIcon,
  StrikethroughIcon,
  TypeIcon,
  UserIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";

import {
  FIELD_DIMENSIONS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FieldType,
} from "@/lib/field-types";
import { cn } from "@/lib/utils";

export { FIELD_TYPES, type FieldType } from "@/lib/field-types";

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

const FIELD_ACCENT: Record<FieldType, string> = {
  signature: "var(--field-signature)",
  free_signature: "var(--field-signature)",
  initials: "var(--field-initials)",
  name: "var(--field-name)",
  email: "var(--field-email)",
  text: "var(--field-text)",
  number: "var(--field-number)",
  date: "var(--field-date)",
  date_signed: "var(--field-date-signed)",
  checkbox: "var(--field-checkbox)",
  dropdown: "var(--field-dropdown)",
  radio: "var(--field-radio)",
  multi_select: "var(--field-multi-select)",
  attachment: "var(--field-attachment)",
  image: "var(--field-image)",
  payment: "var(--field-payment)",
  phone: "var(--field-phone)",
  cells: "var(--field-cells)",
  stamp: "var(--field-stamp)",
  heading: "var(--field-heading)",
  strikethrough: "var(--field-strikethrough)",
  verification: "var(--field-verification)",
  kba: "var(--field-kba)",
};

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  signature: <PenToolIcon className="h-4 w-4" />,
  free_signature: <PenLineIcon className="h-4 w-4" />,
  initials: <TypeIcon className="h-4 w-4" />,
  name: <UserIcon className="h-4 w-4" />,
  email: <TypeIcon className="h-4 w-4" />,
  text: <TypeIcon className="h-4 w-4" />,
  number: <HashIcon className="h-4 w-4" />,
  date: <CalendarIcon className="h-4 w-4" />,
  date_signed: <CalendarCheckIcon className="h-4 w-4" />,
  checkbox: <CheckSquareIcon className="h-4 w-4" />,
  dropdown: <ChevronDownSquareIcon className="h-4 w-4" />,
  radio: <CircleDotIcon className="h-4 w-4" />,
  multi_select: <ListChecksIcon className="h-4 w-4" />,
  attachment: <PaperclipIcon className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  payment: <CreditCardIcon className="h-4 w-4" />,
  phone: <PhoneIcon className="h-4 w-4" />,
  cells: <Columns3Icon className="h-4 w-4" />,
  stamp: <StampIcon className="h-4 w-4" />,
  heading: <HeadingIcon className="h-4 w-4" />,
  strikethrough: <StrikethroughIcon className="h-4 w-4" />,
  verification: <IdCardIcon className="h-4 w-4" />,
  kba: <ShieldCheckIcon className="h-4 w-4" />,
};

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
  const accentColor = FIELD_ACCENT[type];

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("fieldType", type);

    const dimensions = FIELD_DIMENSIONS[type];
    const dragImage = document.createElement("div");
    dragImage.style.cssText = `
			position: absolute;
			top: -9999px;
			width: ${dimensions.width}px;
			height: ${dimensions.height}px;
			background: color-mix(in oklab, ${accentColor} 12%, transparent);
			border: 2px dashed ${accentColor};
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
    dragImage.textContent = label;

    document.body.appendChild(dragImage);
    // Signature-like: hotspot at bottom-center so cursor marks the rule.
    const bottomAnchored =
      type === "signature" ||
      type === "free_signature" ||
      type === "initials" ||
      type === "stamp";
    e.dataTransfer.setDragImage(
      dragImage,
      dimensions.width / 2,
      bottomAnchored ? dimensions.height : dimensions.height / 2
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
          backgroundColor: isHovered ? accentColor : "var(--card)",
          borderColor: isHovered ? accentColor : "var(--border)",
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
 * Field toolbar — all Documenso + DocuSeal placeable types (Kumo/lucide chrome).
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
      <div className="grid max-h-[70vh] grid-cols-1 gap-2 overflow-y-auto">
        {FIELD_TYPES.map((type) => {
          const isPayment = type === "payment";
          const isDisabled = disabled || isPayment;
          const disabledReason = isPayment
            ? getPaymentDisabledReason(merchantPaymentsReady)
            : "Document fields are temporarily disabled while the field editor is migrated to the Worker backend.";

          return (
            <FieldButton
              key={type}
              type={type}
              icon={FIELD_ICONS[type]}
              label={FIELD_TYPE_LABELS[type]}
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
