export function parseMoneyToCents(input: string): number {
  let raw = input;

  const isNegative = raw.startsWith("-");
  if (isNegative) {
    raw = raw.slice(1);
  }

  raw = raw.replace("$", "").replace(/,/g, "");

  const dotIdx = raw.indexOf(".");
  let dollars: number;
  let cents: number;

  if (dotIdx === -1) {
    dollars = parseInt(raw, 10);
    cents = 0;
  } else {
    dollars = parseInt(raw.slice(0, dotIdx), 10);
    const centsStr = raw.slice(dotIdx + 1);
    if (centsStr.length === 1) {
      cents = parseInt(centsStr, 10) * 10;
    } else if (centsStr.length === 2) {
      cents = parseInt(centsStr, 10);
    } else {
      cents = parseInt(centsStr.slice(0, 2), 10);
    }
  }

  const totalCents = dollars * 100 + cents;
  return isNegative ? -totalCents : totalCents;
}
