/**
 * Empty State Component
 *
 * SEA-140: Reusable empty state component with helpful CTAs
 *
 * Displays a visually appealing empty state with icon, title, description,
 * and optional action buttons.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "outline";
}

interface EmptyStateProps {
  /** Icon to display */
  icon: React.ComponentType<{ className?: string }>;
  /** Main title text */
  title: string;
  /** Description text explaining the empty state */
  description: string;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Optional secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Whether to wrap in a Card component (default: true) */
  withCard?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  withCard = true,
  className,
}: EmptyStateProps) {
  const content = (
    <div
      className={cn(
        "flex w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* vortex-allow-color: subtle hairline over dark illustration; alpha-white reads as neutral in both themes */}
      <div className="border-border/60 bg-kumo-elevated/80 relative mx-auto mb-4 flex size-14 items-center justify-center rounded-full border shadow-sm ring-1 ring-white/10 dark:ring-white/5">
        <Icon className="text-kumo-secondary h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-kumo-secondary mt-2 max-w-md px-2 text-sm leading-relaxed">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant ?? "primary"}
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant ?? "outline"}
            >
              {secondaryAction.icon && (
                <secondaryAction.icon className="mr-2 h-4 w-4" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (withCard) {
    return (
      <LayerCard className="rounded-2xl border-dashed">
        <LayerCard.Primary className="p-0">{content}</LayerCard.Primary>
      </LayerCard>
    );
  }

  return content;
}
