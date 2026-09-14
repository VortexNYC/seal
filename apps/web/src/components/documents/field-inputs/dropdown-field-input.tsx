import { Select } from "@cloudflare/kumo/components/select";
import { useState } from "react";

interface DropdownFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  options: string[];
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function DropdownFieldInput({
  label,
  value,
  isRequired,
  options,
  helpText,
  onChange,
  onValidationChange,
}: DropdownFieldInputProps) {
  const [selectedValue, setSelectedValue] = useState(value);
  const [error, setError] = useState<string | undefined>();

  const validateValue = (
    val?: string
  ): { isValid: boolean; error?: string } => {
    if (isRequired && !val) {
      return { isValid: false, error: "This field is required" };
    }

    return { isValid: true };
  };

  const handleChange = (val: string | null) => {
    const normalized = val ?? "";
    setSelectedValue(normalized);
    onChange(normalized);

    const validation = validateValue(normalized);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <Select
      label={
        <>
          {label}
          {isRequired && <span className="text-kumo-danger ml-1">*</span>}
        </>
      }
      value={selectedValue}
      onValueChange={handleChange}
      placeholder="Select an option..."
      items={options.map((option) => ({ value: option, label: option }))}
      error={error}
      description={helpText && !error ? helpText : undefined}
    />
  );
}
