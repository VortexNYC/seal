/**
 * Profile Settings Page - Security
 *
 * User security settings using Clerk's UserProfile component (Security tab)
 * Route: /{slug}/settings/profile/security
 */

import { UserProfile } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/profile/security",
)({
	component: SecuritySettings,
});

function SecuritySettings() {
	useEffect(() => {
		// Wait for the component to mount, then click the security button
		const timer = setTimeout(() => {
			const buttons = document.querySelectorAll(".cl-navbarButton");
			// Security is typically the second button (index 1)
			const securityButton = buttons[1] as HTMLButtonElement;
			if (securityButton) {
				securityButton.click();
			}
		}, 100);

		return () => clearTimeout(timer);
	}, []);

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
			<UserProfile
				appearance={{
					elements: {
						cardBox: "!shadow-sm !bg-card !rounded-xl !border",
					},
				}}
			/>
		</div>
	);
}
