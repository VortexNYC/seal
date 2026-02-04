import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CheckboxFieldInputProps {
  label: string;
  value?: string; // "true" or "false"
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function CheckboxFieldInput({
  label,
  value,
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: CheckboxFieldInputProps) {
  const [checked, setChecked] = useState(value === "true");
  const [error, setError] = useState<string | undefined>();

  const validateValue = (val: boolean): { isValid: boolean; error?: string } => {
    if (isRequired && !val) {
      return { isValid: false, error: "This field must be checked" };
    }

    return { isValid: true };
  };

  const handleChange = (newChecked: boolean) => {
    setChecked(newChecked);
    onChange(newChecked ? "true" : "false");

    const validation = validateValue(newChecked);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="checkbox-field"
          checked={checked}
          onCheckedChange={handleChange}
          className={error ? "border-destructive" : ""}
        />
        <Label
          htmlFor="checkbox-field"
          className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {helpText && !error && <p className="text-muted-foreground ml-6 text-xs">{helpText}</p>}
      {error && <p className="text-destructive ml-6 text-xs">{error}</p>}
    </div>
  );
}
