/**
 * Profile Settings Page - General
 *
 * User profile management using Clerk's UserProfile component
 * with additional bio field stored in Convex
 * Route: /{slug}/settings/profile/ (index)
 */

import { UserProfile } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Save, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/")({
  component: ProfileSettings,
});

const MAX_BIO_LENGTH = 500;

function ProfileSettings() {
  const userProfile = useQuery(api.user_profiles.queries.getCurrentUserProfile);
  const updateProfile = useMutation(api.user_profiles.mutations.updateProfile);

  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize bio when profile loads
  useEffect(() => {
    if (userProfile?.bio !== undefined) {
      setBio(userProfile.bio || "");
    }
  }, [userProfile?.bio]);

  // Track changes
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
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clerk UserProfile for account settings */}
      <style>
        {`
					/* Hide the entire navbar/sidebar */
					.cl-navbar,
					.cl-userProfile__navbar {
						display: none !important;
					}

					/* Add padding to the left side of the content area */
					.cl-pageScrollBox,
					.cl-userProfile__pageScrollBox {
						padding-left: 2rem !important;
					}

					/* Remove shadow from profile details card */
					.cl-profileSection__profile,
					.cl-profileSection {
						box-shadow: none !important;
					}
				`}
      </style>
      <UserProfile
        appearance={{
          elements: {
            cardBox: "!shadow-sm !bg-card !rounded-xl !border",
          },
        }}
      />

      {/* Bio Card - Custom Convex-backed field */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>About You</CardTitle>
          </div>
          <CardDescription>
            Tell others a bit about yourself. This will be visible to your team members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={handleBioChange}
              placeholder="Write a short bio about yourself..."
              className="min-h-[100px] resize-none"
              maxLength={MAX_BIO_LENGTH}
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">A brief description about yourself</p>
              <p
                className={`text-sm ${
                  bio.length >= MAX_BIO_LENGTH * 0.9 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {bio.length}/{MAX_BIO_LENGTH}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveBio} disabled={isSubmitting || !hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Bio"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
