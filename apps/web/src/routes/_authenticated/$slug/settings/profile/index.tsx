/**
 * Profile Settings Page - General
 *
 * Core VortexUserProfile for account identity; Seal-specific bio remains
 * Convex-backed below.
 * Route: /{slug}/settings/profile/ (index)
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexUserProfile,
  type VortexUserProfileUser,
  useVortexAuthUpdateProfile,
} from "@vortexnyc/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/auth-runtime.better-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/")(
  {
    component: ProfileSettings,
  }
);

const MAX_BIO_LENGTH = 500;

function ProfileSettings() {
  const { user, isLoaded } = useCurrentUser();
  const { updateProfile: updateAuthProfile } =
    useVortexAuthUpdateProfile(authClient);
  const userProfile = useQuery(api.user_profiles.queries.getCurrentUserProfile);
  const updateProfile = useMutation(api.user_profiles.mutations.updateProfile);

  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const profileUser = useMemo<VortexUserProfileUser | null>(() => {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.username ?? null,
      imageUrl: user.imageUrl ?? null,
    };
  }, [user]);

  useEffect(() => {
    if (userProfile?.bio !== undefined) {
      setBio(userProfile.bio || "");
    }
  }, [userProfile?.bio]);

  useEffect(() => {
    const originalBio = userProfile?.bio || "";
    setHasChanges(bio !== originalBio);
  }, [bio, userProfile?.bio]);

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_BIO_LENGTH) {
      setBio(value);
    }
  };

  const handleSaveBio = async () => {
    setIsSubmitting(true);

    try {
      await updateProfile({
        bio: bio.trim(),
      });

      toast.success("Profile updated successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <VortexUserProfile
        isLoading={!isLoaded}
        onChangePassword={() => {
          toast.info(
            "To change your password, sign out and use Forgot password on the sign-in page."
          );
        }}
        onDeleteAccount={() => {
          toast.info(
            "Account deletion is not available from this screen. Contact support."
          );
        }}
        onManageTwoFactor={() => {
          toast.info("Manage two-factor authentication under Security.");
        }}
        onUpdateProfile={async (input) => {
          const result = await updateAuthProfile({
            name: input.name,
            ...(input.imageUrl != null ? { image: input.imageUrl } : {}),
          });
          if (!result.ok) {
            toast.error(result.error ?? "Failed to update profile");
            return;
          }
          toast.success("Profile updated successfully");
        }}
        user={profileUser}
      />

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Optional bio shown on your Seal workspace profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              className={cn("min-h-28")}
              id="bio"
              maxLength={MAX_BIO_LENGTH}
              onChange={handleBioChange}
              placeholder="A short bio"
              value={bio}
            />
            <p className="text-muted-foreground text-xs">
              {bio.length}/{MAX_BIO_LENGTH}
            </p>
          </div>
          <Button
            disabled={!hasChanges || isSubmitting}
            onClick={() => {
              void handleSaveBio();
            }}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving…" : "Save bio"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
