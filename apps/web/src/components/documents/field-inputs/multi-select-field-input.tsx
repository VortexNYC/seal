import { CheckboxFieldInput } from "./checkbox-field-input";

interface MultiSelectFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  options: string[];
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Multi-select (DocuSeal `multiple`) — stores selected options as JSON array string. */
export function MultiSelectFieldInput(props: MultiSelectFieldInputProps) {
  return (
    <CheckboxFieldInput
      {...props}
      helpText={props.helpText ?? "Select all that apply"}
    />
  );
}
