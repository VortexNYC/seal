import { Radio } from "@cloudflare/kumo/components/radio";
import { useState } from "react";

interface RadioFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  options: string[];
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function RadioFieldInput({
  label,
  value,
  isRequired,
  options,
  helpText,
  onChange,
  onValidationChange,
}: RadioFieldInputProps) {
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

  const handleChange = (val: string) => {
    setSelectedValue(val);
    onChange(val);

    const validation = validateValue(val);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <Radio.Group
      value={selectedValue}
      onValueChange={handleChange}
      description={helpText && !error ? helpText : undefined}
      error={error}
    >
      <Radio.Legend>
        {label}
        {isRequired && <span className="text-kumo-danger ml-1">*</span>}
      </Radio.Legend>
      {options.map((option) => (
        <Radio.Item key={option} label={option} value={option} />
      ))}
    </Radio.Group>
  );
}
