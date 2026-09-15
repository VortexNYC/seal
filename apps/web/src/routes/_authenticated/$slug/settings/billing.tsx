/**
 * Billing Settings Page
 *
 * Route: /{slug}/settings/billing
 */

import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";
import {
  getOrganizationBilling,
  getOrganizationUsage,
  type ApiOrganizationBilling,
  type ApiOrganizationUsage,
} from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function UsageCard({ data }: { data: ApiOrganizationUsage }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <Text variant="secondary">Plan</Text>
          <Text as="p" variant="heading">
            {data.plan}
          </Text>
        </div>
        <div>
          <Text variant="secondary">Total documents</Text>
          <Text as="p" variant="heading">
            {data.totalDocuments}
          </Text>
        </div>
        <div>
          <Text variant="secondary">This month</Text>
          <Text as="p" variant="heading">
            {data.documentsThisMonth} / {data.documentsLimit}
          </Text>
        </div>
        <div>
          <Text variant="secondary">Storage</Text>
          <Text as="p" variant="heading">
            {formatBytes(data.storageUsedBytes)} /{" "}
            {formatBytes(data.storageLimitBytes)}
          </Text>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(data.workflowCounts).map(([status, count]) => (
          <div key={status}>
            <Text variant="secondary">
              {status
                .replace("_", " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
            <Text as="p" variant="heading">
              {count}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingCard({ data }: { data: ApiOrganizationBilling }) {
  return (
    <div className="grid gap-4">
      <div>
        <Text variant="secondary">Plan</Text>
        <Text as="p" variant="heading">
          {data.plan}
        </Text>
      </div>
      {data.subscription ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Text variant="secondary">Subscription status</Text>
            <Text as="p" variant="heading">
              {data.subscription.status}
            </Text>
          </div>
          <div>
            <Text variant="secondary">Current period</Text>
            <Text as="p" variant="heading">
              {formatDate(data.subscription.currentPeriodStart)} →{" "}
              {formatDate(data.subscription.currentPeriodEnd)}
            </Text>
          </div>
          <div>
            <Text variant="secondary">Cancel at period end</Text>
            <Text as="p" variant="heading">
              {data.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
            </Text>
          </div>
        </div>
      ) : (
        <Text variant="secondary">No active subscription.</Text>
      )}
      {data.invoices.length ? (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Date</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Amount</Table.Head>
              <Table.Head>Paid</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.invoices.map((invoice) => (
              <Table.Row key={invoice.id}>
                <Table.Cell>{formatDate(invoice.createdAt)}</Table.Cell>
                <Table.Cell>{invoice.status}</Table.Cell>
                <Table.Cell>
                  {formatCurrency(invoice.amountDue, invoice.currency)}
                </Table.Cell>
                <Table.Cell>{formatDate(invoice.paidAt)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Empty
          title="No invoices"
          description="No invoices for this workspace."
        />
      )}
    </div>
  );
}

function BillingSettingsPage() {
  const { slug } = Route.useParams();

  const billingQuery = useQuery<ApiOrganizationBilling>({
    queryKey: ["organization-billing", slug],
    queryFn: () => getOrganizationBilling(slug),
  });

  const usageQuery = useQuery<ApiOrganizationUsage>({
    queryKey: ["organization-usage", slug],
    queryFn: () => getOrganizationUsage(slug),
  });

  const billingError =
    billingQuery.error instanceof Error
      ? billingQuery.error.message
      : "Failed to load billing";
  const usageError =
    usageQuery.error instanceof Error
      ? usageQuery.error.message
      : "Failed to load usage";

  return (
    <PageWrapper
      title="Billing"
      description="Manage your subscription, usage, and billing information."
    >
      <div className="grid gap-6">
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Usage
            </Text>
            <Text variant="secondary">
              Workspace document and storage usage against plan limits.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            {usageQuery.isPending ? (
              <BillingSkeleton />
            ) : usageQuery.isError ? (
              <Text as="p" variant="error">
                {usageError}
              </Text>
            ) : usageQuery.data ? (
              <UsageCard data={usageQuery.data} />
            ) : null}
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Subscription and invoices
            </Text>
            <Text variant="secondary">
              Current plan, subscription status, and recent invoices.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            {billingQuery.isPending ? (
              <BillingSkeleton />
            ) : billingQuery.isError ? (
              <Text as="p" variant="error">
                {billingError}
              </Text>
            ) : billingQuery.data ? (
              <BillingCard data={billingQuery.data} />
            ) : null}
          </LayerCard.Primary>
        </LayerCard>
      </div>
    </PageWrapper>
  );
}
