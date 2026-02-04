import { useState } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

  const validateValue = (val?: string): { isValid: boolean; error?: string } => {
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
    <div className="space-y-3">
      <Label>
        {label}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <RadioGroup value={selectedValue} onValueChange={handleChange}>
        {options.map((option) => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`radio-${option}`} />
            <Label htmlFor={`radio-${option}`} className="cursor-pointer font-normal">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {helpText && !error && <p className="text-muted-foreground text-xs">{helpText}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
