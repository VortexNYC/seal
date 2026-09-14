import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { useCallback, useState } from "react";

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
    [isRequired]
  );

  const validateMulti = useCallback(
    (selected: string[]): { isValid: boolean; error?: string } => {
      if (isRequired && selected.length === 0) {
        return {
          isValid: false,
          error: "At least one option must be selected",
        };
      }
      return { isValid: true };
    },
    [isRequired]
  );

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

  const handleOptionChange = (option: string, newChecked: boolean) => {
    const newSelected = newChecked
      ? [...selectedOptions, option]
      : selectedOptions.filter((o) => o !== option);
    setSelectedOptions(newSelected);
    onChange(JSON.stringify(newSelected));
    const validation = validateMulti(newSelected);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  const requiredMarker = isRequired ? (
    <span className="text-kumo-danger ml-1">*</span>
  ) : null;

  if (isMultiOption) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {label}
          {requiredMarker}
        </p>
        <div className="space-y-2">
          {options.map((option) => (
            <Checkbox
              key={option}
              label={option}
              checked={selectedOptions.includes(option)}
              onCheckedChange={(newChecked) =>
                handleOptionChange(option, newChecked as boolean)
              }
            />
          ))}
        </div>
        {helpText && !error && (
          <p className="text-kumo-secondary text-xs">{helpText}</p>
        )}
        {error && <p className="text-kumo-danger text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Checkbox
        label={
          <>
            {label}
            {requiredMarker}
          </>
        }
        checked={checked}
        onCheckedChange={handleSingleChangeWithError}
      />
      {helpText && !error && (
        <p className="text-kumo-secondary ml-6 text-xs">{helpText}</p>
      )}
      {error && <p className="text-kumo-danger ml-6 text-xs">{error}</p>}
    </div>
  );
}
