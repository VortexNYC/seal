import { TextFieldInput } from "./text-field-input";

interface NameFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function NameFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  placeholder = "Full name",
  onChange,
  onValidationChange,
}: NameFieldInputProps): React.ReactElement {
  return (
    <TextFieldInput
      label={label}
      value={value}
      isRequired={isRequired}
      placeholder={placeholder}
      maxLength={200}
      helpText={helpText}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />
  );
}
