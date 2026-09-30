import { Input } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { useState } from "react";

interface KbaFieldInputProps {
  label: string;
  value?: string;
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

/**
 * Knowledge-based auth answers (DocuSeal kba).
 * Stores answers as JSON until a real KBA provider is wired.
 */
export function KbaFieldInput({
  label,
  value = "",
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: KbaFieldInputProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(value));

  const submit = () => {
    if (isRequired && !answer.trim()) {
      onValidationChange(false, "Answer is required");
      return;
    }
    const payload = JSON.stringify({
      answeredAt: new Date().toISOString(),
      answer: answer.trim(),
    });
    setSubmitted(true);
    onChange(payload);
    onValidationChange(true);
  };

  return (
    <div className="space-y-3">
      <Label>
        {label}
        {isRequired && <span className="text-kumo-danger ml-1">*</span>}
      </Label>
      <p className="text-muted-foreground text-sm">
        {helpText ?? "Answer the knowledge-based authentication question."}
      </p>
      {submitted ? (
        <p className="text-sm font-medium text-kumo-success">Answers recorded</p>
      ) : (
        <>
          <Input
            label="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
          />
          <Button type="button" onClick={submit}>
            Submit answer
          </Button>
        </>
      )}
    </div>
  );
}
