import { cn } from "@/lib/utils";

interface SealLogoProps {
  className?: string;
  size?: number;
  /** Foreground on light (`color`/`black`) or dark (`white`) surfaces */
  variant?: "color" | "white" | "black";
  /** Soft taupe plate behind the mark */
  withBackground?: boolean;
}

/**
 * Seal quill mark — single-color via currentColor.
 * Matches `packages/tokens` SealMark (blade, spine, two barbs).
 */
export function SealLogo({
  className,
  size = 32,
  variant = "color",
  withBackground = false,
}: SealLogoProps): JSX.Element {
  const colorClass =
    variant === "white"
      ? "text-white"
      : "text-foreground";

  const mark = (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(colorClass, !withBackground && className)}
      role="img"
      aria-label="Seal"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Seal</title>
      <path
        d="M50 154 C58 108 88 62 152 40 C146 90 116 136 62 146 Z"
        strokeWidth={9}
      />
      <path d="M42 166 C84 124 120 78 152 40" strokeWidth={6} />
      <path d="M74 130 C84 127 92 122 98 114" strokeWidth={5} />
      <path d="M104 92 C114 89 122 84 128 76" strokeWidth={5} />
    </svg>
  );

  if (!withBackground) {
    return mark;
  }

  return (
    <span
      className={cn(
        "bg-muted inline-flex items-center justify-center rounded-lg",
        className
      )}
      style={{ width: size * 1.35, height: size * 1.35 }}
    >
      {mark}
    </span>
  );
}
