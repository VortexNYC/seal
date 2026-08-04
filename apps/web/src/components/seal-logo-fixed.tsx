import { cn } from "@/lib/utils";

interface SealLogoBadgeFixedProps {
  className?: string;
  /** The total size of the badge in pixels */
  size?: number;
  /** Whether to show the text logo or just the icon */
  withText?: boolean;
}

/**
 * A proportionally scaling Seal logo badge.
 * All internal elements (padding, border-radius, logo) scale based on the `size` prop.
 */
export function SealLogoBadgeFixed({
  className,
  size = 80,
  withText = false,
}: SealLogoBadgeFixedProps) {
  // Proportions
  const paddingRatio = withText ? 0.08 : 0.15;
  const borderRadiusRatio = 0.2;

  const padding = size * paddingRatio;
  const borderRadius = size * borderRadiusRatio;

  return (
    <div
      className={cn(
        "from-background to-muted dark:from-background dark:to-muted inline-flex items-center justify-center bg-linear-to-br",
        "shadow-brand-700/10 border-brand-700/5 border shadow-xl",
        "hover:shadow-brand-700/15 transition-shadow duration-300 hover:shadow-2xl",
        className
      )}
      style={{
        width: withText ? "auto" : size,
        height: size,
        padding: padding,
        borderRadius: borderRadius,
        minWidth: withText ? size * 2 : size,
      }}
    >
      {withText ? (
        <>
          <img
            src="/logo/seal-logo-color-no-background.svg"
            alt="Seal Logo"
            className="h-full w-auto object-contain dark:hidden"
          />
          <img
            src="/logo/seal-logo-white-no-background.svg"
            alt="Seal Logo"
            className="hidden h-full w-auto object-contain dark:block"
          />
        </>
      ) : (
        <>
          <img
            src="/logo/seal-icon-color-no-background.svg"
            alt="Seal Icon"
            className="h-full w-full object-contain dark:hidden"
          />
          <img
            src="/logo/seal-icon-white-no-background.svg"
            alt="Seal Icon"
            className="hidden h-full w-full object-contain dark:block"
          />
        </>
      )}
    </div>
  );
}
