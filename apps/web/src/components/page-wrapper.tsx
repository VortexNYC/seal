import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PageWrapper({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<>
			<div className="border-b">
				<div className="flex h-16 items-center gap-4 px-6">
					<SidebarTrigger />
					<Separator orientation="vertical" className="h-6" />
					<div className="flex-1">
						<h1 className="text-lg font-semibold">{title}</h1>
					</div>
				</div>
			</div>
			<div className="p-6">{children}</div>
		</>
	);
}
