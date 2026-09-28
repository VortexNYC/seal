import { Input } from "@cloudflare/kumo";
import { useState } from "react";

interface CellsFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  /** Number of character cells; default 6 */
  cellCount?: number;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/** Segmented character cells (DocuSeal cells) — e.g. ID / account digits. */
export function CellsFieldInput({
  label,
  value = "",
  isRequired,
  cellCount = 6,
  helpText,
  onChange,
  onValidationChange,
}: CellsFieldInputProps) {
  const [local, setLocal] = useState(value.slice(0, cellCount));

  const validate = (val: string): { isValid: boolean; error?: string } => {
    if (isRequired && val.length < cellCount) {
      return {
        isValid: false,
        error: `Enter all ${cellCount} characters`,
      };
    }
    return { isValid: true };
  };

  const handleChange = (raw: string) => {
    const next = raw.replaceAll(/\s/g, "").slice(0, cellCount);
    setLocal(next);
    onChange(next);
    const result = validate(next);
    onValidationChange(result.isValid, result.error);
  };

  return (
    <div className="space-y-2">
      <Input
        label={
          <>
            {label}
            {isRequired && <span className="text-kumo-danger ml-1">*</span>}
          </>
        }
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={"•".repeat(cellCount)}
        maxLength={cellCount}
        autoComplete="off"
        spellCheck={false}
        className="font-mono tracking-[0.35em]"
      />
      {helpText ? (
        <p className="text-muted-foreground text-xs">{helpText}</p>
      ) : null}
    </div>
  );
}
