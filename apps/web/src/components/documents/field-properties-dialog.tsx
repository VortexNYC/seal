import { Dialog } from "@cloudflare/kumo/components/dialog";

import { type Id } from "@/lib/ids";

import { FieldPropertiesPanel } from "./field-properties-panel";
import type { FieldType } from "./field-toolbar";

interface FieldData {
  _id: Id<"signature_fields">;
  publicId: string;
  fieldType: FieldType;
  label: string;
  isRequired: boolean;
  recipientId?: Id<"document_recipients">;
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
  publicId: string;
  name?: string;
  email: string;
}

interface FieldPropertiesDialogProps {
  organizationSlug: string;
  documentPublicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FieldData | null;
  recipients: Recipient[];
  onSave?: () => void;
  onConfigurePayment?: (fieldId: Id<"signature_fields">) => void;
}

export function FieldPropertiesDialog({
  organizationSlug,
  documentPublicId,
  open,
  onOpenChange,
  field,
  recipients,
  onSave,
  onConfigurePayment,
}: FieldPropertiesDialogProps) {
  if (!field) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
    >
      <Dialog size="sm" className="gap-0 overflow-hidden p-0">
        <Dialog.Title className="sr-only">Field Properties</Dialog.Title>
        <Dialog.Description className="sr-only">
          Edit field label, requirements, and configuration
        </Dialog.Description>
        <FieldPropertiesPanel
          organizationSlug={organizationSlug}
          documentPublicId={documentPublicId}
          field={field}
          recipients={recipients}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
          onConfigurePayment={onConfigurePayment}
        />
      </Dialog>
    </Dialog.Root>
  );
}
