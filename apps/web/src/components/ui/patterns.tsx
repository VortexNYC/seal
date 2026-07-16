import { cn } from "@/lib/utils";

interface RailColumnProps {
  className?: string;
  position?: "left" | "right";
}

// vortex-allow-color: Decorative pixel patterns intentionally use alpha black/white masks that are not semantic UI colors.
export function RailColumn({ className, position = "left" }: RailColumnProps) {
  return (
    <>
      <div
        className={cn(
          "border-brand-900/5 hidden w-10 border-x md:block dark:hidden",
          "bg-[size:10px_10px] bg-fixed",
          position === "left" ? "col-start-1" : "col-start-3",
          "row-span-full row-start-1",
          className,
        )}
        style={{
          backgroundImage:
            "repeating-linear-gradient(315deg, rgb(0 0 0 / 0.03) 0px, rgb(0 0 0 / 0.03) 1px, transparent 0px, transparent 50%)",
        }}
      />
      <div
        className={cn(
          // vortex-allow-color: decorative pattern hairline; alpha-white reads as neutral over the pattern in both themes
          "hidden w-10 border-x border-white/5 dark:md:block",
          "bg-[size:10px_10px] bg-fixed",
          position === "left" ? "col-start-1" : "col-start-3",
          "row-span-full row-start-1",
          className,
        )}
        style={{
          backgroundImage:
            "repeating-linear-gradient(315deg, rgb(255 255 255 / 0.05) 0px, rgb(255 255 255 / 0.05) 1px, transparent 0px, transparent 50%)",
        }}
      />
    </>
  );
}

interface GridLayoutProps {
  children: React.ReactNode;
  className?: string;
  showRails?: boolean;
}

export function GridLayout({ children, className, showRails = true }: GridLayoutProps) {
  return (
    <div
      className={cn(
        "grid min-h-dvh",
        showRails ? "grid-cols-1 md:grid-cols-[40px_1fr_40px]" : "grid-cols-1",
        className,
      )}
    >
      {showRails && <RailColumn position="left" />}
      <div className={cn(showRails && "col-start-2")}>{children}</div>
      {showRails && <RailColumn position="right" />}
    </div>
  );
}

interface DotPatternProps {
  className?: string;
}

export function DotPattern({ className }: DotPatternProps) {
  return (
    <>
      <div
        className={cn("pointer-events-none dark:hidden", "bg-[size:16px_16px]", className)}
        style={{
          backgroundImage: "radial-gradient(circle, rgb(0 0 0 / 0.35) 1px, transparent 1px)",
        }}
      />
      <div
        className={cn("pointer-events-none hidden dark:block", "bg-[size:16px_16px]", className)}
        style={{
          backgroundImage: "radial-gradient(circle, rgb(255 255 255 / 0.15) 1px, transparent 1px)",
        }}
      />
    </>
  );
}

interface CardWithDotsProps {
  children: React.ReactNode;
  className?: string;
}

export function CardWithDots({ children, className }: CardWithDotsProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        // vortex-allow-color: pattern swatch chip is physically white by design
        "bg-brand-950/[2.5%] dark:bg-white/[2.5%]",
        // vortex-allow-color: decorative pattern hairline; alpha-white reads as neutral over the pattern in both themes
        "ring-brand-950/5 ring-1 ring-inset dark:ring-white/5",
        className,
      )}
    >
      <DotPattern />
      {children}
    </div>
  );
}
