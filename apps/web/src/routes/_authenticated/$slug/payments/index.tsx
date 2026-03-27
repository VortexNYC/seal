import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BadgeDollarSign, CircleDollarSign, Clock, Receipt } from "lucide-react";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { NoStripeConnectState } from "@/components/stripe/no-connect-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatting";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/payments/")({
  component: PaymentsOverviewPage,
});

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  open: "secondary",
  void: "outline",
  draft: "outline",
  uncollectible: "destructive",
  deleted: "destructive",
};

function PaymentsOverviewPage() {
  const { slug } = Route.useParams();
  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, { slug });

  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "open" | "void">("all");

  const stats = useQuery(
    api.stripe.revenue_queries.getRevenueStats,
    connectedAccount?.status === "connected" ? { slug } : "skip",
  );

  const transactions = useQuery(
    api.stripe.revenue_queries.getTransactionList,
    connectedAccount?.status === "connected"
      ? { slug, statusFilter: statusFilter === "all" ? "all" : statusFilter }
      : "skip",
  );

  if (connectedAccount === undefined) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <NoStripeConnectState slug={slug} title="Payments Overview" />;
  }

  return (
    <PageWrapper title="Payments Overview" description="Revenue summary and recent transactions.">
      {/* Revenue Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CircleDollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalRevenue, stats.currency)}
              </div>
            ) : (
              <Skeleton className="h-8 w-24" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <BadgeDollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">
                {formatCurrency(stats.monthlyRevenue, stats.currency)}
              </div>
            ) : (
              <Skeleton className="h-8 w-24" />
            )}
            <p className="text-muted-foreground text-xs">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <Receipt className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">{stats.paidCount}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">{stats.pendingCount}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transactions</h3>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {transactions === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton className="h-12 w-full" key={`skeleton-${i.toString()}`} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            <Receipt className="mx-auto mb-3 size-8 opacity-50" />
            <p className="text-sm">No transactions yet</p>
            <p className="mt-1 text-xs">
              Transactions will appear here when recipients make payments on your documents.
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
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx._id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {tx.documentTitle}
                    </TableCell>
                    <TableCell>
                      <div>
                        {tx.customerName && <span className="text-sm">{tx.customerName}</span>}
                        <span className="text-muted-foreground block text-xs">
                          {tx.customerEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(tx.amountDue, tx.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[tx.status] ?? "outline"}>{tx.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tx.paidAt ? formatDate(tx.paidAt) : formatDate(tx.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
