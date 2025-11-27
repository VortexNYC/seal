import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";

interface SigningProgressProps {
	progress: {
		total: number;
		completed: number;
		percentComplete: number;
		byStatus: {
			pending: number;
			viewed: number;
			signed: number;
			approved: number;
			declined: number;
		};
	};
}

export function SigningProgress({ progress }: SigningProgressProps) {
	const { total, completed, percentComplete, byStatus } = progress;

	if (total === 0) {
		return null;
	}

	return (
		<Card>
			<CardContent className="space-y-4">
				<div>
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">
							{completed} of {total} completed
						</span>
						<span className="text-sm text-muted-foreground">
							{percentComplete}%
						</span>
					</div>
					<Progress value={percentComplete} className="h-2" />
				</div>

				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<div className="text-muted-foreground">Pending</div>
						<div className="text-lg font-semibold">{byStatus.pending}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Viewed</div>
						<div className="text-lg font-semibold text-blue-500">
							{byStatus.viewed}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground">Signed</div>
						<div className="text-lg font-semibold text-green-500">
							{byStatus.signed}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground">Declined</div>
						<div className="text-lg font-semibold text-destructive">
							{byStatus.declined}
						</div>
					</div>
				</div>

				{byStatus.pending > 0 && (
					<div className="text-xs text-muted-foreground pt-2 border-t">
						Waiting for {byStatus.pending}{" "}
						{byStatus.pending === 1 ? "person" : "people"} to take action
					</div>
				)}
			</CardContent>
		</Card>
	);
}
