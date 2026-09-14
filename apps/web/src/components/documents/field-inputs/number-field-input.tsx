import { Input } from "@cloudflare/kumo/components/input";
import { useState } from "react";

interface NumberFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function NumberFieldInput({
  label,
  value = "",
  isRequired,
  placeholder,
  min,
  max,
  helpText,
  onChange,
  onValidationChange,
}: NumberFieldInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | undefined>();

  const validateValue = (val: string): { isValid: boolean; error?: string } => {
    if (isRequired && !val.trim()) {
      return { isValid: false, error: "This field is required" };
    }

    if (val.trim() === "") {
      return { isValid: true };
    }

    const num = Number(val);
    if (Number.isNaN(num)) {
      return { isValid: false, error: "Please enter a valid number" };
    }

    if (min !== undefined && num < min) {
      return { isValid: false, error: `Minimum value is ${min}` };
    }

    if (max !== undefined && num > max) {
      return { isValid: false, error: `Maximum value is ${max}` };
    }

    return { isValid: true };
  };

  const handleChange = (val: string) => {
    setLocalValue(val);
    onChange(val);

    const validation = validateValue(val);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step="any"
      error={error}
      description={helpText && !error ? helpText : undefined}
      label={
        <>
          {label}
          {isRequired && <span className="text-kumo-danger ml-1">*</span>}
        </>
      }
    />
  );
}
