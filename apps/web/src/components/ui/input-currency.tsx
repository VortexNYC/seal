import { Input } from "@cloudflare/kumo/components/input";
import {
  InputNumberFormat,
  type InputNumberFormatProps,
  unformat,
} from "@react-input/number-format";
import * as React from "react";

import { fromMajorUnits } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Parse a formatted currency string to major units (dollars).
 * Uses en-US locale for USD formatting via the input unformatter.
 */
export function parseCurrency(value: string): number {
  return Number(unformat(value, "en-US"));
}

/**
 * Parse a formatted currency string to integer minor units (cents).
 */
export function parseCurrencyToMinorUnits(
  value: string,
  currency: "USD" | "EUR" | "GBP" | "BRL" = "USD"
): number {
  const major = parseCurrency(value);
  if (!Number.isFinite(major)) {
    return 0;
  }
  return fromMajorUnits(major, currency, "half-up").amount;
}

type InputCurrencyProps = Omit<
  InputNumberFormatProps,
  "locales" | "format" | "currency" | "size"
> & {
  currency?: "USD" | "EUR" | "GBP" | "BRL";
};

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ size: _size, ...props }, ref) => <Input ref={ref} {...props} />);

CurrencyInput.displayName = "CurrencyInput";

/**
 * Currency input with automatic formatting.
 * Displays formatted currency while typing; convert to minor units via
 * `parseCurrencyToMinorUnits`.
 *
 * @example
 * ```tsx
 * const [amount, setAmount] = useState("");
 *
 * <InputCurrency
 *   value={amount}
 *   onChange={(e) => setAmount(e.target.value)}
 * />
 *
 * const amountInCents = parseCurrencyToMinorUnits(amount);
 * ```
 */
export function InputCurrency({
  className,
  currency = "USD",
  ...props
}: InputCurrencyProps) {
  const locales = currency === "BRL" ? "pt-BR" : "en-US";

  return (
    <InputNumberFormat
      component={CurrencyInput}
      locales={locales}
      format="currency"
      currency={currency}
      maximumFractionDigits={2}
      minimumFractionDigits={2}
      className={cn("select-text", className)}
      inputMode="decimal"
      {...props}
    />
  );
}

InputCurrency.displayName = "InputCurrency";
