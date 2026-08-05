/**
 * Authenticated layout: Core AuthAuthenticatedRouteGate for auth / org
 * membership, plus Seal WorkspaceSlugGuard for `/{slug}/…` product paths
 * (SEA-600 / SEA-606). Public recipient signing stays at `/sign/$token`.
 */
import { api } from "@seal/backend/convex/_generated/api";
import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";

import Loader from "@/components/loader";
import {
  authRoutePaths,
  captureAuthEvent,
  consumePendingAuthFlow,
  runtime,
  toSafeRedirectPath,
} from "@/lib/auth-runtime.better-auth";
import {
  buildOrganizationPath,
  isPathWithinOrganization,
} from "@/lib/organization-path";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <runtime.AuthAuthenticatedRouteGate
      captureAuthEvent={captureAuthEvent}
      chooseOrganizationPath={authRoutePaths.chooseOrganizationPath}
      consumePendingAuthFlow={consumePendingAuthFlow}
      getDefaultOrganization={api.check_membership.getDefaultOrganization}
      navigate={navigate}
      pathname={pathname}
      postSignUpPath={authRoutePaths.postSignUpPath}
      renderLoading={() => (
        <div className="flex min-h-dvh items-center justify-center">
          <Loader />
        </div>
      )}
      renderOrganizationRequired={({ chooseOrganizationPath }) => (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
          <p className="text-muted-foreground text-center text-sm">
            Pick an active Seal workspace before opening the product.
          </p>
          <Link
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            to={chooseOrganizationPath}
          >
            Choose organization
          </Link>
        </div>
      )}
      renderRedirectingToSignIn={() => (
        <div className="flex min-h-dvh items-center justify-center">
          <Loader />
        </div>
      )}
      signInPath={authRoutePaths.signInPath}
      toSafeRedirectPath={toSafeRedirectPath}
    >
      {({ isPostSignUpRoute }) =>
        isPostSignUpRoute ? (
          <Outlet />
        ) : (
          <WorkspaceSlugGuard>
            <Outlet />
          </WorkspaceSlugGuard>
        )
      }
    </runtime.AuthAuthenticatedRouteGate>
  );
}

/**
 * Seal-only (SEA-606): keep product routes under `/{slug}/…` once Core has
 * confirmed an active organization. Does not re-check auth or membership —
 * that belongs to AuthAuthenticatedRouteGate.
 */
function WorkspaceSlugGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const organizationStatus = useQuery(api.check_membership.hasOrganization);

  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  const isPublicRoute = location.pathname.startsWith("/docs");
  const isChooseOrganizationRoute =
    location.pathname === authRoutePaths.chooseOrganizationPath ||
    location.pathname.startsWith(`${authRoutePaths.chooseOrganizationPath}/`);

  // null = identity not attached yet; undefined = query loading.
  if (organizationStatus === undefined || organizationStatus === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  const activeOrganizationSlug =
    organizationStatus.activeOrganizationSlug ?? null;

  if (isChooseOrganizationRoute || isPublicRoute) {
    return <>{children}</>;
  }

  if (!activeOrganizationSlug) {
    return <Navigate to={authRoutePaths.chooseOrganizationPath} replace />;
  }

  if (isOnboardingRoute) {
    const params = new URLSearchParams(location.search ?? "");
    const returnTo = params.get("returnTo");
    const target = returnTo
      ? buildOrganizationPath(activeOrganizationSlug, returnTo)
      : buildOrganizationPath(activeOrganizationSlug, "/home");

    return <Navigate to={target} replace />;
  }

  const isWithinOrg = isPathWithinOrganization(
    activeOrganizationSlug,
    location.pathname
  );

  if (!isWithinOrg) {
    const segments = location.pathname.split("/").filter(Boolean);
    const looksLikeOrgPath =
      segments.length >= 1 && segments[0] !== activeOrganizationSlug;
    if (looksLikeOrgPath) {
      return <>{children}</>;
    }

    return (
      <Navigate
        replace
        to={buildOrganizationPath(activeOrganizationSlug, "/home")}
      />
    );
  }

  return <>{children}</>;
}
