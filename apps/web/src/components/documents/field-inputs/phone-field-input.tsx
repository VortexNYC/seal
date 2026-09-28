import { TextFieldInput } from "./text-field-input";

interface PhoneFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** E.164-ish phone (DocuSeal phone). */
export function PhoneFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: PhoneFieldInputProps): React.ReactElement {
  return (
    <TextFieldInput
      label={label}
      value={value}
      isRequired={isRequired}
      placeholder="+1 555 0100"
      maxLength={32}
      pattern={String.raw`^\+?[0-9\s\-().]{7,}$`}
      helpText={helpText ?? "Use international format when possible"}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />
  );
}
