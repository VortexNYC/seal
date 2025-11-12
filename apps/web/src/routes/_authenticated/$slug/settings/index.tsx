/**
 * General Settings Page
 *
 * Organization general settings
 * Route: /{slug}/settings
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Building2, Globe, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
	component: GeneralSettings,
	pendingComponent: FormSkeleton,
});

// Common timezones
const TIMEZONES = [
	{ value: "UTC", label: "UTC (Coordinated Universal Time)" },
	{ value: "America/New_York", label: "Eastern Time (US & Canada)" },
	{ value: "America/Chicago", label: "Central Time (US & Canada)" },
	{ value: "America/Denver", label: "Mountain Time (US & Canada)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
	{ value: "America/Sao_Paulo", label: "Brasília (Brazil)" },
	{ value: "Europe/London", label: "London (UK)" },
	{ value: "Europe/Paris", label: "Paris (Central European)" },
	{ value: "Europe/Berlin", label: "Berlin (Germany)" },
	{ value: "Asia/Tokyo", label: "Tokyo (Japan)" },
	{ value: "Asia/Shanghai", label: "Shanghai (China)" },
	{ value: "Asia/Dubai", label: "Dubai (UAE)" },
	{ value: "Australia/Sydney", label: "Sydney (Australia)" },
];

// Common currencies
const CURRENCIES = [
	{ value: "USD", label: "USD - US Dollar" },
	{ value: "EUR", label: "EUR - Euro" },
	{ value: "GBP", label: "GBP - British Pound" },
	{ value: "BRL", label: "BRL - Brazilian Real" },
	{ value: "JPY", label: "JPY - Japanese Yen" },
	{ value: "CNY", label: "CNY - Chinese Yuan" },
	{ value: "AUD", label: "AUD - Australian Dollar" },
	{ value: "CAD", label: "CAD - Canadian Dollar" },
	{ value: "CHF", label: "CHF - Swiss Franc" },
	{ value: "INR", label: "INR - Indian Rupee" },
];

function GeneralSettings() {
	const { slug } = Route.useParams();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const updateWorkspace = useMutation(
		api.organizations.mutations.updateWorkspace,
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		timezone: "UTC",
		currency: "BRL",
	});

	// Initialize form data when organization loads
	useEffect(() => {
		if (organization) {
			setFormData({
				name: organization.name || "",
				timezone: organization.timezone || "UTC",
				currency: organization.currency || "BRL",
			});
		}
	}, [organization]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name.trim()) {
			toast.error("Workspace name is required");
			return;
		}

		setIsSubmitting(true);

		try {
			await updateWorkspace({
				name: formData.name.trim(),
				timezone: formData.timezone,
				currency: formData.currency,
			});

			toast.success("Workspace settings updated successfully");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update workspace settings",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!organization) {
		return null;
	}

	return (
		<PageWrapper title="General Settings">
			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Workspace Information */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Building2 className="h-5 w-5" />
							<CardTitle>Workspace Information</CardTitle>
						</div>
						<CardDescription>
							Update your workspace name and identification
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Workspace Name</Label>
							<Input
								id="name"
								type="text"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								placeholder="My Workspace"
								required
							/>
							<p className="text-sm text-muted-foreground">
								This is the display name for your workspace
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="slug">Workspace Slug</Label>
							<Input
								id="slug"
								type="text"
								value={organization.slug}
								disabled
								className="bg-muted"
							/>
							<p className="text-sm text-muted-foreground">
								The slug is used in URLs and cannot be changed
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Regional Settings */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Globe className="h-5 w-5" />
							<CardTitle>Regional Settings</CardTitle>
						</div>
						<CardDescription>
							Configure timezone and currency preferences
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="timezone">Timezone</Label>
							<Select
								value={formData.timezone}
								onValueChange={(value) =>
									setFormData({ ...formData, timezone: value })
								}
							>
								<SelectTrigger id="timezone">
									<SelectValue placeholder="Select timezone" />
								</SelectTrigger>
								<SelectContent>
									{TIMEZONES.map((tz) => (
										<SelectItem key={tz.value} value={tz.value}>
											{tz.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground">
								Default timezone for dates and times in this workspace
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="currency">Currency</Label>
							<Select
								value={formData.currency}
								onValueChange={(value) =>
									setFormData({ ...formData, currency: value })
								}
							>
								<SelectTrigger id="currency">
									<SelectValue placeholder="Select currency" />
								</SelectTrigger>
								<SelectContent>
									{CURRENCIES.map((curr) => (
										<SelectItem key={curr.value} value={curr.value}>
											{curr.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground">
								Default currency for billing and pricing
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Save Button */}
				<div className="flex justify-end">
					<Button type="submit" disabled={isSubmitting}>
						<Save className="mr-2 h-4 w-4" />
						{isSubmitting ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</form>
		</PageWrapper>
	);
}
