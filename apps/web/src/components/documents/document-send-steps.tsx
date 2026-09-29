/**
 * Draft send path — three steps, one current. Click jumps to the right section.
 */

import { MOTION_PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ReactElement } from "react";

export type SendStepId = 1 | 2 | 3;

interface DocumentSendStepsProps {
  current: SendStepId;
  onSelect: (step: SendStepId) => void;
}

const STEPS: ReadonlyArray<{ id: SendStepId; label: string }> = [
  { id: 1, label: "People" },
  { id: 2, label: "Fields" },
  { id: 3, label: "Send" },
];

export function DocumentSendSteps({
  current,
  onSelect,
}: DocumentSendStepsProps): ReactElement {
  return (
    <nav
      aria-label="Send document steps"
      data-testid="document-send-steps"
      className="border-border bg-muted/40 flex items-stretch gap-1 rounded-xl border p-1"
    >
      {STEPS.map((step, index) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={cn(
              MOTION_PRESS,
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              active && "bg-background text-foreground shadow-sm",
              done && !active && "text-foreground/80",
              !done && !active && "text-muted-foreground hover:text-foreground"
            )}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[0.65rem] font-semibold tabular-nums",
                active && "bg-primary text-primary-foreground",
                done && !active && "bg-success/20 text-success",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? "✓" : step.id}
            </span>
            <span className="truncate">{step.label}</span>
            {index < STEPS.length - 1 ? (
              <span className="text-muted-foreground/50 sr-only">then</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function resolveSendStep(input: {
  recipientCount: number;
  fieldCount: number;
  canSend: boolean;
}): SendStepId {
  if (input.recipientCount === 0) return 1;
  if (input.fieldCount === 0 || !input.canSend) return 2;
  return 3;
}
