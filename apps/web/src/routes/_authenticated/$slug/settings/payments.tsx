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
import { betterAuthClient } from "@/lib/better-auth";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

type LegalEntityType = "INDIVIDUAL" | "CORPORATION" | "LLC" | "PARTNERSHIP";

const STANDARD_RATES: readonly { rail: string; price: string }[] = [
  { rail: "Card", price: "2.9% + 30¢" },
  { rail: "Card present", price: "2.6% + 15¢" },
  { rail: "ACH", price: "0.8% + 25¢, capped at $10" },
  { rail: "Dispute", price: "$30" },
];

const LEGAL_ENTITIES: { value: LegalEntityType; label: string }[] = [
  { value: "CORPORATION", label: "Corporation" },
  { value: "LLC", label: "LLC" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "INDIVIDUAL", label: "Individual" },
];

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")(
  {
    component: PaymentsSettings,
    pendingComponent: () => <PageFormSkeleton title="Payments" />,
  }
);

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
  const [existingMerchantId, setExistingMerchantId] = useState("");

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

  const attachExisting = useMutation({
    mutationFn: () =>
      connectPayments(slug, {
        merchantAccountId: existingMerchantId.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payments", slug] });
      toast.success("Existing Vortex merchant connected");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const account = payments.data;
  const showStandardRates = !account?.connected || Boolean(account.ratePlanId);

  return (
    <PageWrapper title="Payments">
      <SettingsBody>
        <SettingsSection
          title="Vortex"
          description={
            showStandardRates
              ? "Payments run on Vortex. This workspace inherits Vortex standard rates."
              : "Payments run on your connected Vortex merchant account at its existing Vortex rate plan."
          }
        >
          {showStandardRates ? (
            <div className="mb-4 flex flex-col gap-1">
              {STANDARD_RATES.map((rate) => (
                <Text as="p" size="sm" key={rate.rail}>
                  {rate.rail} · {rate.price}
                </Text>
              ))}
            </div>
          ) : null}
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
              <Text variant="secondary" size="sm">
                {account.chargesApproved
                  ? "Charges are enabled."
                  : "This account cannot take charges yet."}
              </Text>
              {account.claimUrl ? (
                <a href={account.claimUrl} rel="noreferrer" target="_blank">
                  Finish setup on Vortex
                </a>
              ) : null}
            </div>
          ) : null}
          {payments.isSuccess && account && !account.connected ? (
            <div className="flex max-w-md flex-col gap-6">
              {account.availableMerchants &&
              account.availableMerchants.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    Attach a Vortex merchant from your account
                  </span>
                  {account.availableMerchants.map((m) => (
                    <Button
                      key={m.merchantAccountId}
                      type="button"
                      variant="secondary"
                      disabled={attachExisting.isPending}
                      onClick={() => {
                        setExistingMerchantId(m.merchantAccountId);
                        connectPayments(slug, {
                          merchantAccountId: m.merchantAccountId,
                        })
                          .then(async () => {
                            await queryClient.invalidateQueries({
                              queryKey: ["payments", slug],
                            });
                            toast.success("Existing Vortex merchant connected");
                          })
                          .catch((err) => toast.error(getErrorMessage(err)));
                      }}
                    >
                      Connect {m.displayName} ({m.merchantAccountId} ·{" "}
                      {m.chargesApproved ? "approved" : m.status})
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="connect-vortex-oauth"
                  onClick={() => {
                    void betterAuthClient?.linkSocial({
                      provider: "vortex",
                      callbackURL: window.location.href,
                    });
                  }}
                >
                  Connect Vortex account
                </Button>
              )}
              <form
                className="flex flex-col gap-3"
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
            </div>
          ) : null}
        </SettingsSection>
      </SettingsBody>
    </PageWrapper>
  );
}
