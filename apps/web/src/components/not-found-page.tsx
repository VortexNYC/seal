import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowLeft,
  EnvelopeSimple,
  House,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";

/**
 * 404 Not Found page component
 *
 * Displays when a user navigates to a route that doesn't exist.
 * Includes helpful navigation links to get users back on track.
 */
export function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="bg-kumo-surface flex min-h-svh items-center justify-center p-4">
      <LayerCard className="w-full max-w-lg">
        <LayerCard.Primary className="text-center">
          <div className="bg-kumo-elevated mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <MagnifyingGlass className="text-kumo-secondary size-8" />
          </div>
          <Text as="h2" size="lg" variant="heading">
            Page not found
          </Text>
          <Text as="p" size="sm" variant="secondary">
            Sorry, we couldn't find the page you're looking for. It may have
            been moved, deleted, or never existed.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Secondary className="space-y-3">
          <div className="space-y-2">
            <Text as="p" size="sm" variant="body">
              Here are some helpful links:
            </Text>
            <ul className="text-kumo-secondary space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <span className="bg-kumo-secondary size-1.5 rounded-full" />
                <Link
                  to="/"
                  className="text-kumo-secondary hover:text-kumo-primary hover:underline"
                >
                  Go to the home page
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="bg-kumo-secondary size-1.5 rounded-full" />
                <Link
                  to="/app"
                  className="text-kumo-secondary hover:text-kumo-primary hover:underline"
                >
                  View your dashboard
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="bg-kumo-secondary size-1.5 rounded-full" />
                <LinkButton
                  href="mailto:support@seal.nyc"
                  variant="ghost"
                  className="text-kumo-secondary hover:text-kumo-primary h-auto p-0"
                >
                  Contact support
                </LinkButton>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => void router.navigate({ to: "/" })}
              className="w-full sm:w-auto"
              icon={House}
            >
              Go to Home
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => window.history.back()}
              icon={ArrowLeft}
            >
              Go Back
            </Button>
            <LinkButton
              href="mailto:support@seal.nyc"
              variant="ghost"
              className="w-full sm:w-auto"
              icon={EnvelopeSimple}
            >
              Contact Support
            </LinkButton>
          </div>
        </LayerCard.Secondary>
      </LayerCard>
    </div>
  );
}
