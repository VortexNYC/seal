/**
 * Personal prefs live on workspace Notifications — keep route as redirect.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/notifications"
)({
  component: ProfileNotificationsRedirect,
});

function ProfileNotificationsRedirect() {
  const { slug } = Route.useParams();
  return (
    <Navigate
      to="/$slug/settings/notifications"
      params={{ slug }}
      hash="your-preferences"
      replace
    />
  );
}
