import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";

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

interface FieldInputContentProps {
  fieldId: Id<"signature_fields">;
  fieldType: FieldType;
  label: string;
  value: string;
  isRequired: boolean;
  properties?: FieldInputManagerProps["properties"];
  validationRules?: FieldInputManagerProps["validationRules"];
  signingToken?: string;
  recipientName?: string;
  onValueChange: (value: string) => void;
  onValidationChange: (valid: boolean, error?: string) => void;
  onSignatureCapture: (
    signatureData: string,
    signatureType: "drawn" | "typed" | "uploaded"
  ) => Promise<void>;
  onCancelSignature: () => void;
}

interface CommonFieldInputProps {
  label: string;
  value: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (valid: boolean, error?: string) => void;
}

type FieldRendererProps = FieldInputContentProps & {
  commonProps: CommonFieldInputProps;
};

const FIELD_INPUT_RENDERERS: Record<
  FieldType,
  (props: FieldRendererProps) => ReactNode
> = {
  text: ({ commonProps, properties }) => (
    <TextFieldInput
      {...commonProps}
      placeholder={properties?.placeholder}
      maxLength={properties?.maxLength}
      minLength={properties?.minLength}
      pattern={properties?.pattern}
    />
  ),
  number: ({ commonProps, properties, validationRules }) => (
    <NumberFieldInput
      {...commonProps}
      placeholder={properties?.placeholder}
      min={validationRules?.min}
      max={validationRules?.max}
    />
  ),
  date: ({ commonProps }) => <DateFieldInput {...commonProps} />,
  checkbox: ({ commonProps, properties }) => (
    <CheckboxFieldInput {...commonProps} options={properties?.options || []} />
  ),
  dropdown: ({ commonProps, properties }) => (
    <DropdownFieldInput {...commonProps} options={properties?.options || []} />
  ),
  radio: ({ commonProps, properties }) => (
    <RadioFieldInput {...commonProps} options={properties?.options || []} />
  ),
  attachment: ({ commonProps, signingToken }) => (
    <AttachmentFieldInput {...commonProps} signingToken={signingToken} />
  ),
  payment: ({ fieldId, signingToken }) => (
    <PaymentFieldSummary
      fieldId={fieldId}
      token={signingToken}
      showInlinePayment={!!signingToken}
    />
  ),
  signature: ({ recipientName, onSignatureCapture, onCancelSignature }) => (
    <SignatureCapture
      recipientName={recipientName}
      onSignatureCapture={onSignatureCapture}
      onCancel={onCancelSignature}
    />
  ),
};

function getDialogClassName(fieldType: FieldType): string {
  if (fieldType === "signature") return "max-w-2xl";
  if (fieldType === "payment") return "max-w-lg";
  return "max-w-md";
}

function getDialogText(fieldType: FieldType, isRequired: boolean) {
  if (fieldType === "signature") {
    return {
      title: "Sign Here",
      description: "Draw, type, or upload your signature below.",
    };
  }
  if (fieldType === "payment") {
    return {
      title: "Payment Details",
      description: "Review the payment details below.",
    };
  }
  return {
    title: "Fill Field",
    description: isRequired
      ? "This field is required. Please provide a value."
      : "Fill in the field value below.",
  };
}

function FieldInputContent({
  fieldId,
  fieldType,
  label,
  value,
  isRequired,
  properties,
  validationRules,
  signingToken,
  recipientName,
  onValueChange,
  onValidationChange,
  onSignatureCapture,
  onCancelSignature,
}: FieldInputContentProps) {
  const commonProps = {
    label,
    value,
    isRequired,
    helpText: properties?.helpText,
    onChange: onValueChange,
    onValidationChange,
  };

  return FIELD_INPUT_RENDERERS[fieldType]({
    fieldId,
    fieldType,
    label,
    value,
    isRequired,
    properties,
    validationRules,
    signingToken,
    recipientName,
    onValueChange,
    onValidationChange,
    onSignatureCapture,
    onCancelSignature,
    commonProps,
  });
}

interface FieldInputFooterProps {
  fieldType: FieldType;
  isSaving: boolean;
  isValid: boolean;
  isRequired: boolean;
  onCancel: () => void;
  onSave: () => void;
  onClose: () => void;
}

function FieldInputFooter({
  fieldType,
  isSaving,
  isValid,
  isRequired,
  onCancel,
  onSave,
  onClose,
}: FieldInputFooterProps) {
  if (fieldType === "signature") return null;
  if (fieldType === "payment") {
    return (
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={isSaving}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={isSaving || (!isValid && isRequired)}>
        {isSaving ? "Saving..." : "Save Field"}
      </Button>
    </DialogFooter>
  );
}

interface UseFieldInputStateArgs {
  currentValue?: string;
  currentSignatureImageUrl?: string;
  defaultValue?: string;
  isRequired: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: FieldInputManagerProps["onSave"];
}

function useFieldInputState({
  currentValue,
  currentSignatureImageUrl,
  defaultValue,
  isRequired,
  onOpenChange,
  onSave,
}: UseFieldInputStateArgs) {
  const [value, setValue] = useState(currentValue || defaultValue || "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(
    currentSignatureImageUrl
  );
  const [isValid, setIsValid] = useState(!isRequired);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(currentValue || defaultValue || "");
    setSignatureImageUrl(currentSignatureImageUrl);
    setIsValid(!isRequired);
    setValidationError(undefined);
  }, [currentValue, currentSignatureImageUrl, defaultValue, isRequired]);

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

  const handleSignatureCapture = async (signatureData: string) => {
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

  return {
    value,
    setValue,
    isValid,
    isSaving,
    handleValidationChange,
    handleSave,
    handleCancel,
    handleSignatureCapture,
  };
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
  const dialogText = getDialogText(fieldType, isRequired);
  const fieldState = useFieldInputState({
    currentValue,
    currentSignatureImageUrl,
    defaultValue: properties?.defaultValue,
    isRequired,
    onOpenChange,
    onSave,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={getDialogClassName(fieldType)}>
        <DialogHeader>
          <DialogTitle>{dialogText.title}</DialogTitle>
          <DialogDescription>{dialogText.description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <FieldInputContent
            fieldId={fieldId}
            fieldType={fieldType}
            label={label}
            value={fieldState.value}
            isRequired={isRequired}
            properties={properties}
            validationRules={validationRules}
            signingToken={signingToken}
            recipientName={recipientName}
            onValueChange={fieldState.setValue}
            onValidationChange={fieldState.handleValidationChange}
            onSignatureCapture={fieldState.handleSignatureCapture}
            onCancelSignature={() => onOpenChange(false)}
          />
        </div>

        <FieldInputFooter
          fieldType={fieldType}
          isSaving={fieldState.isSaving}
          isValid={fieldState.isValid}
          isRequired={isRequired}
          onCancel={fieldState.handleCancel}
          onSave={fieldState.handleSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
