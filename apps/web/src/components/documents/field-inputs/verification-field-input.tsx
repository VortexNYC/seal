import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { useState } from "react";

interface VerificationFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/**
 * ID verification placeholder (DocuSeal verification).
 * Records a local completion token until a provider is wired.
 */
export function VerificationFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: VerificationFieldInputProps) {
  const [done, setDone] = useState(Boolean(value));

  const complete = () => {
    const token = `verified:${new Date().toISOString()}`;
    setDone(true);
    onChange(token);
    onValidationChange(true);
  };

  return (
    <div className="space-y-3">
      <Label>
        {label}
        {isRequired && <span className="text-kumo-danger ml-1">*</span>}
      </Label>
      <Text as="p" variant="secondary" size="sm">{helpText ??
          "Complete identity verification to continue. Provider wiring lands with CompAI / SEA auth."}</Text>
      {done ? (
        <Text as="p" variant="success" size="sm">Verification recorded</Text>
      ) : (
        <Button type="button" onClick={complete}>
          Start verification
        </Button>
      )}
    </div>
  );
}
