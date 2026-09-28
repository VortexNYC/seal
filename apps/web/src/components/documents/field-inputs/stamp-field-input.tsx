import { AttachmentFieldInput } from "./attachment-field-input";

interface StampFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  signingToken?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Company / rubber stamp image (DocuSeal stamp). */
export function StampFieldInput(props: StampFieldInputProps) {
  return (
    <AttachmentFieldInput
      {...props}
      helpText={props.helpText ?? "Upload a stamp or seal image"}
    />
  );
}
