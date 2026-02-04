/**
 * Circular progress ring showing document signing progress.
 */

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
    <div className="flex animate-[fadeInUp_0.3s_ease-out_forwards] flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:rounded-xl sm:p-4 dark:border-slate-700 dark:bg-slate-900">
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
            stroke="hsl(220 15% 92%)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={ringRadius}
            fill="none"
            stroke="hsl(145 55% 45%)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={progressOffset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[1.75rem] leading-none font-semibold text-slate-800 sm:text-xl dark:text-slate-200">
            {progress.percentComplete}%
          </span>
          <span className="mt-0.5 font-sans text-[0.6875rem] text-slate-500 dark:text-slate-400">
            Complete
          </span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid w-full grid-cols-2 gap-3 sm:gap-2">
        <StatusBox
          value={progress.byStatus.signed}
          label="Signed"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatusBox
          value={progress.byStatus.pending}
          label="Pending"
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <StatusBox
          value={progress.byStatus.viewed}
          label="Viewed"
          colorClass="text-slate-700 dark:text-slate-300"
        />
        {progress.byStatus.declined > 0 && (
          <StatusBox
            value={progress.byStatus.declined}
            label="Declined"
            colorClass="text-red-500 dark:text-red-400"
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
    <div className="rounded-[10px] bg-slate-50 px-2 py-3 text-center sm:px-1.5 sm:py-2.5 dark:bg-slate-800">
      <div className={`font-sans text-xl font-semibold sm:text-base ${colorClass}`}>{value}</div>
      <div className="mt-0.5 font-sans text-[0.6875rem] text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
