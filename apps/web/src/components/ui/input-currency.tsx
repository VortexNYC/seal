import {
  InputNumberFormat,
  type InputNumberFormatProps,
  unformat,
} from "@react-input/number-format";

import { cn } from "@/lib/utils";

import { Input } from "./input";

/**
 * Parse a formatted currency string to a number.
 * Uses en-US locale for USD formatting.
 */
export function parseCurrency(value: string): number {
  return Number(unformat(value, "en-US"));
}

type InputCurrencyProps = Omit<InputNumberFormatProps, "locales" | "format" | "currency"> & {
  currency?: "USD" | "EUR" | "GBP" | "BRL";
};

/**
 * Currency input with automatic formatting.
 * Displays formatted currency while typing and provides
 * the numeric value via parseCurrency helper.
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
 * // Get numeric value:
 * const amountInCents = Math.round(parseCurrency(amount) * 100);
 * ```
 */
export function InputCurrency({
  className,
  currency = "USD",
  ...props
}: InputCurrencyProps & { ref?: React.RefObject<HTMLInputElement> }) {
  const locales = currency === "BRL" ? "pt-BR" : "en-US";

  return (
    <InputNumberFormat
      component={Input}
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
