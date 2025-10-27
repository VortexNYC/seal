import type { LucideIcon } from "lucide-react";
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
	children: React.ReactNode;
	title: string;
	description?: string;
	action?: PageAction;
	actions?: PageAction[];
}

export function PageWrapper({
	children,
	title,
	description,
	action,
	actions,
}: PageWrapperProps) {
	const allActions = action ? [action, ...(actions || [])] : actions || [];

	return (
		<>
			<div className="border-b">
				<div className="flex h-16 items-center gap-4 px-6">
					<SidebarTrigger />
					<Separator orientation="vertical" className="h-6" />
					<div className="flex-1">
						<h1 className="text-lg font-semibold">{title}</h1>
						{description && (
							<p className="text-sm text-muted-foreground">{description}</p>
						)}
					</div>
					{allActions.length > 0 && (
						<div className="flex items-center gap-2">
							{allActions.map((actionItem, index) => {
								const Icon = actionItem.icon;
								return (
									<Button
										key={index}
										onClick={actionItem.onClick}
										variant={actionItem.variant || "default"}
									>
										{Icon && <Icon className="mr-2 h-4 w-4" />}
										{actionItem.label}
									</Button>
								);
							})}
						</div>
					)}
				</div>
			</div>
			<div className="p-6">{children}</div>
		</>
	);
}
