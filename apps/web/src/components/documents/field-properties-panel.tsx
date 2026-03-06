/**
 * Field Properties Panel Component
 *
 * SEA-92: Side panel for configuring field properties after placement.
 * Allows users to edit label, required status, placeholder, help text,
 * and validation rules for signature fields.
 */

import { useMutation } from "convex/react";
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

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
  name?: string;
  email: string;
}

interface FieldPropertiesPanelProps {
  field: FieldData;
  recipients: Recipient[];
  onClose: () => void;
  onSave?: () => void;
  onConfigurePayment?: (fieldId: Id<"signature_fields">) => void;
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
  field,
  recipients,
  onClose,
  onSave,
  onConfigurePayment,
}: FieldPropertiesPanelProps) {
  // Local state for form fields
  const [label, setLabel] = useState(field.label);
  const [isRequired, setIsRequired] = useState(field.isRequired);
  const [placeholder, setPlaceholder] = useState(field.properties?.placeholder ?? "");
  const [helpText, setHelpText] = useState(field.properties?.helpText ?? "");
  const [maxLength, setMaxLength] = useState<number | undefined>(field.properties?.maxLength);
  const [minLength, setMinLength] = useState<number | undefined>(field.properties?.minLength);
  const [validationPattern, setValidationPattern] = useState(() => {
    const pattern = field.properties?.pattern;
    if (!pattern) return "none";
    const found = VALIDATION_PATTERNS.find((p) => p.pattern === pattern);
    return found ? found.value : "custom";
  });
  const [customPattern, setCustomPattern] = useState(field.properties?.pattern ?? "");
  const [customMessage, setCustomMessage] = useState(field.validationRules?.customMessage ?? "");
  const [minValue, setMinValue] = useState<number | undefined>(field.validationRules?.min);
  const [maxValue, setMaxValue] = useState<number | undefined>(field.validationRules?.max);

  // Track saving state
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when field changes
  useEffect(() => {
    setLabel(field.label);
    setIsRequired(field.isRequired);
    setPlaceholder(field.properties?.placeholder ?? "");
    setHelpText(field.properties?.helpText ?? "");
    setMaxLength(field.properties?.maxLength);
    setMinLength(field.properties?.minLength);
    setCustomMessage(field.validationRules?.customMessage ?? "");
    setMinValue(field.validationRules?.min);
    setMaxValue(field.validationRules?.max);

    const pattern = field.properties?.pattern;
    if (!pattern) {
      setValidationPattern("none");
      setCustomPattern("");
    } else {
      const found = VALIDATION_PATTERNS.find((p) => p.pattern === pattern);
      if (found) {
        setValidationPattern(found.value);
        setCustomPattern("");
      } else {
        setValidationPattern("custom");
        setCustomPattern(pattern);
      }
    }
  }, [field]);

  const updateField = useMutation(api.signature_fields.mutations.updateField);
  const assignField = useMutation(api.signature_fields.mutations.assignFieldToRecipient);

  // Recipient assignment state
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    field.recipientId ?? "unassigned",
  );

  // Update recipient selection when field changes
  useEffect(() => {
    setSelectedRecipientId(field.recipientId ?? "unassigned");
  }, [field.recipientId]);

  const handleRecipientChange = async (value: string) => {
    if (value === "unassigned" || value === selectedRecipientId) return;
    setSelectedRecipientId(value);
    try {
      await assignField({
        fieldId: field._id,
        recipientId: value as Id<"document_recipients">,
      });
      toast.success("Field assigned to recipient");
      onSave?.();
    } catch (error) {
      setSelectedRecipientId(field.recipientId ?? "unassigned");
      toast.error(error instanceof Error ? error.message : "Failed to assign field");
    }
  };

  // Save function
  const handleSave = async () => {
    setIsSaving(true);

    // Determine the pattern to use
    let patternToSave: string | undefined;
    if (validationPattern === "custom" && customPattern) {
      patternToSave = customPattern;
    } else if (
      validationPattern &&
      validationPattern !== "custom" &&
      validationPattern !== "none"
    ) {
      const found = VALIDATION_PATTERNS.find((p) => p.value === validationPattern);
      patternToSave = found?.pattern;
    }

    try {
      await updateField({
        fieldId: field._id,
        label,
        isRequired,
        properties: {
          placeholder: placeholder || undefined,
          helpText: helpText || undefined,
          maxLength: maxLength || undefined,
          minLength: minLength || undefined,
          pattern: patternToSave,
          // Preserve existing options
          options: field.properties?.options,
          defaultValue: field.properties?.defaultValue,
        },
        validationRules: {
          required: isRequired,
          pattern: patternToSave,
          customMessage: customMessage || undefined,
          min: minValue,
          max: maxValue,
        },
      });

      toast.success("Field updated");
      onSave?.();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update field";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Determine which fields to show based on field type
  const showPlaceholder =
    field.fieldType === "text" || field.fieldType === "number" || field.fieldType === "date";
  const showValidation = field.fieldType === "text";
  const showLengthLimits = field.fieldType === "text";
  const showValueRange = field.fieldType === "number";

  return (
    <div className="field-properties-panel bg-background flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <div className={cn("rounded-md border p-1.5", FIELD_COLORS[field.fieldType])}>
            {FIELD_ICONS[field.fieldType]}
          </div>
          <div>
            <h3 className="text-sm font-medium">Field Properties</h3>
            <p className="text-muted-foreground text-xs">
              {FIELD_TYPE_LABELS[field.fieldType]} Field
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close field properties" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Assigned Recipient */}
        <div className="space-y-2">
          <Label htmlFor="field-recipient">Assigned to</Label>
          {recipients.length > 0 ? (
            <Select value={selectedRecipientId} onValueChange={handleRecipientChange}>
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
                {recipients.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name ? `${r.name} (${r.email})` : r.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-muted-foreground text-xs">Add a recipient to the document first</p>
          )}
          {selectedRecipientId === "unassigned" && recipients.length > 0 && (
            <p className="text-warning flex items-center gap-1 text-xs">
              <AlertTriangleIcon className="h-3 w-3" />
              This field must be assigned before sending
            </p>
          )}
        </div>

        {/* Configure Payment button for payment fields */}
        {field.fieldType === "payment" && onConfigurePayment && (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-field-payment-border bg-field-payment-surface text-field-payment hover:bg-field-payment-surface/80"
              onClick={() => onConfigurePayment(field._id)}
            >
              <CreditCardIcon className="mr-2 h-4 w-4" />
              Configure Payment
            </Button>
            <p className="text-muted-foreground text-xs">
              Set up line items, payment terms, and methods
            </p>
          </div>
        )}

        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor="field-label">Label</Label>
          <Input
            id="field-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter field label"
          />
          <p className="text-muted-foreground text-xs">The name displayed on the field</p>
        </div>

        {/* Required Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="field-required">Required</Label>
            <p className="text-muted-foreground text-xs">Must be filled before submission</p>
          </div>
          <Switch id="field-required" checked={isRequired} onCheckedChange={setIsRequired} />
        </div>

        {/* Placeholder (for text and date fields) */}
        {showPlaceholder && (
          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Enter placeholder text"
            />
            <p className="text-muted-foreground text-xs">Shown when the field is empty</p>
          </div>
        )}

        {/* Help Text */}
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
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Add instructions for the signer"
            rows={2}
          />
          <p className="text-muted-foreground text-xs">Additional guidance for the recipient</p>
        </div>

        {/* Validation Section (for text fields) */}
        {showValidation && (
          <div className="space-y-4 border-t pt-2">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Validation</span>
            </div>

            {/* Validation Pattern */}
            <div className="space-y-2">
              <Label htmlFor="field-validation">Format</Label>
              <Select
                value={validationPattern}
                onValueChange={(value) => {
                  setValidationPattern(value);
                  if (value !== "custom") {
                    setCustomPattern("");
                  }
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

            {/* Custom Pattern */}
            {validationPattern === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="field-custom-pattern">Custom Pattern (Regex)</Label>
                <Input
                  id="field-custom-pattern"
                  value={customPattern}
                  onChange={(e) => setCustomPattern(e.target.value)}
                  placeholder="^[a-zA-Z]+$"
                  className="font-mono text-sm"
                />
              </div>
            )}

            {/* Custom Error Message */}
            {validationPattern && validationPattern !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="field-error-message">Error Message</Label>
                <Input
                  id="field-error-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Please enter a valid value"
                />
                <p className="text-muted-foreground text-xs">Shown when validation fails</p>
              </div>
            )}
          </div>
        )}

        {/* Length Limits (for text fields) */}
        {showLengthLimits && (
          <div className="space-y-4 border-t pt-2">
            <span className="text-sm font-medium">Length Limits</span>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-min-length">Min Length</Label>
                <Input
                  id="field-min-length"
                  type="number"
                  min={0}
                  value={minLength ?? ""}
                  onChange={(e) =>
                    setMinLength(e.target.value ? Number.parseInt(e.target.value, 10) : undefined)
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-max-length">Max Length</Label>
                <Input
                  id="field-max-length"
                  type="number"
                  min={0}
                  value={maxLength ?? ""}
                  onChange={(e) =>
                    setMaxLength(e.target.value ? Number.parseInt(e.target.value, 10) : undefined)
                  }
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
        )}

        {/* Value Range (for number fields) */}
        {showValueRange && (
          <div className="space-y-4 border-t pt-2">
            <span className="text-sm font-medium">Value Range</span>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-min-value">Min Value</Label>
                <Input
                  id="field-min-value"
                  type="number"
                  value={minValue ?? ""}
                  onChange={(e) =>
                    setMinValue(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                  }
                  placeholder="No min"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-max-value">Max Value</Label>
                <Input
                  id="field-max-value"
                  type="number"
                  value={maxValue ?? ""}
                  onChange={(e) =>
                    setMaxValue(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                  }
                  placeholder="No max"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-muted/30 border-t p-4">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
