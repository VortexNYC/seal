function ipv4ToInt(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = (result * 256 + octet) >>> 0;
  }
  return result >>> 0;
}

function matchesRange(ip: string, range: string): boolean {
  if (!range.includes("/")) return ip === range;
  const [base, bitsRaw] = range.split("/");
  if (base === undefined || bitsRaw === undefined || bitsRaw.length === 0) {
    return false;
  }
  const bits = Number(bitsRaw);
  const ipNum = ipv4ToInt(ip);
  const baseNum = ipv4ToInt(base);
  if (
    ipNum === null ||
    baseNum === null ||
    !Number.isInteger(bits) ||
    bits < 0 ||
    bits > 32
  ) {
    return false;
  }
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/** Empty ranges allow every address. A set range allows only a match. */
export function ipMatchesAllowlist(
  ip: string | null,
  ranges: readonly string[]
): boolean {
  if (ranges.length === 0) return true;
  if (ip === null || ip.length === 0) return false;
  return ranges.some((range) => matchesRange(ip, range));
}

export function requestClientIp(headers: {
  get(name: string): string | null | undefined;
}): string | null {
  const direct = headers.get("cf-connecting-ip")?.trim();
  if (direct) return direct;
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}
