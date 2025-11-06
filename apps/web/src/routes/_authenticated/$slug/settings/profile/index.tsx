/**
 * Profile Settings Page - General
 *
 * User profile management with avatar upload, name, email, and bio fields
 * Route: /{slug}/settings/profile/ (index)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormSkeleton } from "@/components/skeletons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/profile/",
)({
	component: ProfileSettings,
	pendingComponent: FormSkeleton,
});

function ProfileSettings() {
	const { user } = useUser();
	const [isEditing, setIsEditing] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		firstName: user?.firstName || "",
		lastName: user?.lastName || "",
		email: user?.primaryEmailAddress?.emailAddress || "",
		imageUrl: user?.imageUrl || "",
	})

	const handleSave = async () => {
		if (!user) return;

		// Validation
		if (!formData.firstName?.trim()) {
			toast.error("First name is required");
			return
		}
		if (!formData.lastName?.trim()) {
			toast.error("Last name is required");
			return
		}

		setIsLoading(true);
		try {
			// Update user profile in Clerk
			await user.update({
				firstName: formData.firstName.trim(),
				lastName: formData.lastName.trim(),
			})

			// TODO: Sync to Convex if needed

			toast.success("Profile updated successfully");
			setIsEditing(false);
		} catch (error) {
			console.error("Failed to update profile:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update profile. Please try again.",
			)
		} finally {
			setIsLoading(false);
		}
	}

	const handleCancel = () => {
		setFormData({
			firstName: user?.firstName || "",
			lastName: user?.lastName || "",
			email: user?.primaryEmailAddress?.emailAddress || "",
			imageUrl: user?.imageUrl || "",
		})
		setIsEditing(false);
	}

	const handleAvatarChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file || !user) return;

		// Validate file type
		const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
		if (!validTypes.includes(file.type)) {
			toast.error(
				"Invalid file type. Please upload a JPG, PNG, or WebP image.",
			)
			return
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			toast.error("File size too large. Maximum size is 5MB.");
			return
		}

		setIsLoading(true);
		try {
			// Upload avatar to Clerk
			await user.setProfileImage({ file });

			toast.success("Avatar updated successfully");

			// Update local state
			setFormData((prev) => ({
				...prev,
				imageUrl: user.imageUrl,
			}))
		} catch (error) {
			console.error("Failed to upload avatar:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload avatar. Please try again.",
			)
		} finally {
			setIsLoading(false);
		}
	}

	const userInitials = `${formData.firstName?.charAt(0) || ""}${formData.lastName?.charAt(0) || ""}`.toUpperCase();

	if (!user) {
		return (
			<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
				Loading profile...
			</div>
		)
	}

	return (
		<div className="space-y-6">
				{/* Profile Header Card */}
				<Card>
					<CardHeader>
						<CardTitle>Profile Information</CardTitle>
						<CardDescription>
							Manage your personal information and avatar
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Avatar Section */}
						<div className="flex items-center gap-4">
							<Avatar className="h-16 w-16">
								<AvatarImage src={formData.imageUrl} alt="Profile picture" />
								<AvatarFallback>{userInitials || "U"}</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<p className="text-sm font-medium">Profile Picture</p>
								<p className="text-xs text-muted-foreground">
									JPG, PNG, or WebP. Max size 5MB.
								</p>
							</div>
							<label htmlFor="avatar-upload">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading}
									onClick={() => document.getElementById("avatar-upload")?.click()}
								>
									{isLoading ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Upload className="mr-2 h-4 w-4" />
									)}
									Upload
								</Button>
								<input
									id="avatar-upload"
									type="file"
									accept="image/jpeg,image/jpg,image/png,image/webp"
									className="hidden"
									onChange={handleAvatarChange}
									disabled={isLoading}
								/>
							</label>
						</div>

						{/* Form Fields */}
						<div className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="firstName">First Name</Label>
									<Input
										id="firstName"
										value={formData.firstName}
										onChange={(e) =>
											setFormData({ ...formData, firstName: e.target.value })
										}
										disabled={!isEditing || isLoading}
										placeholder="Enter your first name"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="lastName">Last Name</Label>
									<Input
										id="lastName"
										value={formData.lastName}
										onChange={(e) =>
											setFormData({ ...formData, lastName: e.target.value })
										}
										disabled={!isEditing || isLoading}
										placeholder="Enter your last name"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">Email Address</Label>
								<Input
									id="email"
									type="email"
									value={formData.email}
									disabled
									className="bg-muted"
								/>
								<p className="text-xs text-muted-foreground">
									To change your email, please contact support or use your account
									settings.
								</p>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2">
							{!isEditing ? (
								<Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
							) : (
								<>
									<Button onClick={handleSave} disabled={isLoading}>
										{isLoading && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Save Changes
									</Button>
									<Button
										variant="outline"
										onClick={handleCancel}
										disabled={isLoading}
									>
										Cancel
									</Button>
								</>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
	)
}
