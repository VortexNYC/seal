/**
 * Field Properties Panel Component
 *
 * SEA-92: Side panel for configuring field properties after placement.
 * Allows users to edit label, required status, placeholder, help text,
 * and validation rules for signature fields.
 */

import { useMutation } from "@tanstack/react-query";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CalendarIcon,
  CheckSquareIcon,
  CreditCardIcon,
  HashIcon,
  HelpCircleIcon,
  PenToolIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { updateSignatureField } from "@/lib/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import type { FieldType } from "./field-toolbar";

// Common validation patterns
type ValidationPatternOption = {
  value: string;
  label: string;
  pattern?: string;
};

const VALIDATION_PATTERNS: ValidationPatternOption[] = [
  { value: "none", label: "None" },
  { value: "email", label: "Email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
  { value: "phone", label: "Phone Number", pattern: "^[+]?[0-9\\s\\-()]+$" },
  { value: "number", label: "Numbers Only", pattern: "^[0-9]+$" },
  { value: "alphanumeric", label: "Alphanumeric", pattern: "^[a-zA-Z0-9]+$" },
  { value: "url", label: "URL", pattern: "^https?:\\/\\/.+" },
  { value: "custom", label: "Custom Pattern" },
];

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

interface FieldPropertiesPanelProps {
  documentPublicId: string;
  field: FieldData;
  recipients: Recipient[];
  onClose: () => void;
  onSave?: () => void;
  onConfigurePayment?: (fieldId: Id<"signature_fields">) => void;
}

function resolvePatternToSave(
  validationPattern: string,
  customPattern: string
): string | undefined {
  if (validationPattern === "custom") return customPattern || undefined;
  if (!validationPattern || validationPattern === "none") return undefined;
  return VALIDATION_PATTERNS.find(
    (pattern) => pattern.value === validationPattern
  )?.pattern;
}

function resolveValidationPattern(pattern?: string): {
  value: string;
  custom: string;
} {
  if (!pattern) return { value: "none", custom: "" };
  const found = VALIDATION_PATTERNS.find(
    (option) => option.pattern === pattern
  );
  return found
    ? { value: found.value, custom: "" }
    : { value: "custom", custom: pattern };
}

function getFieldVisibility(fieldType: FieldType) {
  return {
    showPlaceholder:
      fieldType === "text" || fieldType === "number" || fieldType === "date",
    showValidation: fieldType === "text",
    showLengthLimits: fieldType === "text",
    showValueRange: fieldType === "number",
  };
}

function recipientPublicId(
  recipientId: Id<"document_recipients"> | undefined,
  recipients: Recipient[]
): string {
  if (!recipientId) return "unassigned";
  const found = recipients.find((r) => r._id === recipientId);
  return found?.publicId ?? "unassigned";
}

function useFieldPropertiesState(field: FieldData, recipients: Recipient[]) {
  const initialPattern = resolveValidationPattern(field.properties?.pattern);
  const [label, setLabel] = useState(field.label);
  const [isRequired, setIsRequired] = useState(field.isRequired);
  const [placeholder, setPlaceholder] = useState(
    field.properties?.placeholder ?? ""
  );
  const [helpText, setHelpText] = useState(field.properties?.helpText ?? "");
  const [maxLength, setMaxLength] = useState<number | undefined>(
    field.properties?.maxLength
  );
  const [minLength, setMinLength] = useState<number | undefined>(
    field.properties?.minLength
  );
  const [validationPattern, setValidationPattern] = useState(
    initialPattern.value
  );
  const [customPattern, setCustomPattern] = useState(initialPattern.custom);
  const [customMessage, setCustomMessage] = useState(
    field.validationRules?.customMessage ?? ""
  );
  const [minValue, setMinValue] = useState<number | undefined>(
    field.validationRules?.min
  );
  const [maxValue, setMaxValue] = useState<number | undefined>(
    field.validationRules?.max
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    recipientPublicId(field.recipientId, recipients)
  );

  useEffect(() => {
    const nextPattern = resolveValidationPattern(field.properties?.pattern);
    setLabel(field.label);
    setIsRequired(field.isRequired);
    setPlaceholder(field.properties?.placeholder ?? "");
    setHelpText(field.properties?.helpText ?? "");
    setMaxLength(field.properties?.maxLength);
    setMinLength(field.properties?.minLength);
    setValidationPattern(nextPattern.value);
    setCustomPattern(nextPattern.custom);
    setCustomMessage(field.validationRules?.customMessage ?? "");
    setMinValue(field.validationRules?.min);
    setMaxValue(field.validationRules?.max);
    setSelectedRecipientId(recipientPublicId(field.recipientId, recipients));
  }, [field, recipients]);

  return {
    label,
    setLabel,
    isRequired,
    setIsRequired,
    placeholder,
    setPlaceholder,
    helpText,
    setHelpText,
    maxLength,
    setMaxLength,
    minLength,
    setMinLength,
    validationPattern,
    setValidationPattern,
    customPattern,
    setCustomPattern,
    customMessage,
    setCustomMessage,
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    isSaving,
    setIsSaving,
    selectedRecipientId,
    setSelectedRecipientId,
  };
}

function useFieldPropertiesActions({
  documentPublicId,
  field,
  recipients,
  state,
  onSave,
  onClose,
}: {
  documentPublicId: string;
  field: FieldData;
  recipients: Recipient[];
  state: ReturnType<typeof useFieldPropertiesState>;
  onSave?: () => void;
  onClose: () => void;
}) {
  const updateField = useMutation({
    mutationFn: (input: Parameters<typeof updateSignatureField>[2]) =>
      updateSignatureField(documentPublicId, field.publicId, input),
  });

  const handleRecipientChange = async (value: string) => {
    if (value === "unassigned" || value === state.selectedRecipientId) return;
    state.setSelectedRecipientId(value);
    try {
      await updateField.mutateAsync({
        recipientId: value,
      });
      toast.success("Field assigned to recipient");
      onSave?.();
    } catch (error) {
      state.setSelectedRecipientId(
        recipientPublicId(field.recipientId, recipients)
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to assign field"
      );
    }
  };

  const handleSave = async () => {
    state.setIsSaving(true);
    const patternToSave = resolvePatternToSave(
      state.validationPattern,
      state.customPattern
    );
    try {
      await updateField.mutateAsync({
        label: state.label,
        isRequired: state.isRequired,
        recipientId:
          state.selectedRecipientId === "unassigned"
            ? null
            : state.selectedRecipientId,
        properties: {
          placeholder: state.placeholder || undefined,
          helpText: state.helpText || undefined,
          maxLength: state.maxLength || undefined,
          minLength: state.minLength || undefined,
          pattern: patternToSave,
          options: field.properties?.options,
          defaultValue: field.properties?.defaultValue,
        },
        validationRules: {
          required: state.isRequired,
          pattern: patternToSave,
          customMessage: state.customMessage || undefined,
          min: state.minValue,
          max: state.maxValue,
        },
      });
      toast.success("Field updated");
      onSave?.();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update field"
      );
    } finally {
      state.setIsSaving(false);
    }
  };

  return { handleRecipientChange, handleSave };
}

function useFieldPropertiesForm({
  documentPublicId,
  field,
  recipients,
  onSave,
  onClose,
}: {
  documentPublicId: string;
  field: FieldData;
  recipients: Recipient[];
  onSave?: () => void;
  onClose: () => void;
}) {
  const state = useFieldPropertiesState(field, recipients);
  const actions = useFieldPropertiesActions({
    documentPublicId,
    field,
    recipients,
    state,
    onSave,
    onClose,
  });

  return {
    ...state,
    ...actions,
    ...getFieldVisibility(field.fieldType),
  };
}

function FieldPanelHeader({
  field,
  onClose,
}: {
  field: FieldData;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "rounded-md border p-1.5",
            FIELD_COLORS[field.fieldType]
          )}
        >
          {FIELD_ICONS[field.fieldType]}
        </div>
        <div>
          <h3 className="text-sm font-medium">Field Properties</h3>
          <p className="text-muted-foreground text-xs">
            {FIELD_TYPE_LABELS[field.fieldType]} Field
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close field properties"
        onClick={onClose}
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RecipientAssignmentSection({
  recipients,
  selectedRecipientId,
  onRecipientChange,
}: {
  recipients: Recipient[];
  selectedRecipientId: string;
  onRecipientChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="field-recipient">Assigned to</Label>
      {recipients.length > 0 ? (
        <Select value={selectedRecipientId} onValueChange={onRecipientChange}>
          <SelectTrigger
            id="field-recipient"
            className={
              selectedRecipientId === "unassigned"
                ? "border-warning/50 text-warning"
                : undefined
            }
          >
            <SelectValue placeholder="Select a recipient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned" disabled>
              Unassigned
            </SelectItem>
            {recipients.map((recipient) => (
              <SelectItem key={recipient.publicId} value={recipient.publicId}>
                {recipient.name
                  ? `${recipient.name} (${recipient.email})`
                  : recipient.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-muted-foreground text-xs">
          Add a recipient to the document first
        </p>
      )}
      {selectedRecipientId === "unassigned" && recipients.length > 0 && (
        <p className="text-warning flex items-center gap-1 text-xs">
          <AlertTriangleIcon className="h-3 w-3" />
          This field must be assigned before sending
        </p>
      )}
    </div>
  );
}

function PaymentConfigurationSection({
  field,
  onConfigurePayment,
}: {
  field: FieldData;
  onConfigurePayment?: (fieldId: Id<"signature_fields">) => void;
}) {
  if (field.fieldType !== "payment" || !onConfigurePayment) return null;

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="border-field-payment-border bg-field-payment-surface text-field-payment hover:bg-field-payment-surface/80 w-full"
        onClick={() => onConfigurePayment(field._id)}
      >
        <CreditCardIcon className="mr-2 h-4 w-4" />
        Configure Payment
      </Button>
      <p className="text-muted-foreground text-xs">
        Set up line items, payment terms, and methods
      </p>
    </div>
  );
}

function BasicFieldSettings({
  label,
  setLabel,
  isRequired,
  setIsRequired,
  placeholder,
  setPlaceholder,
  helpText,
  setHelpText,
  showPlaceholder,
}: {
  label: string;
  setLabel: (value: string) => void;
  isRequired: boolean;
  setIsRequired: (value: boolean) => void;
  placeholder: string;
  setPlaceholder: (value: string) => void;
  helpText: string;
  setHelpText: (value: string) => void;
  showPlaceholder: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="field-label">Label</Label>
        <Input
          id="field-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Enter field label"
        />
        <p className="text-muted-foreground text-xs">
          The name displayed on the field
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="field-required">Required</Label>
          <p className="text-muted-foreground text-xs">
            Must be filled before submission
          </p>
        </div>
        <Switch
          id="field-required"
          checked={isRequired}
          onCheckedChange={setIsRequired}
        />
      </div>

      {showPlaceholder && (
        <div className="space-y-2">
          <Label htmlFor="field-placeholder">Placeholder</Label>
          <Input
            id="field-placeholder"
            value={placeholder}
            onChange={(event) => setPlaceholder(event.target.value)}
            placeholder="Enter placeholder text"
          />
          <p className="text-muted-foreground text-xs">
            Shown when the field is empty
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="field-help">
          <span className="flex items-center gap-1.5">
            <HelpCircleIcon className="h-3.5 w-3.5" />
            Help Text
          </span>
        </Label>
        <Textarea
          id="field-help"
          value={helpText}
          onChange={(event) => setHelpText(event.target.value)}
          placeholder="Add instructions for the signer"
          rows={2}
        />
        <p className="text-muted-foreground text-xs">
          Additional guidance for the recipient
        </p>
      </div>
    </>
  );
}

function ValidationSettings({
  showValidation,
  validationPattern,
  setValidationPattern,
  customPattern,
  setCustomPattern,
  customMessage,
  setCustomMessage,
}: {
  showValidation: boolean;
  validationPattern: string;
  setValidationPattern: (value: string) => void;
  customPattern: string;
  setCustomPattern: (value: string) => void;
  customMessage: string;
  setCustomMessage: (value: string) => void;
}) {
  if (!showValidation) return null;

  return (
    <div className="space-y-4 border-t pt-2">
      <div className="flex items-center gap-2">
        <AlertCircleIcon className="text-muted-foreground h-4 w-4" />
        <span className="text-sm font-medium">Validation</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="field-validation">Format</Label>
        <Select
          value={validationPattern}
          onValueChange={(value) => {
            setValidationPattern(value);
            if (value !== "custom") setCustomPattern("");
          }}
        >
          <SelectTrigger id="field-validation">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            {VALIDATION_PATTERNS.map((pattern) => (
              <SelectItem key={pattern.value} value={pattern.value}>
                {pattern.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {validationPattern === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="field-custom-pattern">Custom Pattern (Regex)</Label>
          <Input
            id="field-custom-pattern"
            value={customPattern}
            onChange={(event) => setCustomPattern(event.target.value)}
            placeholder="^[a-zA-Z]+$"
            className="font-mono text-sm"
          />
        </div>
      )}
      {validationPattern && validationPattern !== "none" && (
        <div className="space-y-2">
          <Label htmlFor="field-error-message">Error Message</Label>
          <Input
            id="field-error-message"
            value={customMessage}
            onChange={(event) => setCustomMessage(event.target.value)}
            placeholder="Please enter a valid value"
          />
          <p className="text-muted-foreground text-xs">
            Shown when validation fails
          </p>
        </div>
      )}
    </div>
  );
}

function NumberInputPair({
  title,
  first,
  second,
}: {
  title: string;
  first: {
    id: string;
    label: string;
    value?: number;
    placeholder: string;
    parse: (value: string) => number;
    onChange: (value?: number) => void;
  };
  second: {
    id: string;
    label: string;
    value?: number;
    placeholder: string;
    parse: (value: string) => number;
    onChange: (value?: number) => void;
  };
}) {
  return (
    <div className="space-y-4 border-t pt-2">
      <span className="text-sm font-medium">{title}</span>
      <div className="grid grid-cols-2 gap-4">
        {[first, second].map((input) => (
          <div className="space-y-2" key={input.id}>
            <Label htmlFor={input.id}>{input.label}</Label>
            <Input
              id={input.id}
              type="number"
              min={0}
              value={input.value ?? ""}
              onChange={(event) =>
                input.onChange(
                  event.target.value
                    ? input.parse(event.target.value)
                    : undefined
                )
              }
              placeholder={input.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldPropertiesFooter({
  isSaving,
  onClose,
  onSave,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-muted/30 border-t p-4">
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
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
  signature:
    "bg-field-signature-surface text-field-signature border-field-signature-border",
  text: "bg-field-text-surface text-field-text border-field-text-border",
  number:
    "bg-field-number-surface text-field-number border-field-number-border",
  date: "bg-field-date-surface text-field-date border-field-date-border",
  checkbox:
    "bg-field-checkbox-surface text-field-checkbox border-field-checkbox-border",
  dropdown:
    "bg-field-dropdown-surface text-field-dropdown border-field-dropdown-border",
  radio: "bg-field-radio-surface text-field-radio border-field-radio-border",
  attachment:
    "bg-field-attachment-surface text-field-attachment border-field-attachment-border",
  payment:
    "bg-field-payment-surface text-field-payment border-field-payment-border",
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
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

export function FieldPropertiesPanel({
  documentPublicId,
  field,
  recipients,
  onClose,
  onSave,
  onConfigurePayment,
}: FieldPropertiesPanelProps) {
  const form = useFieldPropertiesForm({
    documentPublicId,
    field,
    recipients,
    onSave,
    onClose,
  });

  return (
    <div className="field-properties-panel bg-background flex h-full flex-col">
      <FieldPanelHeader field={field} onClose={onClose} />

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <RecipientAssignmentSection
          recipients={recipients}
          selectedRecipientId={form.selectedRecipientId}
          onRecipientChange={form.handleRecipientChange}
        />
        <PaymentConfigurationSection
          field={field}
          onConfigurePayment={onConfigurePayment}
        />
        <BasicFieldSettings
          label={form.label}
          setLabel={form.setLabel}
          isRequired={form.isRequired}
          setIsRequired={form.setIsRequired}
          placeholder={form.placeholder}
          setPlaceholder={form.setPlaceholder}
          helpText={form.helpText}
          setHelpText={form.setHelpText}
          showPlaceholder={form.showPlaceholder}
        />
        <ValidationSettings
          showValidation={form.showValidation}
          validationPattern={form.validationPattern}
          setValidationPattern={form.setValidationPattern}
          customPattern={form.customPattern}
          setCustomPattern={form.setCustomPattern}
          customMessage={form.customMessage}
          setCustomMessage={form.setCustomMessage}
        />
        {form.showLengthLimits && (
          <NumberInputPair
            title="Length Limits"
            first={{
              id: "field-min-length",
              label: "Min Length",
              value: form.minLength,
              placeholder: "0",
              parse: (value) => Number.parseInt(value, 10),
              onChange: form.setMinLength,
            }}
            second={{
              id: "field-max-length",
              label: "Max Length",
              value: form.maxLength,
              placeholder: "No limit",
              parse: (value) => Number.parseInt(value, 10),
              onChange: form.setMaxLength,
            }}
          />
        )}
        {form.showValueRange && (
          <NumberInputPair
            title="Value Range"
            first={{
              id: "field-min-value",
              label: "Min Value",
              value: form.minValue,
              placeholder: "No min",
              parse: Number.parseFloat,
              onChange: form.setMinValue,
            }}
            second={{
              id: "field-max-value",
              label: "Max Value",
              value: form.maxValue,
              placeholder: "No max",
              parse: Number.parseFloat,
              onChange: form.setMaxValue,
            }}
          />
        )}
      </div>

      <FieldPropertiesFooter
        isSaving={form.isSaving}
        onClose={onClose}
        onSave={form.handleSave}
      />
    </div>
  );
}
