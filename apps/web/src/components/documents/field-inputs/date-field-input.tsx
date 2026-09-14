import { Button } from "@cloudflare/kumo/components/button";
import { DatePicker } from "@cloudflare/kumo/components/date-picker";
import { Label } from "@cloudflare/kumo/components/label";
import { Popover } from "@cloudflare/kumo/components/popover";
import { CalendarBlank } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface DateFieldInputProps {
  label: string;
  value?: string; // ISO date string
  isRequired: boolean;
  helpText?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function DateFieldInput({
  label,
  value,
  isRequired,
  helpText,
  onChange,
  onValidationChange,
}: DateFieldInputProps) {
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [error, setError] = useState<string | undefined>();

  const validateValue = (val?: Date): { isValid: boolean; error?: string } => {
    if (isRequired && !val) {
      return { isValid: false, error: "This field is required" };
    }

    return { isValid: true };
  };

  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    const isoString = selectedDate ? selectedDate.toISOString() : "";
    onChange(isoString);

    const validation = validateValue(selectedDate);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {isRequired && <span className="text-kumo-danger ml-1">*</span>}
      </Label>
      <Popover>
        <Popover.Trigger
          render={
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-kumo-secondary",
                error && "border-kumo-danger"
              )}
            >
              <CalendarBlank className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          }
        />
        <Popover.Content className="w-auto p-0" align="start">
          <DatePicker
            mode="single"
            selected={date}
            onChange={handleDateChange}
          />
        </Popover.Content>
      </Popover>
      {helpText && !error && (
        <p className="text-kumo-secondary text-xs">{helpText}</p>
      )}
      {error && <p className="text-kumo-danger text-xs">{error}</p>}
    </div>
  );
}
