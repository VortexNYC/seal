import { TextFieldInput } from "./text-field-input";

interface StrikethroughFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Strikeout / redaction mark text (DocuSeal strikethrough). */
export function StrikethroughFieldInput(
  props: StrikethroughFieldInputProps
) {
  return (
    <TextFieldInput
      {...props}
      placeholder="Text to strike"
      maxLength={500}
      helpText={props.helpText ?? "Marked with strikethrough on the PDF"}
    />
  );
}
