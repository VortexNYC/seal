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
  const progressOffset = ringCircumference - (progress.percentComplete / 100) * ringCircumference;

  return (
    <div className="flex animate-[fadeInUp_0.3s_ease-out_forwards] flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:rounded-xl sm:p-4">
      {/* Progress Ring */}
      <div className="relative h-[120px] w-[120px] sm:h-[90px] sm:w-[90px]">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          aria-hidden="true"
          className="-rotate-90 sm:h-[90px] sm:w-[90px]"
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
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[1.75rem] leading-none font-semibold text-foreground sm:text-xl">
            {progress.percentComplete}%
          </span>
          <span className="text-muted-foreground mt-0.5 font-sans text-[0.6875rem]">Complete</span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid w-full grid-cols-2 gap-3 sm:gap-2">
        <StatusBox value={progress.byStatus.signed} label="Signed" colorClass="text-success" />
        <StatusBox value={progress.byStatus.pending} label="Pending" colorClass="text-warning" />
        <StatusBox value={progress.byStatus.viewed} label="Viewed" colorClass="text-foreground" />
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
    <div className="rounded-[10px] bg-muted px-2 py-3 text-center sm:px-1.5 sm:py-2.5">
      <div className={cn("font-sans text-xl font-semibold sm:text-base", colorClass)}>{value}</div>
      <div className="text-muted-foreground mt-0.5 font-sans text-[0.6875rem]">{label}</div>
    </div>
  );
}
