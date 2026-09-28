import { DateFieldInput } from "./date-field-input";

interface DateSignedFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/**
 * Date signed — defaults to today (DocuSeal datenow).
 * Signer may still adjust if the sender did not lock the value.
 */
export function DateSignedFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: DateSignedFieldInputProps) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <DateFieldInput
      label={label}
      value={value || today}
      isRequired={isRequired}
      helpText={helpText ?? "Defaults to today’s date"}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />
  );
}
