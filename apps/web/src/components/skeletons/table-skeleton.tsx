/**
 * TableSkeleton Component
 *
 * Loading skeleton for table-based content like member tables,
 * document tables, and data grids.
 *
 * @example
 * ```tsx
 * // Default table with 5 rows and 4 columns
 * <TableSkeleton />
 *
 * // Table with custom dimensions
 * <TableSkeleton rows={10} columns={6} />
 *
 * // Table without header
 * <TableSkeleton rows={3} showHeader={false} />
 * ```
 */

import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
	/** Number of rows to show (default: 5) */
	rows?: number;
	/** Number of columns to show (default: 4) */
	columns?: number;
	/** Whether to show header row (default: true) */
	showHeader?: boolean;
}

export function TableSkeleton({
	rows = 5,
	columns = 4,
	showHeader = true,
}: TableSkeletonProps) {
	return (
		<div className="rounded-md border" role="status" aria-label="Loading table">
			<Table>
				{showHeader && (
					<TableHeader>
						<TableRow>
							{Array.from({ length: columns }).map((_, i) => (
								<TableHead key={i}>
									<Skeleton className="h-4 w-[100px]" />
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
				)}
				<TableBody>
					{Array.from({ length: rows }).map((_, rowIndex) => (
						<TableRow key={rowIndex}>
							{Array.from({ length: columns }).map((_, colIndex) => (
								<TableCell key={colIndex}>
									<Skeleton className="h-4 w-full max-w-[200px]" />
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
