export type Money = {
  amount: number;
  currency: string;
};

export type RoundingMode =
  | "half-even"
  | "half-up"
  | "half-down"
  | "up"
  | "down";

export class MoneyCurrencyMismatchError extends Error {
  constructor(
    readonly a: string,
    readonly b: string
  ) {
    super(`Money currency mismatch: ${a} vs ${b}`);
    this.name = "MoneyCurrencyMismatchError";
  }
}

export function currencyExponent(currency: string, locale?: string): number {
  try {
    const opts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).resolvedOptions();
    return opts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function roundMinorUnits(
  value: number,
  mode: RoundingMode = "half-even"
): number {
  if (Number.isInteger(value)) return value;
  const floor = Math.floor(value);
  const frac = value - floor;
  switch (mode) {
    case "down":
      return floor;
    case "up":
      return Math.ceil(value);
    case "half-up":
      return frac >= 0.5 ? floor + 1 : floor;
    case "half-down":
      return frac > 0.5 ? floor + 1 : floor;
    case "half-even": {
      if (frac < 0.5) return floor;
      if (frac > 0.5) return floor + 1;
      return floor % 2 === 0 ? floor : floor + 1;
    }
    default:
      throw new TypeError("Unsupported money rounding mode");
  }
}

export function money(amount: number, currency: string): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(
      `money() amount must be integer minor units, got ${amount}`
    );
  }
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyCurrencyMismatchError(a.currency, b.currency);
  }
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function multiplyMoney(
  m: Money,
  factor: number,
  mode: RoundingMode = "half-even"
): Money {
  return {
    amount: roundMinorUnits(m.amount * factor, mode),
    currency: m.currency,
  };
}

export function applyRate(
  m: Money,
  rate: number,
  mode: RoundingMode = "half-even"
): Money {
  return multiplyMoney(m, rate, mode);
}

export function toMajorNumber(m: Money): number {
  return m.amount / 10 ** currencyExponent(m.currency);
}

function shouldRoundUp(
  roundingDigit: number,
  hasTrailingNonZero: boolean,
  mode: RoundingMode,
  base: number
): boolean {
  if (mode === "down") return false;
  if (mode === "up") return roundingDigit > 0 || hasTrailingNonZero;
  if (mode === "half-down")
    return roundingDigit > 5 || (roundingDigit === 5 && hasTrailingNonZero);
  if (mode === "half-even") {
    if (roundingDigit < 5) return false;
    if (roundingDigit > 5 || hasTrailingNonZero) return true;
    return base % 2 !== 0;
  }
  return roundingDigit >= 5;
}

function parseMajorUnitsToMinor(
  value: string,
  exponent: number,
  mode: RoundingMode
): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  if (trimmed.includes("e") || trimmed.includes("E")) {
    return roundMinorUnits(Number(trimmed) * 10 ** exponent, mode);
  }

  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned =
    trimmed.startsWith("-") || trimmed.startsWith("+")
      ? trimmed.slice(1)
      : trimmed;
  const [wholeRaw = "0", fractionalRaw = ""] = unsigned.split(".");
  const whole = wholeRaw.length === 0 ? "0" : wholeRaw;
  const fractional = fractionalRaw.padEnd(exponent + 1, "0");
  const minorDigits = fractional.slice(0, exponent);
  const roundingDigit = Number(fractional[exponent] ?? "0");
  const hasTrailingNonZero = fractional
    .slice(exponent + 1)
    .split("")
    .some((digit) => digit !== "0");
  const base =
    Number.parseInt(whole, 10) * 10 ** exponent +
    Number.parseInt(minorDigits || "0", 10);

  if (!Number.isFinite(base)) {
    throw new TypeError(`Invalid money amount: ${value}`);
  }

  const increment = shouldRoundUp(roundingDigit, hasTrailingNonZero, mode, base)
    ? 1
    : 0;
  return sign * (base + increment);
}

export function fromMajorUnits(
  amount: number,
  currency = "USD",
  mode: RoundingMode = "half-up"
): Money {
  return money(
    parseMajorUnitsToMinor(String(amount), currencyExponent(currency), mode),
    currency
  );
}

export function formatMoney(
  m: Money,
  options?: { locale?: string; intl?: Intl.NumberFormatOptions }
): string {
  const locale = options?.locale;
  const major = toMajorNumber(m);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    ...options?.intl,
  }).format(major);
}

export function allocate(m: Money, ratios: readonly number[]): Money[] {
  if (ratios.length === 0) {
    throw new TypeError("allocate() requires at least one ratio");
  }
  if (ratios.some((r) => r < 0) || ratios.every((r) => r === 0)) {
    throw new TypeError(
      "allocate() ratios must be non-negative with a positive total"
    );
  }

  const total = ratios.reduce((a, b) => a + b, 0);
  const sign = m.amount < 0 ? -1 : 1;
  const abs = Math.abs(m.amount);

  const floors = ratios.map((r) => Math.floor((abs * r) / total));
  let remainder = abs - floors.reduce((a, b) => a + b, 0);

  const parts = floors.slice();
  for (let i = 0; i < parts.length && remainder > 0; i++) {
    if (ratios[i] === 0) continue;
    parts[i] = (parts[i] ?? 0) + 1;
    remainder--;
  }

  return parts.map((p) => money(sign * p, m.currency));
}
