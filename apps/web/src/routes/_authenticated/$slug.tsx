/**
 * Workspace Layout Route
 *
 * Main layout for organization workspaces with sidebar navigation
 * Route: /{slug}/*
 */

import { useClerk } from "@clerk/clerk-react";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	BarChart3,
	FileText,
	Home,
	Key,
	LayoutTemplate,
	LogOut,
	Settings,
	Users,
	Webhook,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/$slug")({
	component: WorkspaceLayout,
});

function WorkspaceLayout() {
	const { slug } = Route.useParams();

	// Fetch organization details
	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	if (!organization) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-semibold">Loading workspace...</h2>
				</div>
			</div>
		);
	}

	const orgId = organization._id as Id<"organizations">;

	return (
		<SidebarProvider>
			<div className="flex min-h-screen w-full">
				<WorkspaceSidebar slug={slug} orgId={orgId} />
				<main className="flex-1">
					<div className="border-b">
						<div className="flex h-16 items-center gap-4 px-6">
							<SidebarTrigger />
							<Separator orientation="vertical" className="h-6" />
							<div className="flex-1">
								<h1 className="text-lg font-semibold">{organization.name}</h1>
							</div>
						</div>
					</div>
					<div className="p-6">
						<Outlet />
					</div>
				</main>
			</div>
		</SidebarProvider>
	);
}

interface WorkspaceSidebarProps {
	slug: string;
	orgId: Id<"organizations">;
}

function WorkspaceSidebar({ slug, orgId }: WorkspaceSidebarProps) {
	const { signOut } = useClerk();
	const permissions = useQuery(api.organizations.queries.getUserPermissions, {
		organizationId: orgId,
	});

	const menuItems = [
		{
			title: "Navigation",
			items: [
				{ icon: Home, label: "Home", href: `/${slug}/home`, show: true },
				{
					icon: FileText,
					label: "Documents",
					href: `/${slug}/documents`,
					show: permissions?.permissions.canCreateDocuments,
				},
				{
					icon: LayoutTemplate,
					label: "Templates",
					href: `/${slug}/templates`,
					show: permissions?.permissions.canCreateTemplates,
				},
				{
					icon: BarChart3,
					label: "Analytics",
					href: `/${slug}/analytics`,
					show: true,
				},
			],
		},
		{
			title: "Settings",
			items: [
				{
					icon: Settings,
					label: "General",
					href: `/${slug}/settings`,
					show: permissions?.permissions.canViewSettings,
				},
				{
					icon: Users,
					label: "Team",
					href: `/${slug}/settings/team`,
					show: permissions?.permissions.canViewMembers,
				},
				{
					icon: Webhook,
					label: "Webhooks",
					href: `/${slug}/settings/webhooks`,
					show: permissions?.permissions.canManageWebhooks,
				},
				{
					icon: Key,
					label: "API Keys",
					href: `/${slug}/settings/api`,
					show: permissions?.permissions.canManageAPIKeys,
				},
			],
		},
	];

	return (
		<Sidebar>
			<SidebarHeader className="border-b p-4">
				<Link
					to="/$slug/home"
					params={{ slug }}
					className="flex items-center gap-2"
				>
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<FileText className="h-4 w-4" />
					</div>
					<span className="font-semibold">Seal</span>
				</Link>
			</SidebarHeader>

			<SidebarContent>
				{menuItems.map((section) => (
					<SidebarGroup key={section.title}>
						<SidebarGroupLabel>{section.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items
									.filter((item) => item.show !== false)
									.map((item) => (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton asChild>
												<Link to={item.href}>
													<item.icon className="h-4 w-4" />
													<span>{item.label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter className="border-t p-4">
				<div className="flex items-center justify-between gap-4">
					<div className="text-xs text-muted-foreground">
						{permissions?.role && (
							<div className="capitalize">
								Role: <span className="font-medium">{permissions.role}</span>
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={() => signOut()}
						className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
						title="Sign out"
					>
						<LogOut className="h-4 w-4" />
						<span>Sign out</span>
					</button>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
