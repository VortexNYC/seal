import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CalendarIcon,
  CheckSquareIcon,
  CreditCardIcon,
  HashIcon,
  PenToolIcon,
  SettingsIcon,
  TrashIcon,
  TypeIcon,
} from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { FieldType } from "./field-toolbar";

interface FieldListItem {
  _id: Id<"signature_fields">;
  fieldType: FieldType;
  label: string;
  page: number;
  recipientId?: Id<"document_recipients">;
  recipientName?: string;
  recipientEmail?: string;
  x: number;
  y: number;
  paymentConfig?: {
    totalAmountCents: number;
    currency: string;
    paymentType: string;
    paymentStatus?: string;
  };
}

interface Recipient {
  _id: Id<"document_recipients">;
  name?: string;
  email: string;
}

interface FieldListProps {
  fields: FieldListItem[];
  recipients: Recipient[];
  selectedFieldId: string | null;
  canEdit: boolean;
  onFieldSelect?: (fieldId: string | null) => void;
  onFieldDelete?: (fieldId: string) => void;
  onFieldProperties?: (fieldId: string) => void;
}

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  signature: <PenToolIcon className="h-4 w-4" />,
  text: <TypeIcon className="h-4 w-4" />,
  number: <HashIcon className="h-4 w-4" />,
  date: <CalendarIcon className="h-4 w-4" />,
  checkbox: <CheckSquareIcon className="h-4 w-4" />,
  dropdown: <TypeIcon className="h-4 w-4" />,
  radio: <CheckSquareIcon className="h-4 w-4" />,
  attachment: <TypeIcon className="h-4 w-4" />,
  payment: <CreditCardIcon className="h-4 w-4" />,
};

const FIELD_COLORS: Record<FieldType, string> = {
  signature: "bg-field-signature-surface text-field-signature border-field-signature-border",
  text: "bg-field-text-surface text-field-text border-field-text-border",
  number: "bg-field-number-surface text-field-number border-field-number-border",
  date: "bg-field-date-surface text-field-date border-field-date-border",
  checkbox: "bg-field-checkbox-surface text-field-checkbox border-field-checkbox-border",
  dropdown: "bg-field-dropdown-surface text-field-dropdown border-field-dropdown-border",
  radio: "bg-field-radio-surface text-field-radio border-field-radio-border",
  attachment: "bg-field-attachment-surface text-field-attachment border-field-attachment-border",
  payment: "bg-field-payment-surface text-field-payment border-field-payment-border",
};

const FIELD_LABELS: Record<FieldType, string> = {
  signature: "Signature",
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
  dropdown: "Dropdown",
  radio: "Radio",
  attachment: "Attachment",
  payment: "Payment",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  installments: "Installments",
  deposit_balance: "Deposit + Balance",
};

function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const VIRTUALIZE_THRESHOLD = 20;
const ESTIMATED_ROW_HEIGHT = 80;

function FieldRow({
  field,
  recipient,
  isSelected,
  canEdit,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
}: {
  field: FieldListItem;
  recipient: { name?: string; email: string } | undefined;
  isSelected: boolean;
  canEdit: boolean;
  onFieldSelect?: (fieldId: string | null) => void;
  onFieldDelete?: (fieldId: string) => void;
  onFieldProperties?: (fieldId: string) => void;
}) {
  return (
    <div
      data-testid="signature-field"
      onClick={() => onFieldSelect?.(isSelected ? null : field._id)}
      className={cn(
        "w-full cursor-pointer rounded-lg border-2 p-3 transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className={cn("mt-0.5 rounded-md border p-1.5", FIELD_COLORS[field.fieldType])}>
            {FIELD_ICONS[field.fieldType]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {field.label || FIELD_LABELS[field.fieldType]}
              </span>
              <Badge variant="outline" className="text-xs">
                Page {field.page}
              </Badge>
            </div>
            {recipient ? (
              <div className="text-muted-foreground mt-1 text-xs">
                {recipient.name && (
                  <p className="text-foreground/80 truncate font-medium">{recipient.name}</p>
                )}
                <p className="truncate">{recipient.email}</p>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs italic">Unassigned</p>
            )}
            {field.fieldType === "payment" && field.paymentConfig && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-field-payment font-semibold">
                  {formatCents(field.paymentConfig.totalAmountCents, field.paymentConfig.currency)}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {PAYMENT_TYPE_LABELS[field.paymentConfig.paymentType] ??
                    field.paymentConfig.paymentType}
                </span>
              </div>
            )}
            {field.fieldType === "payment" && !field.paymentConfig && (
              <p className="text-muted-foreground mt-1 text-xs italic">Not configured</p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Open field properties"
              title="Field properties"
              onClick={(e) => {
                e.stopPropagation();
                onFieldProperties?.(field._id);
              }}
            >
              <SettingsIcon className="text-muted-foreground h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Delete this field"
              title="Delete field"
              onClick={(e) => {
                e.stopPropagation();
                onFieldSelect?.(field._id);
                setTimeout(() => {
                  onFieldDelete?.(field._id);
                }, 0);
              }}
            >
              <TrashIcon className="text-destructive h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function VirtualizedFieldList({
  fields,
  recipientMap,
  selectedFieldId,
  canEdit,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
}: {
  fields: FieldListItem[];
  recipientMap: Map<Id<"document_recipients">, { name?: string; email: string }>;
  selectedFieldId: string | null;
  canEdit: boolean;
  onFieldSelect?: (fieldId: string | null) => void;
  onFieldDelete?: (fieldId: string) => void;
  onFieldProperties?: (fieldId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
    gap: 8,
  });

  return (
    <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const field = fields[virtualRow.index];
          const recipient = field.recipientId ? recipientMap.get(field.recipientId) : undefined;
          const isSelected = selectedFieldId === field._id;

          return (
            <div
              key={field._id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <FieldRow
                field={field}
                recipient={recipient}
                isSelected={isSelected}
                canEdit={canEdit}
                onFieldSelect={onFieldSelect}
                onFieldDelete={onFieldDelete}
                onFieldProperties={onFieldProperties}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FieldList({
  fields,
  recipients,
  selectedFieldId,
  canEdit,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
}: FieldListProps) {
  const recipientMap = new Map(recipients.map((r) => [r._id, { name: r.name, email: r.email }]));

  if (fields.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <p className="text-sm">No fields added yet</p>
        <p className="mt-1 text-xs">Drag fields from the toolbar onto the document</p>
      </div>
    );
  }

  if (fields.length > VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualizedFieldList
        fields={fields}
        recipientMap={recipientMap}
        selectedFieldId={selectedFieldId}
        canEdit={canEdit}
        onFieldSelect={onFieldSelect}
        onFieldDelete={onFieldDelete}
        onFieldProperties={onFieldProperties}
      />
    );
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const recipient = field.recipientId ? recipientMap.get(field.recipientId) : undefined;
        const isSelected = selectedFieldId === field._id;

        return (
          <FieldRow
            key={field._id}
            field={field}
            recipient={recipient}
            isSelected={isSelected}
            canEdit={canEdit}
            onFieldSelect={onFieldSelect}
            onFieldDelete={onFieldDelete}
            onFieldProperties={onFieldProperties}
          />
        );
      })}
    </div>
  );
}
