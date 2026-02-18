import { useCallback, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CheckboxFieldInputProps {
  label: string;
  value?: string; // "true"/"false" for single, JSON array for multi
  isRequired: boolean;
  helpText?: string;
  options?: string[];
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function CheckboxFieldInput({
  label,
  value,
  isRequired,
  helpText,
  options = [],
  onChange,
  onValidationChange,
}: CheckboxFieldInputProps) {
  // Multi-option mode when options are provided
  const isMultiOption = options.length > 0;

  // Single checkbox state
  const [checked, setChecked] = useState(value === "true");

  // Multi-option state: parse JSON array or empty
  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
    if (!isMultiOption) return [];
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const validateSingle = useCallback(
    (val: boolean): { isValid: boolean; error?: string } => {
      if (isRequired && !val) {
        return { isValid: false, error: "This field must be checked" };
      }
      return { isValid: true };
    },
    [isRequired],
  );

  const validateMulti = useCallback(
    (selected: string[]): { isValid: boolean; error?: string } => {
      if (isRequired && selected.length === 0) {
        return { isValid: false, error: "At least one option must be selected" };
      }
      return { isValid: true };
    },
    [isRequired],
  );

  const handleSingleChange = (newChecked: boolean) => {
    setChecked(newChecked);
    onChange(newChecked ? "true" : "false");
    const validation = validateSingle(newChecked);
    onValidationChange(validation.isValid, validation.error);
  };

  const handleOptionToggle = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    setSelectedOptions(newSelected);
    onChange(JSON.stringify(newSelected));
    const validation = validateMulti(newSelected);
    onValidationChange(validation.isValid, validation.error);
  };

  const [error, setError] = useState<string | undefined>(() => {
    if (isMultiOption) {
      const v = validateMulti(selectedOptions);
      return v.error;
    }
    const v = validateSingle(checked);
    return v.error;
  });

  // Wrap handlers to also set error state
  const handleSingleChangeWithError = (newChecked: boolean) => {
    setChecked(newChecked);
    onChange(newChecked ? "true" : "false");
    const validation = validateSingle(newChecked);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  const handleOptionToggleWithError = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    setSelectedOptions(newSelected);
    onChange(JSON.stringify(newSelected));
    const validation = validateMulti(newSelected);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  if (isMultiOption) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {label}
          {isRequired && <span className="text-destructive ml-1">*</span>}
        </p>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`checkbox-option-${index}`}
                checked={selectedOptions.includes(option)}
                onCheckedChange={() => handleOptionToggleWithError(option)}
                className={error ? "border-destructive" : ""}
              />
              <Label
                htmlFor={`checkbox-option-${index}`}
                className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
        {helpText && !error && <p className="text-muted-foreground text-xs">{helpText}</p>}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="checkbox-field"
          checked={checked}
          onCheckedChange={handleSingleChangeWithError}
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
