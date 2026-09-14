import { Input, InputArea } from "@cloudflare/kumo";
import { useState } from "react";

interface TextFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function TextFieldInput({
  label,
  value = "",
  isRequired,
  placeholder,
  maxLength,
  minLength,
  pattern,
  helpText,
  onChange,
  onValidationChange,
}: TextFieldInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | undefined>();

  const validateValue = (val: string): { isValid: boolean; error?: string } => {
    if (isRequired && !val.trim()) {
      return { isValid: false, error: "This field is required" };
    }

    if (minLength && val.length < minLength) {
      return {
        isValid: false,
        error: `Minimum length is ${minLength} characters`,
      };
    }

    if (maxLength && val.length > maxLength) {
      return {
        isValid: false,
        error: `Maximum length is ${maxLength} characters`,
      };
    }

    if (pattern && val) {
      const regex = new RegExp(pattern);
      if (!regex.test(val)) {
        return {
          isValid: false,
          error: "Value does not match required format",
        };
      }
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

  // Determine if we should use textarea based on max length or if it's a long field
  const useTextarea = maxLength ? maxLength > 100 : false;

  const labelNode = (
    <>
      {label}
      {isRequired && <span className="text-kumo-danger ml-1">*</span>}
    </>
  );
  const description =
    helpText && !error
      ? helpText
      : maxLength
        ? `${localValue.length} / ${maxLength}`
        : undefined;

  return useTextarea ? (
    <InputArea
      label={labelNode}
      value={localValue}
      onValueChange={handleChange}
      placeholder={placeholder}
      maxLength={maxLength}
      minRows={4}
      error={error}
      description={description}
    />
  ) : (
    <Input
      label={labelNode}
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      error={error}
      description={description}
    />
  );
}
