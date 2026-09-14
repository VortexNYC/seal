import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Text } from "@cloudflare/kumo/components/text";
import { useEffect, useMemo, useState } from "react";

import { type Id, parseId } from "@/lib/ids";
import { cn } from "@/lib/utils";

import { getRecipientColor } from "./recipient-colors";

type RecipientRole = "signer" | "viewer" | "approver";

interface Recipient {
  _id: Id<"document_recipients">;
  email: string;
  name?: string;
  role: RecipientRole;
}

interface RecipientSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Recipient[];
  selectedRecipientId: Id<"document_recipients"> | null;
  onRecipientSelect: (recipientId: Id<"document_recipients">) => void;
  onConfirm: (fieldName: string) => void;
  fieldType: string;
  pageNumber: number;
}

function formatFieldTypeLabel(fieldType: string): string {
  const typeLabels: Record<string, string> = {
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
  return typeLabels[fieldType] || fieldType;
}

export function RecipientSelectorDialog({
  open,
  onOpenChange,
  recipients,
  selectedRecipientId,
  onRecipientSelect,
  onConfirm,
  fieldType,
  pageNumber,
}: RecipientSelectorDialogProps) {
  // Only signers can have fields assigned to them
  const signers = recipients.filter((r) => r.role === "signer");

  // Generate default field name based on type and page
  const defaultFieldName = `${formatFieldTypeLabel(fieldType)} Page ${pageNumber}`;
  const [fieldName, setFieldName] = useState(defaultFieldName);

  // Reset field name when dialog opens or field type/page changes
  useEffect(() => {
    if (open) {
      setFieldName(`${formatFieldTypeLabel(fieldType)} Page ${pageNumber}`);
    }
  }, [open, fieldType, pageNumber]);

  const options = useMemo(
    () =>
      signers
        .filter((recipient) => recipient._id)
        .map((recipient, index) => {
          const color = getRecipientColor(index);
          return {
            value: recipient._id,
            node: (
              <div className="flex items-center gap-3">
                <div
                  className={cn("h-3 w-3 flex-shrink-0 rounded-full", color.bg)}
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  <Text as="span" size="sm" variant="body">
                    {recipient.name || recipient.email}
                  </Text>
                  {recipient.name && (
                    <Text as="span" size="xs" variant="secondary">
                      {recipient.email}
                    </Text>
                  )}
                </div>
              </div>
            ),
          };
        }),
    [signers]
  );

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog>
        <Dialog.Title>Assign Field to Recipient</Dialog.Title>
        <Dialog.Description>
          Choose which recipient should fill this {fieldType} field.
        </Dialog.Description>

        <div className="space-y-4 py-4">
          {/* Field Name Input */}
          <Input
            id="fieldName"
            label="Field Name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name..."
            description="A descriptive name to identify this field."
          />

          {/* Recipient Selector */}
          <div className="space-y-2">
            {signers.length > 0 ? (
              <Select
                value={selectedRecipientId ?? ""}
                onValueChange={(value) => {
                  if (value) {
                    onRecipientSelect(parseId("document_recipients", value));
                  }
                }}
                label="Recipient"
                placeholder="Select a signer..."
                description="This recipient will see and fill this field on the signing page."
              >
                {options.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.node}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <Text as="p" size="sm" variant="secondary">
                No signers available. Only recipients with the "Signer" role can
                have fields assigned to them.
              </Text>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(fieldName.trim() || defaultFieldName)}
            disabled={!selectedRecipientId || signers.length === 0}
          >
            Place Field
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
