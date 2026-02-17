import type { Id } from "@seal/backend/convex/_generated/dataModel";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FieldPropertiesPanel } from "./field-properties-panel";
import type { FieldType } from "./field-toolbar";

interface FieldData {
  _id: Id<"signature_fields">;
  fieldType: FieldType;
  label: string;
  isRequired: boolean;
  recipientId: Id<"document_recipients">;
  properties?: {
    placeholder?: string;
    defaultValue?: string;
    options?: string[];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    helpText?: string;
  };
  validationRules?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
}

interface Recipient {
  _id: Id<"document_recipients">;
  name?: string;
  email: string;
}

interface FieldPropertiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FieldData | null;
  recipients: Recipient[];
  onSave?: () => void;
  onConfigurePayment?: (fieldId: Id<"signature_fields">) => void;
}

export function FieldPropertiesDialog({
  open,
  onOpenChange,
  field,
  recipients,
  onSave,
  onConfigurePayment,
}: FieldPropertiesDialogProps) {
  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Field Properties</DialogTitle>
          <DialogDescription>
            Edit field label, requirements, and configuration
          </DialogDescription>
        </DialogHeader>
        <FieldPropertiesPanel
          field={field}
          recipients={recipients}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
          onConfigurePayment={onConfigurePayment}
        />
      </DialogContent>
    </Dialog>
  );
}
