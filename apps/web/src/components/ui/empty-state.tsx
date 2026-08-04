/**
 * Empty State Component
 *
 * SEA-140: Reusable empty state component with helpful CTAs
 *
 * Displays a visually appealing empty state with icon, title, description,
 * and optional action buttons.
 */

import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button, type buttonVariants } from "./button";
import { Card, CardContent } from "./card";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: ButtonVariant;
}

interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
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
      <div className="border-border/60 bg-muted/80 relative mx-auto mb-4 flex size-14 items-center justify-center rounded-full border shadow-sm ring-1 ring-white/10 dark:ring-white/5">
        <Icon className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-md px-2 text-sm leading-relaxed">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant ?? "default"}
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
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-0">{content}</CardContent>
      </Card>
    );
  }

  return content;
}
