import { cn } from "@/lib/utils";

import { SealLogo } from "@/components/seal-logo";

interface SealLogoBadgeFixedProps {
  className?: string;
  /** The total size of the badge in pixels */
  size?: number;
  /** Whether to show the serif wordmark beside the mark */
  withText?: boolean;
}

/**
 * Seal mark badge for chrome (sidebar). Quill + optional Hedvig serif wordmark.
 */
export function SealLogoBadgeFixed({
  className,
  size = 80,
  withText = false,
}: SealLogoBadgeFixedProps): JSX.Element {
  const paddingRatio = withText ? 0.1 : 0.18;
  const borderRadiusRatio = 0.2;
  const padding = size * paddingRatio;
  const borderRadius = size * borderRadiusRatio;
  const markSize = size - padding * 2;

  return (
    <div
      className={cn(
        "from-background to-muted dark:from-background dark:to-muted inline-flex items-center gap-2 bg-linear-to-br",
        "shadow-brand-700/10 border-brand-700/5 border shadow-xl",
        "hover:shadow-brand-700/15 transition-shadow duration-300 hover:shadow-2xl",
        className
      )}
      style={{
        width: withText ? "auto" : size,
        height: size,
        padding,
        borderRadius,
        minWidth: withText ? size * 1.6 : size,
      }}
    >
      <SealLogo size={markSize} variant="color" />
      {withText ? (
        <span
          className="text-foreground font-serif tracking-tight"
          style={{ fontSize: markSize * 0.55, lineHeight: 1 }}
        >
          Seal
        </span>
      ) : null}
    </div>
  );
}
