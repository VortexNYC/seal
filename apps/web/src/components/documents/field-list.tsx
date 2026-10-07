import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import {
  CalendarBlank,
  CaretDown,
  CheckSquare,
  CreditCard,
  Gear,
  Hash,
  Pencil,
  Paperclip,
  RadioButton,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/field-types";
import { type Id } from "@/lib/ids";
import { formatMoney, money } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  signature: <Pencil className="size-4" />,
  free_signature: <Pencil className="size-4" />,
  initials: <TextT className="size-4" />,
  name: <TextT className="size-4" />,
  email: <TextT className="size-4" />,
  text: <TextT className="size-4" />,
  number: <Hash className="size-4" />,
  date: <CalendarBlank className="size-4" />,
  date_signed: <CalendarBlank className="size-4" />,
  checkbox: <CheckSquare className="size-4" />,
  dropdown: <CaretDown className="size-4" />,
  radio: <RadioButton className="size-4" />,
  multi_select: <CheckSquare className="size-4" />,
  attachment: <Paperclip className="size-4" />,
  image: <Paperclip className="size-4" />,
  payment: <CreditCard className="size-4" />,
  phone: <TextT className="size-4" />,
  cells: <Hash className="size-4" />,
  stamp: <Paperclip className="size-4" />,
  heading: <TextT className="size-4" />,
  strikethrough: <TextT className="size-4" />,
  verification: <Gear className="size-4" />,
  kba: <Gear className="size-4" />,
};

const FIELD_LABELS = FIELD_TYPE_LABELS;

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  installments: "Installments",
  deposit_balance: "Deposit + Balance",
};

function formatCents(cents: number, currency = "usd"): string {
  return formatMoney(money(cents, currency.toUpperCase()), {
    locale: "en-US",
    intl: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  });
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
          ? "border-kumo-primary bg-kumo-primary/5"
          : "border-kumo-hairline bg-kumo-surface hover:border-kumo-primary/50 hover:bg-kumo-elevated/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="text-kumo-default mt-0.5">
            {FIELD_ICONS[field.fieldType]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Text as="span" size="sm" variant="body">
                {field.label || FIELD_LABELS[field.fieldType]}
              </Text>
              <Badge variant="outline">
                Page {field.page}
              </Badge>
            </div>
            {recipient ? (
              <div className="mt-1 space-y-0.5 text-xs">
                {recipient.name && (
                  <Text
                    as="p"
                    size="xs"
                    variant="body"
                    DANGEROUS_className="truncate"
                  >
                    {recipient.name}
                  </Text>
                )}
                <Text
                  as="p"
                  size="xs"
                  variant="secondary"
                  DANGEROUS_className="truncate"
                >
                  {recipient.email}
                </Text>
              </div>
            ) : (
              <Text as="p" size="xs" variant="secondary">
                Unassigned
              </Text>
            )}
            {field.fieldType === "payment" && field.paymentConfig && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <Text as="span" size="xs" variant="body">
                  {formatCents(
                    field.paymentConfig.totalAmountCents,
                    field.paymentConfig.currency
                  )}
                </Text>
                <Text as="span" size="xs" variant="secondary">
                  •
                </Text>
                <Text as="span" size="xs" variant="secondary">
                  {PAYMENT_TYPE_LABELS[field.paymentConfig.paymentType] ??
                    field.paymentConfig.paymentType}
                </Text>
              </div>
            )}
            {field.fieldType === "payment" && !field.paymentConfig && (
              <Text as="p" size="xs" variant="secondary">
                Not configured
              </Text>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <span title="Edit this field" className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Open field properties"
              onClick={(e) => {
                e.stopPropagation();
                onFieldProperties?.(field._id);
              }}
              icon={Gear}
            />
            </span>
            <span title="Delete this field" className="inline-flex">
            <Button
              variant="destructive"
              size="sm"
              shape="square"
              aria-label="Delete this field"
              icon={Trash}
              onClick={(e) => {
                e.stopPropagation();
                onFieldSelect?.(field._id);
                setTimeout(() => {
                  onFieldDelete?.(field._id);
                }, 0);
              }}
            />
            </span>
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
  recipientMap: Map<
    Id<"document_recipients">,
    { name?: string; email: string }
  >;
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
    <div ref={parentRef} className="max-h-vh-60 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const field = fields[virtualRow.index];
          const recipient = field.recipientId
            ? recipientMap.get(field.recipientId)
            : undefined;
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
  const recipientMap = new Map(
    recipients.map((r) => [r._id, { name: r.name, email: r.email }])
  );

  if (fields.length === 0) {
    return (
      <div className="py-8 text-center">
        <Text as="p" size="sm" variant="secondary">
          No fields added yet
        </Text>
        <Text as="p" size="xs" variant="secondary">
          Drag fields from the toolbar onto the document
        </Text>
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
        const recipient = field.recipientId
          ? recipientMap.get(field.recipientId)
          : undefined;
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
