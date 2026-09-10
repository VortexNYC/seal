import { useEffect, useState } from "react";

import { type Id, parseId } from "@/lib/ids";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Field to Recipient</DialogTitle>
          <DialogDescription>
            Choose which recipient should fill this {fieldType} field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Name Input */}
          <div className="space-y-2">
            <Label htmlFor="fieldName">Field Name</Label>
            <Input
              id="fieldName"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Enter field name..."
            />
            <p className="text-muted-foreground text-xs">
              A descriptive name to identify this field.
            </p>
          </div>

          {/* Recipient Selector */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            {signers.length > 0 ? (
              <>
                <Select
                  value={selectedRecipientId ?? ""}
                  onValueChange={(value) => {
                    if (value) {
                      onRecipientSelect(parseId("document_recipients", value));
                    }
                  }}
                >
                  <SelectTrigger id="recipient">
                    <SelectValue placeholder="Select a signer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {signers
                      .filter((recipient) => recipient._id)
                      .map((recipient, index) => {
                        const color = getRecipientColor(index);
                        return (
                          <SelectItem key={recipient._id} value={recipient._id}>
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-3 w-3 flex-shrink-0 rounded-full",
                                  color.bg
                                )}
                                aria-hidden="true"
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {recipient.name || recipient.email}
                                </span>
                                {recipient.name && (
                                  <span className="text-muted-foreground text-xs">
                                    {recipient.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  This recipient will see and fill this field on the signing
                  page.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground py-2 text-sm">
                No signers available. Only recipients with the "Signer" role can
                have fields assigned to them.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(fieldName.trim() || defaultFieldName)}
            disabled={!selectedRecipientId || signers.length === 0}
          >
            Place Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
