import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Calendar as CalendarIcon, CalendarCheck as CalendarCheckIcon, CaretCircleDown as ChevronDownSquareIcon, CaretDown as ChevronDownIcon, CheckSquare as CheckSquareIcon, RadioButton as CircleDotIcon, Columns as Columns3Icon, CreditCard as CreditCardIcon, Hash as HashIcon, IdentificationCard as IdCardIcon, Image as ImageIcon, ListChecks as ListChecksIcon, Paperclip as PaperclipIcon, Pen as PenLineIcon, PenNib as PenToolIcon, Phone as PhoneIcon, ShieldCheck as ShieldCheckIcon, Stamp as StampIcon, TextH as HeadingIcon, TextStrikethrough as StrikethroughIcon, TextT as TypeIcon, User as UserIcon } from "@phosphor-icons/react";
import { useState } from "react";

import {
  FIELD_DIMENSIONS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FieldType,
} from "@/lib/field-types";
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

/** Everyday send-path types — rest live under More. */
const PRIMARY_FIELD_TYPES: readonly FieldType[] = [
  "signature",
  "initials",
  "name",
  "email",
  "date",
  "text",
  "checkbox",
  "date_signed",
];

const PRIMARY_SET = new Set<FieldType>(PRIMARY_FIELD_TYPES);

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
  payment: "var(--kumo-info)",
  phone: "var(--field-phone)",
  cells: "var(--field-cells)",
  stamp: "var(--field-stamp)",
  heading: "var(--field-heading)",
  strikethrough: "var(--field-strikethrough)",
  verification: "var(--field-verification)",
  kba: "var(--field-kba)",
};

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  signature: <PenToolIcon className="h-3.5 w-3.5" />,
  free_signature: <PenLineIcon className="h-3.5 w-3.5" />,
  initials: <TypeIcon className="h-3.5 w-3.5" />,
  name: <UserIcon className="h-3.5 w-3.5" />,
  email: <TypeIcon className="h-3.5 w-3.5" />,
  text: <TypeIcon className="h-3.5 w-3.5" />,
  number: <HashIcon className="h-3.5 w-3.5" />,
  date: <CalendarIcon className="h-3.5 w-3.5" />,
  date_signed: <CalendarCheckIcon className="h-3.5 w-3.5" />,
  checkbox: <CheckSquareIcon className="h-3.5 w-3.5" />,
  dropdown: <ChevronDownSquareIcon className="h-3.5 w-3.5" />,
  radio: <CircleDotIcon className="h-3.5 w-3.5" />,
  multi_select: <ListChecksIcon className="h-3.5 w-3.5" />,
  attachment: <PaperclipIcon className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  payment: <CreditCardIcon className="h-3.5 w-3.5" />,
  phone: <PhoneIcon className="h-3.5 w-3.5" />,
  cells: <Columns3Icon className="h-3.5 w-3.5" />,
  stamp: <StampIcon className="h-3.5 w-3.5" />,
  heading: <HeadingIcon className="h-3.5 w-3.5" />,
  strikethrough: <StrikethroughIcon className="h-3.5 w-3.5" />,
  verification: <IdCardIcon className="h-3.5 w-3.5" />,
  kba: <ShieldCheckIcon className="h-3.5 w-3.5" />,
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
  const accentColor = FIELD_ACCENT[type];

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
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
    onDragEnd();
  };

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full cursor-grab justify-start active:cursor-grabbing"
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      disabled={disabled}
      title={disabled ? disabledReason : `Drag ${label} onto the document`}
      icon={icon}
    >
      {label}
    </Button>
  );
}

function getPaymentDisabledReason(merchantPaymentsReady: boolean): string {
  return merchantPaymentsReady
    ? "Payment fields are temporarily disabled while payments are migrated to the Worker backend."
    : "Connect a merchant account to add payment fields.";
}

function FieldGrid({
  types,
  disabled,
  merchantPaymentsReady,
  onDragStart,
  onDragEnd,
}: {
  types: readonly FieldType[];
  disabled?: boolean;
  merchantPaymentsReady: boolean;
  onDragStart: (fieldType: FieldType) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {types.map((type) => {
        const isPayment = type === "payment";
        const isDisabled = disabled || isPayment;
        const disabledReason = isPayment
          ? getPaymentDisabledReason(merchantPaymentsReady)
          : "Add a recipient before placing fields.";

        return (
          <FieldButton
            key={type}
            type={type}
            icon={FIELD_ICONS[type]}
            label={FIELD_TYPE_LABELS[type]}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            disabled={isDisabled}
            disabledReason={disabledReason}
          />
        );
      })}
    </div>
  );
}

/**
 * Field palette — common types first; power types under More.
 */
export function FieldToolbar({
  onFieldDragStart,
  onFieldDragEnd,
  disabled,
  merchantPaymentsReady = false,
  documentId,
}: FieldToolbarProps) {
  void documentId;
  const [showMore, setShowMore] = useState(false);

  const handleDragStart = (fieldType: FieldType) => {
    onFieldDragStart?.(fieldType);
  };

  const handleDragEnd = () => {
    onFieldDragEnd?.();
  };

  const moreTypes = FIELD_TYPES.filter((type) => !PRIMARY_SET.has(type));

  return (
    <div className="flex flex-col gap-2">
      {disabled ? (
        <Text as="p" variant="secondary" size="xs">Add a recipient first, then drag fields onto the PDF.</Text>
      ) : null}
      <FieldGrid
        types={PRIMARY_FIELD_TYPES}
        disabled={disabled}
        merchantPaymentsReady={merchantPaymentsReady}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        icon={ChevronDownIcon}
        onClick={() => setShowMore((open) => !open)}
        aria-expanded={showMore}
      >
        {showMore ? "Fewer fields" : "More fields"}
      </Button>
      {showMore ? (
        <FieldGrid
          types={moreTypes}
          disabled={disabled}
          merchantPaymentsReady={merchantPaymentsReady}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      ) : null}
    </div>
  );
}
