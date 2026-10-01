/**
 * Circular progress ring showing document signing progress.
 */

import { cn } from "@/lib/utils";

interface ProgressData {
  percentComplete: number;
  byStatus: {
    signed: number;
    pending: number;
    viewed: number;
    declined: number;
  };
}

interface DocumentProgressRingProps {
  progress: ProgressData;
}

export function DocumentProgressRing({ progress }: DocumentProgressRingProps) {
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressOffset =
    ringCircumference - (progress.percentComplete / 100) * ringCircumference;

  return (
    <div className="border-border bg-card animate-fade-in-up flex flex-col items-center gap-4 rounded-2xl border p-6 shadow-sm sm:rounded-xl sm:p-4">
      {/* Progress Ring */}
      <div className="relative h-30 w-30 sm:h-22.5 sm:w-22.5">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          aria-hidden="true"
          className="-rotate-90 sm:h-22.5 sm:w-22.5"
        >
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={ringRadius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={ringRadius}
            fill="none"
            stroke="var(--success)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={progressOffset}
            className="transition-dash duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-foreground text-display font-serif leading-none font-semibold sm:text-xl">
            {progress.percentComplete}%
          </span>
          <span className="text-muted-foreground text-2xs mt-0.5 font-sans">
            Complete
          </span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid w-full grid-cols-2 gap-3 sm:gap-2">
        <StatusBox
          value={progress.byStatus.signed}
          label="Signed"
          colorClass="text-success"
        />
        <StatusBox
          value={progress.byStatus.pending}
          label="Pending"
          colorClass="text-warning"
        />
        <StatusBox
          value={progress.byStatus.viewed}
          label="Viewed"
          colorClass="text-foreground"
        />
        {progress.byStatus.declined > 0 && (
          <StatusBox
            value={progress.byStatus.declined}
            label="Declined"
            colorClass="text-destructive"
          />
        )}
      </div>
    </div>
  );
}

interface StatusBoxProps {
  value: number;
  label: string;
  colorClass: string;
}

function StatusBox({ value, label, colorClass }: StatusBoxProps) {
  return (
    <div className="bg-muted rounded-card px-2 py-3 text-center sm:px-1.5 sm:py-2.5">
      <div
        className={cn(
          "font-sans text-xl font-semibold sm:text-base",
          colorClass
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground text-2xs mt-0.5 font-sans">
        {label}
      </div>
    </div>
  );
}
