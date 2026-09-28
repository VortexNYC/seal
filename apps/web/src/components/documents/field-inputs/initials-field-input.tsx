import { TextFieldInput } from "./text-field-input";

interface InitialsFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Short typed initials (Documenso INITIALS / DocuSeal initials). */
export function InitialsFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: InitialsFieldInputProps): React.ReactElement {
  return (
    <TextFieldInput
      label={label}
      value={value}
      isRequired={isRequired}
      placeholder="JD"
      maxLength={8}
      helpText={helpText ?? "Enter your initials"}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />
  );
}
