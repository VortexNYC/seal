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
	const progressOffset =
		ringCircumference - (progress.percentComplete / 100) * ringCircumference;

	return (
		<div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm sm:p-4 sm:rounded-xl animate-[fadeInUp_0.3s_ease-out_forwards]">
			{/* Progress Ring */}
			<div className="relative w-[120px] h-[120px] sm:w-[90px] sm:h-[90px]">
				<svg
					width="120"
					height="120"
					viewBox="0 0 120 120"
					aria-hidden="true"
					className="-rotate-90 sm:w-[90px] sm:h-[90px]"
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
					<span className="font-serif text-[1.75rem] font-semibold text-slate-800 dark:text-slate-200 leading-none sm:text-xl">
						{progress.percentComplete}%
					</span>
					<span className="font-sans text-[0.6875rem] text-slate-500 dark:text-slate-400 mt-0.5">
						Complete
					</span>
				</div>
			</div>

			{/* Status Grid */}
			<div className="grid grid-cols-2 gap-3 w-full sm:gap-2">
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
		<div className="text-center py-3 px-2 bg-slate-50 dark:bg-slate-800 rounded-[10px] sm:py-2.5 sm:px-1.5">
			<div
				className={`font-sans text-xl font-semibold sm:text-base ${colorClass}`}
			>
				{value}
			</div>
			<div className="font-sans text-[0.6875rem] text-slate-500 dark:text-slate-400 mt-0.5">
				{label}
			</div>
		</div>
	);
}
