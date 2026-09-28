import { TextFieldInput } from "./text-field-input";

interface EmailFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function EmailFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: EmailFieldInputProps): React.ReactElement {
  return (
    <TextFieldInput
      label={label}
      value={value}
      isRequired={isRequired}
      placeholder="name@example.com"
      maxLength={320}
      pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
      helpText={helpText}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />
  );
}
