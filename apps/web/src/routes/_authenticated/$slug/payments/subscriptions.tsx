import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { formatMoney, money } from "@vortexnyc/money";
import { useAction, useQuery } from "convex/react";
import { Loader2, Pause, Play, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { NoVortexMerchantAccountState } from "@/components/payments/vortex-merchant-operational-surface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute(
  "/_authenticated/$slug/payments/subscriptions"
)({
  component: SubscriptionsPage,
});

function formatCurrency(amountCents: number, currency: string): string {
  return formatMoney(money(amountCents, currency.toUpperCase()));
}

function formatInterval(interval: string, count: number) {
  if (count === 1) return `Every ${interval}`;
  return `Every ${count} ${interval}s`;
}

function SubscriptionsPage() {
  const { slug } = Route.useParams();
  const merchantAccount = useQuery(
    api.payments.merchant_account_queries.getMerchantAccount,
    {
      slug,
    }
  );

  const subscriptions = useQuery(
    api.payments.queries.getActiveSubscriptions,
    merchantAccount?.status === "connected" ? { slug } : "skip"
  );

  const pauseSubscription = useAction(
    api.payments.subscription_actions.pauseSubscription
  );
  const resumeSubscription = useAction(
    api.payments.subscription_actions.resumeSubscription
  );
  const cancelSubscription = useAction(
    api.payments.subscription_actions.cancelSubscription
  );

  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (merchantAccount === undefined) {
    return null;
  }

  if (merchantAccount.status !== "connected") {
    return <NoVortexMerchantAccountState slug={slug} title="Subscriptions" />;
  }

  const handlePause = async (subscriptionId: string) => {
    setLoadingId(subscriptionId);
    try {
      await pauseSubscription({ slug, subscriptionId });
      toast.success("Subscription paused");
    } catch {
      toast.error("Failed to pause subscription");
    } finally {
      setLoadingId(null);
    }
  };

  const handleResume = async (subscriptionId: string) => {
    setLoadingId(subscriptionId);
    try {
      await resumeSubscription({ slug, subscriptionId });
      toast.success("Subscription resumed");
    } catch {
      toast.error("Failed to resume subscription");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    setLoadingId(subscriptionId);
    try {
      await cancelSubscription({ slug, subscriptionId });
      toast.success("Subscription will cancel at end of period");
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <PageWrapper
      title="Subscriptions"
      description="Manage recurring payments from your documents."
    >
      <div className="mt-6">
        {subscriptions === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                className="h-12 w-full"
                key={`skeleton-${i.toString()}`}
              />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            <RefreshCw className="mx-auto mb-3 size-8 opacity-50" />
            <p className="text-sm">No active subscriptions</p>
            <p className="mt-1 text-xs">
              Recurring payments will appear here when you send documents with
              recurring billing.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const isLoading = loadingId === sub.processorSubscriptionId;
                  return (
                    <TableRow key={sub._id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {sub.documentTitle}
                      </TableCell>
                      <TableCell>
                        <div>
                          {sub.customerName && (
                            <span className="text-sm">{sub.customerName}</span>
                          )}
                          <span className="text-muted-foreground block text-xs">
                            {sub.customerEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrency(sub.amountCents, sub.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatInterval(sub.interval, sub.intervalCount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sub.paymentStatus === "paid"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {sub.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              {sub.paymentStatus === "paid" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() =>
                                    handlePause(sub.processorSubscriptionId)
                                  }
                                  aria-label="Pause subscription"
                                >
                                  <Pause className="size-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() =>
                                    handleResume(sub.processorSubscriptionId)
                                  }
                                  aria-label="Resume subscription"
                                >
                                  <Play className="size-3.5" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive size-8"
                                    aria-label="Cancel subscription"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Cancel subscription?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will cancel the recurring payment for
                                      &ldquo;
                                      {sub.documentTitle}&rdquo; at the end of
                                      the current billing period. This action
                                      cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Keep active
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleCancel(
                                          sub.processorSubscriptionId
                                        )
                                      }
                                    >
                                      Cancel subscription
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
