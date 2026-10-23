import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { DatePicker } from "@cloudflare/kumo/components/date-picker";
import { Label } from "@cloudflare/kumo/components/label";
import { Popover } from "@cloudflare/kumo/components/popover";
import { CalendarBlank } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState } from "react";

import { calendarDate, parseCalendarDate } from "@/lib/field-date";
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
    value ? parseCalendarDate(value) : undefined
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
    onChange(selectedDate ? calendarDate(selectedDate) : "");

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
                "w-full justify-start text-left",
                !date && "text-kumo-secondary",
                error && "border-kumo-danger"
              )}
             icon={CalendarBlank}>
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
        <Text as="p" variant="secondary" size="xs">{helpText}</Text>
      )}
      {error && <Text as="p" variant="error" size="xs">{error}</Text>}
    </div>
  );
}
