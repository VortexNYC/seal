import { Link } from "@tanstack/react-router";
import { PlugZap } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NoStripeConnectStateProps {
  slug: string;
  title: string;
}

export function NoStripeConnectState({ slug, title }: NoStripeConnectStateProps) {
  return (
    <PageWrapper title={title}>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PlugZap className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">Stripe not connected</h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-center text-sm">
            Connect a Stripe account to view this data.
          </p>
          <Button asChild>
            <Link to="/$slug/settings/payments" params={{ slug }}>
              Connect Stripe
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
