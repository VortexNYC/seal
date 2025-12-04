import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface PageAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
	variant?: "default" | "outline" | "ghost" | "destructive";
}

interface PageWrapperProps {
	children: ReactNode;
	title: string;
	description?: string;
	action?: PageAction;
	actions?: PageAction[];
	/** SEA-132: Custom header actions (e.g., export dialog) */
	headerActions?: ReactNode;
}

export function PageWrapper({
	children,
	title,
	description,
	action,
	actions,
	headerActions,
}: PageWrapperProps) {
	const allActions = action ? [action, ...(actions || [])] : actions || [];

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			<div className="sticky top-0 z-10 border-b bg-background">
				<div className="flex min-h-16 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-0">
					<div className="flex items-center gap-4 flex-1 min-w-0">
						<SidebarTrigger />
						<Separator orientation="vertical" className="h-6 hidden sm:block" />
						<div className="flex-1 min-w-0">
							<h1 className="text-base sm:text-lg font-semibold truncate">
								{title}
							</h1>
							{description && (
								<p className="text-xs sm:text-sm text-muted-foreground truncate">
									{description}
								</p>
							)}
						</div>
					</div>
					{(allActions.length > 0 || headerActions) && (
						<div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
							{headerActions}
							{allActions.map((actionItem, index) => {
								const Icon = actionItem.icon;
								return (
									<Button
										key={index}
										onClick={actionItem.onClick}
										variant={actionItem.variant || "default"}
										size="sm"
										className="flex-1 sm:flex-none"
									>
										{Icon && <Icon className="mr-2 h-4 w-4" />}
										<span className="truncate">{actionItem.label}</span>
									</Button>
								);
							})}
						</div>
					)}
				</div>
			</div>
			<div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
		</div>
	);
}
