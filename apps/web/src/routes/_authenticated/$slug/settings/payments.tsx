/**
 * Workspace payments. Vortex is the processor. Seal stores the connected account.
 * Route: /{slug}/settings/payments
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Text } from "@cloudflare/kumo/components/text";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { connectPayments, getPaymentsConnect } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

type LegalEntityType = "INDIVIDUAL" | "CORPORATION" | "LLC" | "PARTNERSHIP";

const LEGAL_ENTITIES: { value: LegalEntityType; label: string }[] = [
  { value: "CORPORATION", label: "Corporation" },
  { value: "LLC", label: "LLC" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "INDIVIDUAL", label: "Individual" },
];

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")({
  component: PaymentsSettings,
  pendingComponent: () => <PageFormSkeleton title="Payments" />,
});

function PaymentsSettings() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["payments", slug],
    queryFn: () => getPaymentsConnect(slug),
  });
  const [displayName, setDisplayName] = useState<string | null>(null);
  const legalName = displayName ?? organization?.name ?? "";
  const [legalEntityType, setLegalEntityType] =
    useState<LegalEntityType>("CORPORATION");
  const [country, setCountry] = useState("USA");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  const connect = useMutation({
    mutationFn: () =>
      connectPayments(slug, {
        displayName: legalName.trim(),
        legalEntityType,
        country: country.trim(),
        defaultCurrency: defaultCurrency.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payments", slug] });
      toast.success("Connected account created");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const account = payments.data;

  return (
    <PageWrapper title="Payments">
      <SettingsBody>
        <SettingsSection
          title="Vortex"
          description="Payments run on Vortex. Seal keeps the connected account for this workspace."
        >
          {payments.isPending ? (
            <Text variant="secondary" size="sm">
              Loading
            </Text>
          ) : null}
          {payments.isError ? (
            <Text variant="secondary" size="sm">
              {getErrorMessage(payments.error)}
            </Text>
          ) : null}
          {account?.connected ? (
            <div className="flex flex-col gap-2">
              <Text size="sm">
                {account.status ?? "draft"} · {account.merchantAccountId}
              </Text>
              <Text variant="secondary" size="sm">
                {account.summary}
              </Text>
              {account.claimUrl ? (
                <a href={account.claimUrl} rel="noreferrer" target="_blank">
                  Finish setup on Vortex
                </a>
              ) : null}
            </div>
          ) : null}
          {payments.isSuccess && account && !account.connected ? (
            <form
              className="flex max-w-md flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                connect.mutate();
              }}
            >
              <Input
                label="Legal name"
                value={legalName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Legal entity</span>
                <Select
                  value={legalEntityType}
                  onValueChange={(value) => {
                    if (
                      value === "INDIVIDUAL" ||
                      value === "CORPORATION" ||
                      value === "LLC" ||
                      value === "PARTNERSHIP"
                    ) {
                      setLegalEntityType(value);
                    }
                  }}
                >
                  {LEGAL_ENTITIES.map((entity) => (
                    <Select.Option key={entity.value} value={entity.value}>
                      {entity.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <Input
                label="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
              <Input
                label="Currency"
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
              />
              <Button
                type="submit"
                disabled={connect.isPending || legalName.trim().length === 0}
              >
                {connect.isPending ? "Creating…" : "Create connected account"}
              </Button>
            </form>
          ) : null}
        </SettingsSection>
      </SettingsBody>
    </PageWrapper>
  );
}
