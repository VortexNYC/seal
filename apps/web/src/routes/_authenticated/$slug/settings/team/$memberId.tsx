import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Mail, Calendar, Shield } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/team/$memberId",
)({
	component: MemberDetails,
});

function MemberDetails() {
	const { slug, memberId } = Route.useParams();
	const navigate = useNavigate();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const orgId = organization?._id as Id<"organizations"> | undefined;

	const member = useQuery(
		api.organizations.queries.getOrganizationMember,
		orgId && memberId
			? {
					organizationId: orgId,
					memberId: memberId as Id<"organization_members">,
				}
			: "skip",
	);

	if (!organization || !orgId) {
		return <div>Loading...</div>;
	}

	if (!member) {
		return <div>Loading member details...</div>;
	}

	const getInitials = (name: string | null | undefined, email: string) => {
		if (name) {
			return name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}
		return email.slice(0, 2).toUpperCase();
	};

	const getRoleBadge = (
		role: "system" | "owner" | "admin" | "member" | "viewer",
	) => {
		const colors: Record<typeof role, string> = {
			owner:
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
			admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			member:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
			system: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		};

		return (
			<Badge variant="outline" className={colors[role]}>
				{role}
			</Badge>
		);
	};

	const getStatusBadge = (
		status: "active" | "inactive" | "suspended" | "pending" | "blocked",
	) => {
		const variants: Record<
			typeof status,
			"default" | "secondary" | "destructive" | "outline"
		> = {
			active: "default",
			inactive: "secondary",
			suspended: "destructive",
			pending: "outline",
			blocked: "destructive",
		};

		return (
			<Badge variant={variants[status]} className="capitalize">
				{status}
			</Badge>
		);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<PageWrapper
			title="Member Details"
			action={{
				label: "Back to Team",
				onClick: () => {
					navigate({
						to: "/$slug/settings/team",
						params: { slug },
					});
				},
				icon: ArrowLeft,
				variant: "ghost",
			}}
		>
			<div className="space-y-6">
				{/* Member Profile Card */}
				<Card>
					<CardHeader>
						<div className="flex items-start gap-4">
							<Avatar className="h-20 w-20">
								<AvatarImage src={member.avatarUrl ?? undefined} />
								<AvatarFallback className="text-2xl">
									{getInitials(member.name, member.email)}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<CardTitle className="text-2xl">
									{member.name || "Unknown User"}
								</CardTitle>
								<CardDescription className="mt-1 flex items-center gap-2">
									<Mail className="h-4 w-4" />
									{member.email}
								</CardDescription>
								<div className="mt-3 flex items-center gap-2">
									{getRoleBadge(member.role)}
									{getStatusBadge(member.status)}
									{member.isPrimary && (
										<Badge variant="outline">Primary Organization</Badge>
									)}
								</div>
							</div>
						</div>
					</CardHeader>
				</Card>

				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
						<CardDescription>
							Member details and account information
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<Calendar className="h-4 w-4" />
									Joined
								</div>
								<p className="mt-1 text-sm">{formatDate(member.joinedAt)}</p>
							</div>

							<div>
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<Shield className="h-4 w-4" />
									Role
								</div>
								<p className="mt-1 text-sm capitalize">{member.role}</p>
							</div>

							{member.timezone && (
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Timezone
									</div>
									<p className="mt-1 text-sm">{member.timezone}</p>
								</div>
							)}

							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Status
								</div>
								<p className="mt-1 text-sm capitalize">{member.status}</p>
							</div>
						</div>

						{member.customRole && (
							<>
								<Separator />
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Custom Role
									</div>
									<p className="mt-1 text-sm font-medium">
										{member.customRole.name}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{member.customRole.permissions.length} permissions assigned
									</p>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
