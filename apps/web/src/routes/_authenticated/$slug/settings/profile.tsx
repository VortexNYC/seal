/**
 * Profile Settings Layout
 *
 * Layout wrapper for all profile-related settings pages with sidebar navigation
 * Route: /{slug}/settings/profile/*
 */

import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { BarChart3, Bell, Plug, Shield, User } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile")({
	component: ProfileLayout,
});

type ProfileNavItem = {
	title: string;
	href: string;
	icon: React.ElementType;
	description: string;
};

function ProfileLayout() {
	const { slug } = Route.useParams();
	const location = useLocation();

	const navItems: ProfileNavItem[] = [
		{
			title: "General",
			href: `/${slug}/settings/profile`,
			icon: User,
			description: "Manage your personal information and avatar",
		},
		{
			title: "Security",
			href: `/${slug}/settings/profile/security`,
			icon: Shield,
			description: "Password, MFA, and session management",
		},
		{
			title: "Notifications",
			href: `/${slug}/settings/profile/notifications`,
			icon: Bell,
			description: "Configure your notification preferences",
		},
		{
			title: "Integrations",
			href: `/${slug}/settings/profile/integrations`,
			icon: Plug,
			description: "API keys and connected applications",
		},
		{
			title: "Usage",
			href: `/${slug}/settings/profile/usage`,
			icon: BarChart3,
			description: "View your usage statistics",
		},
	];

	return (
		<PageWrapper title="Profile Settings">
			<div className="flex flex-col gap-6 lg:flex-row">
				{/* Sidebar Navigation */}
				<aside className="w-full lg:w-64">
					<nav className="space-y-1">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = location.pathname === item.href;

							return (
								<Link
									key={item.href}
									to={item.href}
									className={cn(
										"flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
										isActive
											? "bg-secondary text-secondary-foreground"
											: "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground",
									)}
								>
									<Icon className="mt-0.5 h-4 w-4 shrink-0" />
									<div className="flex-1">
										<div className="font-medium">{item.title}</div>
										<div className="text-xs text-muted-foreground">
											{item.description}
										</div>
									</div>
								</Link>
							);
						})}
					</nav>
				</aside>

				{/* Content Area */}
				<div className="flex-1">
					<Outlet />
				</div>
			</div>
		</PageWrapper>
	);
}
