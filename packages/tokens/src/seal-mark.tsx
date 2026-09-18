import type { CSSProperties } from "react";

export interface SealMarkProps {
  /** Rendered size (width & height). Defaults to `1em` so it scales with text. */
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Accessible label. Omit (default) to mark the mark decorative. */
  title?: string;
}

/**
 * The Seal quill — blade, spine, two barbs. Single-color via `currentColor`:
 * set `color` (or a text color utility) on this element or an ancestor to
 * recolor it. Kept in sync with `MARK_SVG` in `./seal-mark` (the string form,
 * for non-React consumers) and `mark.svg`.
 */
export function SealMark({
  size = "1em",
  className,
  style,
  title,
}: SealMarkProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M50 154 C58 108 88 62 152 40 C146 90 116 136 62 146 Z"
        strokeWidth={9}
      />
      <path d="M42 166 C84 124 120 78 152 40" strokeWidth={6} />
      <path d="M74 130 C84 127 92 122 98 114" strokeWidth={5} />
      <path d="M104 92 C114 89 122 84 128 76" strokeWidth={5} />
    </svg>
  );
}
