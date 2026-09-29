import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Select } from "@cloudflare/kumo/components/select";
import { Text } from "@cloudflare/kumo/components/text";
import { useMemo } from "react";

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
    free_signature: "Free signature",
    initials: "Initials",
    name: "Name",
    email: "Email",
    text: "Text",
    number: "Number",
    date: "Date",
    date_signed: "Date signed",
    checkbox: "Checkbox",
    dropdown: "Dropdown",
    radio: "Radio",
    attachment: "File",
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
  pageNumber: _pageNumber,
}: RecipientSelectorDialogProps) {
  void _pageNumber;
  const signers = recipients.filter((r) => r.role === "signer");
  const label = formatFieldTypeLabel(fieldType);

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
        <Dialog.Title>Who fills this {label.toLowerCase()}?</Dialog.Title>
        <Dialog.Description>
          Pick the signer for this field.
        </Dialog.Description>

        <div className="space-y-4 py-4">
          {signers.length > 0 ? (
            <Select
              value={selectedRecipientId ?? ""}
              onValueChange={(value) => {
                if (value) {
                  onRecipientSelect(parseId("document_recipients", value));
                }
              }}
              label="Signer"
              placeholder="Select a signer…"
              renderValue={(value) => {
                const selected = signers.find((signer) => signer._id === value);
                if (!selected) return "Select a signer…";
                return selected.name || selected.email;
              }}
            >
              {options.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.node}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <Text as="p" size="sm" variant="secondary">
              No signers available. Add a recipient with the Signer role first.
            </Text>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(label)}
            disabled={!selectedRecipientId || signers.length === 0}
          >
            Place field
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
