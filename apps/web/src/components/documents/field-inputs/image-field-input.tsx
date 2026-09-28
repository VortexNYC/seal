import { AttachmentFieldInput } from "./attachment-field-input";

interface ImageFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  signingToken?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Image upload field (DocuSeal image). */
export function ImageFieldInput(
  props: ImageFieldInputProps
) {
  return (
    <AttachmentFieldInput
      {...props}
      helpText={props.helpText ?? "Upload an image (PNG, JPG, WebP)"}
    />
  );
}
