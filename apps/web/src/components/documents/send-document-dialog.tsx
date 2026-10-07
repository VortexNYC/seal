/**
 * Send Document Dialog Component
 * SEA-119: Allows users to send documents to recipients with per-recipient custom messages
 * and optional expiration period
 */

import { Banner } from "@cloudflare/kumo/components/banner";
import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { CaretDown as ChevronDownIcon, CaretUp as ChevronUpIcon, CreditCard as CreditCardIcon, PaperPlaneTilt as SendIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { z } from "zod";

import { type DocumentDetailPaymentConfig } from "@/data/document-detail";
import { useAnalytics } from "@/hooks/use-analytics";
import { sendDocument } from "@/lib/api-client";
import { type Id } from "@/lib/ids";
import { formatMoney, money } from "@/lib/money";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

import { parseSelectValue } from "../../lib/select-values";
import { RailBack } from "./rail-back";

type ExpirationPreset = "none" | "7" | "14" | "30" | "60" | "90" | "custom";
type CustomUnit = "day" | "week" | "month";

const EXPIRATION_PRESETS = [
  "none",
  "7",
  "14",
  "30",
  "60",
  "90",
  "custom",
] as const satisfies readonly ExpirationPreset[];
const CUSTOM_UNITS = [
  "day",
  "week",
  "month",
] as const satisfies readonly CustomUnit[];

const EXPIRATION_LABELS: Record<ExpirationPreset, string> = {
  none: "No expiration",
  7: "7 days",
  14: "14 days",
  30: "30 days",
  60: "60 days",
  90: "90 days",
  custom: "Custom...",
};

const CUSTOM_UNIT_LABELS: Record<CustomUnit, string> = {
  day: "Days",
  week: "Weeks",
  month: "Months",
};

const expirationSchema = z.object({
  amount: z.number().int().min(1, "Expiration period must be at least 1"),
});

interface SendDocumentDialogProps {
  organizationSlug: string;
  documentPublicId: string;
  documentName: string;
  recipients: Array<{
    _id: Id<"document_recipients">;
    publicId: string;
    name?: string;
    email: string;
    role: "signer" | "viewer" | "approver";
    status:
      | "pending"
      | "viewed"
      | "signed"
      | "approved"
      | "declined"
      | "expired";
    order?: number;
  }>;
  signatureFieldCount: number;
  /** Signers need a signature or initials field. Approver-only documents do not. */
  requiresSigningField?: boolean;
  /** Map of recipientId to field count */
  fieldCountsByRecipient?: Map<string, number>;
  paymentConfigs: DocumentDetailPaymentConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Org default deadline in days. When set, pre-populates the deadline picker. */
  defaultDeadlineDays?: number;
  presentation?: "dialog" | "panel";
}

export function SendDocumentDialog({
  documentPublicId,
  documentName,
  recipients,
  signatureFieldCount,
  requiresSigningField = true,
  fieldCountsByRecipient,
  paymentConfigs,
  open,
  onOpenChange,
  onSuccess,
  defaultDeadlineDays,
  organizationSlug,
  presentation = "dialog",
}: SendDocumentDialogProps) {
  const missingSigningField = requiresSigningField && signatureFieldCount === 0;
  const { track } = useAnalytics();
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // SEA-119: Per-recipient messages
  const [recipientMessages, setRecipientMessages] = useState<
    Record<string, string>
  >({});
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(
    null
  );

  // SEA-119: Expiration period state — pre-populate from org default if set
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>(
    defaultDeadlineDays
      ? (parseSelectValue(String(defaultDeadlineDays), EXPIRATION_PRESETS) ??
          "custom")
      : "none"
  );
  const [customAmount, setCustomAmount] = useState(defaultDeadlineDays ?? 30);
  const [customUnit, setCustomUnit] = useState<CustomUnit>("day");

  // Signing mode: parallel (all at once) or sequential (by order groups)
  const [signingMode, setSigningMode] = useState<"parallel" | "sequential">(
    "parallel"
  );
  const [allowDictateNextSigner, setAllowDictateNextSigner] = useState(false);
  const [expirationError, setExpirationError] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Check if any recipients have order values set (enables sequential option)
  const hasOrderValues = recipients.some(
    (r) => r.order !== undefined && r.order !== 0
  );

  const sendDocumentMutation = useMutation({
    mutationFn: (input: {
      customMessage?: string;
      recipientMessages?: Record<string, string>;
      expirationPeriod?: { amount: number; unit: "day" | "week" | "month" };
      signingMode?: "parallel" | "sequential";
      allowDictateNextSigner?: boolean;
    }) => sendDocument(organizationSlug, documentPublicId, input),
  });

  // Count pending recipients
  const pendingRecipients = recipients.filter(
    (r) =>
      r.status !== "signed" &&
      r.status !== "approved" &&
      r.status !== "declined"
  );

  // SEA-119: Get message for a specific recipient
  const getRecipientMessage = (recipientId: string) => {
    return recipientMessages[recipientId] ?? "";
  };

  // SEA-119: Set message for a specific recipient
  const setRecipientMessage = (recipientId: string, message: string) => {
    setRecipientMessages((prev) => ({
      ...prev,
      [recipientId]: message,
    }));
  };

  const getExpirationPeriod = () => {
    if (expirationPreset === "none") return undefined;
    if (expirationPreset === "custom") {
      return { amount: customAmount, unit: customUnit };
    }
    return { amount: Number(expirationPreset), unit: "day" as const };
  };

  const getExpirationText = () => {
    const period = getExpirationPeriod();
    if (!period) return null;
    const { amount, unit } = period;
    const unitLabel = amount === 1 ? unit : `${unit}s`;
    return `Recipients will have ${amount} ${unitLabel} to sign after the document is sent`;
  };

  const handleSend = async () => {
    if (pendingRecipients.length === 0) {
      toast.error("All recipients have already completed their actions");
      return;
    }

    // SEA-119: Validate expiration period
    const expirationPeriod = getExpirationPeriod();
    if (expirationPeriod) {
      const validation = expirationSchema.safeParse({
        amount: expirationPeriod.amount,
      });
      if (!validation.success) {
        setExpirationError(validation.error.issues[0].message);
        return;
      }
      setExpirationError(null);
    }

    setIsSending(true);

    try {
      // SEA-119: Build per-recipient messages map
      const perRecipientMessages = Object.fromEntries(
        pendingRecipients
          .filter((r) => recipientMessages[r._id]?.trim())
          .map((r) => [r.publicId, recipientMessages[r._id].trim()])
      );

      await sendDocumentMutation.mutateAsync({
        customMessage: customMessage.trim() || undefined,
        recipientMessages:
          Object.keys(perRecipientMessages).length > 0
            ? perRecipientMessages
            : undefined,
        expirationPeriod,
        signingMode,
        allowDictateNextSigner,
      });

      track.documentSent({ documentId: documentPublicId });

      const emailsSent = pendingRecipients.length;
      toast.success(
        `Document sent successfully to ${emailsSent} recipient${emailsSent !== 1 ? "s" : ""}`
      );
      onSuccess?.();
      onOpenChange(false);
      // Reset state
      setCustomMessage("");
      setRecipientMessages({});
      setExpirationPreset("none");
      setCustomAmount(defaultDeadlineDays ?? 30);
      setCustomUnit("day");
      setSigningMode("parallel");
      setAllowDictateNextSigner(false);
    } catch (error) {
      toast.error("Failed to send document", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSending(false);
    }
  };

  const sendDescription = `${pendingRecipients.length} recipient${
    pendingRecipients.length === 1 ? "" : "s"
  } get a link for “${documentName}”. Optional extras stay under More options.`;

  const sendBody = (
    <>

        <div className="-mx-6 flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Payment Fields Summary */}
          {paymentConfigs && paymentConfigs.length > 0 && (
            <div className="border-kumo-info bg-kumo-info-tint rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="bg-kumo-info-tint text-kumo-info flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <CreditCardIcon className="h-4 w-4" />
                </div>
                <div>
                  <Text as="p" size="sm" bold>{paymentConfigs.length === 1
                      ? "Payment will be included"
                      : `${paymentConfigs.length} payments will be included`}</Text>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {paymentConfigs.map((config) => (
                      <p
                        key={config.fieldId}
                        className="text-kumo-info text-xs"
                      >
                        {formatMoney(
                          money(
                            config.totalAmountCents,
                            config.currency.toUpperCase()
                          )
                        )}{" "}
                        {config.currency.toUpperCase()}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Recipients</Label>
            <ul className="flex flex-col gap-1.5 rounded-md border p-3">
              {pendingRecipients.map((recipient) => (
                <li
                  key={recipient._id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {recipient.name || recipient.email}
                  </span>
                  <span className="text-kumo-secondary shrink-0 text-xs capitalize">
                    {recipient.role}
                    {fieldCountsByRecipient
                      ? `· ${fieldCountsByRecipient.get(recipient._id) ?? 0} fields`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Collapsible.Root
            open={showMoreOptions}
            onOpenChange={setShowMoreOptions}
          >
            <Collapsible.Trigger className="flex w-full items-center justify-between">
              More options
              {showMoreOptions ? (
                <ChevronUpIcon className="size-4" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
            </Collapsible.Trigger>
            <Collapsible.Panel className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>
                  Per-recipient messages
                </Label>
                {pendingRecipients.map((recipient) => (
                  <Collapsible.Root
                    key={recipient._id}
                    open={expandedRecipient === recipient._id}
                    onOpenChange={(isExpanded) =>
                      setExpandedRecipient(isExpanded ? recipient._id : null)
                    }
                  >
                    <div className="overflow-hidden rounded-md border">
                      <Collapsible.Trigger className="flex w-full items-center justify-between p-3">
                        <span className="truncate text-sm font-medium">
                          {recipient.name || recipient.email}
                        </span>
                        {expandedRecipient === recipient._id ? (
                          <ChevronUpIcon className="text-kumo-secondary size-4" />
                        ) : (
                          <ChevronDownIcon className="text-kumo-secondary size-4" />
                        )}
                      </Collapsible.Trigger>
                      <Collapsible.Panel>
                        <div className="flex flex-col gap-2 border-t p-3">
                          <Textarea
                            placeholder={`Custom message for ${recipient.name || recipient.email}...`}
                            value={getRecipientMessage(recipient._id)}
                            onChange={(e) =>
                              setRecipientMessage(recipient._id, e.target.value)
                            }
                            className="min-h-20"
                            maxLength={500}
                            aria-label="Custom message"
                          />
                        </div>
                      </Collapsible.Panel>
                    </div>
                  </Collapsible.Root>
                ))}
              </div>

              <div>
                <Label htmlFor="message">
                  Default message (optional)
                </Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message for all recipients..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="mt-2 min-h-20"
                  maxLength={500}
                  aria-label="Default message"
                />
              </div>

              {recipients.length > 1 && (
                <div>
                  <Label>Signing order</Label>
                  <div className="mt-2">
                    <Tabs
                      variant="segmented"
                      value={signingMode}
                      onValueChange={(value) => {
                        if (value === "parallel" || value === "sequential") {
                          setSigningMode(value);
                        }
                      }}
                      tabs={[
                        { value: "parallel", label: "All at once" },
                        {
                          value: "sequential",
                          label: hasOrderValues
                            ? "In order, one group at a time"
                            : "In order, one person at a time",
                        },
                      ]}
                    />
                  </div>
                  {signingMode === "sequential" && (
                    <div className="mt-3 flex items-start justify-between gap-4 rounded-md border p-3">
                      <div className="flex flex-col gap-0.5">
                        <Label>
                          Signers choose next recipient
                        </Label>
                        <Text as="p" variant="secondary" size="xs">Allow each signer to designate who signs after them.</Text>
                      </div>
                      <Switch
                        checked={allowDictateNextSigner}
                        onCheckedChange={setAllowDictateNextSigner}
                        aria-label="Signers choose next recipient"
                      />
                    </div>
                  )}
                </div>
              )}
            </Collapsible.Panel>
          </Collapsible.Root>

          {/* Expiration Period */}
          <div>
            <Label>Deadline (optional)</Label>
            <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mb-2">How long recipients have to sign after send</Text>
            <Select
              value={expirationPreset}
              onValueChange={(val) => {
                if (!val) return;
                setExpirationPreset(
                  parseSelectValue(val, EXPIRATION_PRESETS) ?? expirationPreset
                );
              }}
              renderValue={(value) =>
                EXPIRATION_LABELS[value as ExpirationPreset]
              }
            >
              <Select.Option value="none">No expiration</Select.Option>
              <Select.Option value="7">7 days</Select.Option>
              <Select.Option value="14">14 days</Select.Option>
              <Select.Option value="30">30 days</Select.Option>
              <Select.Option value="60">60 days</Select.Option>
              <Select.Option value="90">90 days</Select.Option>
              <Select.Option value="custom">Custom...</Select.Option>
            </Select>

            {expirationPreset === "custom" && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={String(customAmount)}
                  onChange={(e) => {
                    setCustomAmount(Number(e.target.value));
                    if (expirationError) setExpirationError(null);
                  }}
                  className="w-24"
                  aria-label="Custom expiration amount"
                />
                <Select
                  value={customUnit}
                  onValueChange={(val) => {
                    if (!val) return;
                    setCustomUnit(
                      parseSelectValue(val, CUSTOM_UNITS) ?? customUnit
                    );
                  }}
                  renderValue={(value) =>
                    CUSTOM_UNIT_LABELS[value as CustomUnit]
                  }
                  className="w-32"
                >
                  <Select.Option value="day">Days</Select.Option>
                  <Select.Option value="week">Weeks</Select.Option>
                  <Select.Option value="month">Months</Select.Option>
                </Select>
              </div>
            )}

            {expirationError && (
              <Text as="p" variant="error" size="sm" DANGEROUS_className="mt-1">{expirationError}</Text>
            )}
            {getExpirationText() && (
              <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mt-1.5">{getExpirationText()}</Text>
            )}
          </div>

          {/* Error box - No signature fields */}
          {missingSigningField ? (
            <Banner
              variant="error"
              size="sm"
              title="Cannot send document without signature fields."
              description="Add a signature or initials field before sending."
            />
          ) : null}

          {/* Info box */}
          {!missingSigningField ? (
            <Banner
              size="sm"
              description={
                getExpirationText()
                  ? `Recipients will receive an email with a link to sign the document. ${getExpirationText()}`
                  : "Recipients will receive an email with a link to sign the document."
              }
            />
          ) : null}
        </div>

        <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSend}
            disabled={isSending || missingSigningField}
            loading={isSending}
            icon={SendIcon}
          >
            {isSending ? "Sending..." : "Send Document"}
          </Button>
        </div>
    </>
  );

  if (presentation === "panel") {
    if (!open) return null;
    return (
      <div data-testid="send-document-panel" className="flex flex-col gap-3">
        <RailBack onBack={() => onOpenChange(false)} tip="Back to the document" />
        <div>
          <Text as="p" size="sm" bold>
            Send for signature
          </Text>
          <Text as="p" variant="secondary" size="xs">
            {sendDescription}
          </Text>
        </div>
        {sendBody}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="xl" className="flex max-h-vh-90 flex-col">
        <Dialog.Title>Send for signature</Dialog.Title>
        <Dialog.Description>{sendDescription}</Dialog.Description>
        {sendBody}
      </Dialog>
    </Dialog.Root>
  );
}
