/**
 * Profile Settings Page - General
 *
 * User profile management using Clerk's UserProfile component
 * Route: /{slug}/settings/profile/ (index)
 */

import { UserProfile } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/")(
	{
		component: ProfileSettings,
	},
);

function ProfileSettings() {
	return (
		<div>
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
        `}
			</style>
			<UserProfile />
		</div>
	);
}
