import { TextFieldInput } from "./text-field-input";

interface HeadingFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Section heading text burned into the PDF (DocuSeal heading). */
export function HeadingFieldInput(props: HeadingFieldInputProps) {
  return (
    <TextFieldInput
      {...props}
      placeholder="Heading"
      maxLength={200}
      helpText={props.helpText ?? "Displayed as a heading on the document"}
    />
  );
}
