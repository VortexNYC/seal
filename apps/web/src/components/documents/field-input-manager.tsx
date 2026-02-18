import { useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AttachmentFieldInput,
  CheckboxFieldInput,
  DateFieldInput,
  DropdownFieldInput,
  NumberFieldInput,
  PaymentFieldSummary,
  RadioFieldInput,
  TextFieldInput,
} from "./field-inputs";
import { SignatureCapture } from "./signature-capture";

interface FieldInputManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: Id<"signature_fields">;
  fieldType: FieldType;
  label: string;
  isRequired: boolean;
  currentValue?: string;
  currentSignatureImageUrl?: string;
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
    min?: number;
    max?: number;
  };
  onSave: (value?: string, signatureImageUrl?: string) => Promise<void>;
  recipientName?: string;
  signingToken?: string;
}

export function FieldInputManager({
  open,
  onOpenChange,
  fieldId,
  fieldType,
  label,
  isRequired,
  currentValue,
  currentSignatureImageUrl,
  properties,
  validationRules,
  onSave,
  recipientName,
  signingToken,
}: FieldInputManagerProps) {
  const [value, setValue] = useState(currentValue || properties?.defaultValue || "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(currentSignatureImageUrl);
  const [isValid, setIsValid] = useState(!isRequired); // If not required, start as valid
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleValidationChange = (valid: boolean, error?: string) => {
    setIsValid(valid);
    setValidationError(error);
  };

  const handleSave = async () => {
    if (!isValid) {
      toast.error(validationError || "Please fix validation errors");
      return;
    }

    if (isRequired && !value && !signatureImageUrl) {
      toast.error("This field is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(value || undefined, signatureImageUrl);
      toast.success("Field saved successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save field", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(currentValue || "");
    setSignatureImageUrl(currentSignatureImageUrl);
    setIsValid(!isRequired);
    setValidationError(undefined);
    onOpenChange(false);
  };

  // Signature capture handlers
  const handleSignatureCapture = async (
    signatureData: string,
    _signatureType: "drawn" | "typed" | "uploaded",
  ) => {
    setSignatureImageUrl(signatureData);
    setIsSaving(true);
    try {
      await onSave(undefined, signatureData);
      toast.success("Signature saved successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save signature", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSignature = () => {
    onOpenChange(false);
  };

  // Render appropriate input component based on field type
  const renderFieldInput = () => {
    const commonProps = {
      label,
      value,
      isRequired,
      helpText: properties?.helpText,
      onChange: setValue,
      onValidationChange: handleValidationChange,
    };

    switch (fieldType) {
      case "text":
        return (
          <TextFieldInput
            {...commonProps}
            placeholder={properties?.placeholder}
            maxLength={properties?.maxLength}
            minLength={properties?.minLength}
            pattern={properties?.pattern}
          />
        );

      case "number":
        return (
          <NumberFieldInput
            {...commonProps}
            placeholder={properties?.placeholder}
            min={validationRules?.min}
            max={validationRules?.max}
          />
        );

      case "date":
        return <DateFieldInput {...commonProps} />;

      case "checkbox":
        return <CheckboxFieldInput {...commonProps} options={properties?.options || []} />;

      case "dropdown":
        return <DropdownFieldInput {...commonProps} options={properties?.options || []} />;

      case "radio":
        return <RadioFieldInput {...commonProps} options={properties?.options || []} />;

      case "attachment":
        return <AttachmentFieldInput {...commonProps} signingToken={signingToken} />;

      case "payment":
        return <PaymentFieldSummary fieldId={fieldId} />;

      case "signature":
        return (
          <SignatureCapture
            recipientName={recipientName}
            onSignatureCapture={handleSignatureCapture}
            onCancel={handleCancelSignature}
          />
        );

      default:
        return (
          <div className="py-4 text-center">
            <p className="text-destructive text-sm">Unsupported field type: {fieldType}</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={fieldType === "signature" ? "max-w-2xl" : fieldType === "payment" ? "max-w-lg" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>
            {fieldType === "signature"
              ? "Sign Here"
              : fieldType === "payment"
                ? "Payment Details"
                : "Fill Field"}
          </DialogTitle>
          <DialogDescription>
            {fieldType === "signature"
              ? "Draw, type, or upload your signature below."
              : fieldType === "payment"
                ? "Review the payment details below."
                : isRequired
                  ? "This field is required. Please provide a value."
                  : "Fill in the field value below."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderFieldInput()}</div>

        {/* Only show footer for non-signature, non-payment fields (signature has its own buttons, payment is read-only) */}
        {fieldType !== "signature" && fieldType !== "payment" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || (!isValid && isRequired)}>
              {isSaving ? "Saving..." : "Save Field"}
            </Button>
          </DialogFooter>
        )}
        {fieldType === "payment" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
