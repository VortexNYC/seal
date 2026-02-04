import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="space-y-2">
      <Label htmlFor="dropdown-field">
        {label}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger id="dropdown-field" className={error ? "border-destructive" : ""}>
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpText && !error && <p className="text-muted-foreground text-xs">{helpText}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
