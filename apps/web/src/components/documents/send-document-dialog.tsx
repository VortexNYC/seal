/**
 * Send Document Dialog Component
 * SEA-119: Allows users to send documents to recipients with per-recipient custom messages
 * and optional expiration period
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CreditCardIcon,
  ListOrderedIcon,
  Loader2Icon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { type DocumentDetailPaymentConfig } from "@/data/document-detail";
import { useAnalytics } from "@/hooks/use-analytics";
import { sendDocument } from "@/lib/api-client";
import { type Id } from "@/lib/ids";
import { formatMoney, money } from "@/lib/money";
import { toast } from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";

import { parseSelectValue } from "../../lib/select-values";

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
  /** Map of recipientId to field count */
  fieldCountsByRecipient?: Map<string, number>;
  paymentConfigs: DocumentDetailPaymentConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Org default deadline in days. When set, pre-populates the deadline picker. */
  defaultDeadlineDays?: number;
}

export function SendDocumentDialog({
  documentPublicId,
  documentName,
  recipients,
  signatureFieldCount,
  fieldCountsByRecipient,
  paymentConfigs,
  open,
  onOpenChange,
  onSuccess,
  defaultDeadlineDays,
  organizationSlug,
}: SendDocumentDialogProps) {
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="max-h-vh-90 flex flex-col sm:max-w-150">
        <Dialog.Title>Send for signature</Dialog.Title>
        <Dialog.Description>
          {pendingRecipients.length} recipient
          {pendingRecipients.length !== 1 ? "s" : ""} get a link for &ldquo;
          {documentName}&rdquo;. Optional extras stay under More options.
        </Dialog.Description>

        <div className="-mx-6 flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Payment Fields Summary */}
          {paymentConfigs && paymentConfigs.length > 0 && (
            <div className="border-field-payment-border bg-field-payment-surface rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="bg-field-payment-surface text-field-payment flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <CreditCardIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {paymentConfigs.length === 1
                      ? "Payment will be included"
                      : `${paymentConfigs.length} payments will be included`}
                  </p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {paymentConfigs.map((config) => (
                      <p
                        key={config.fieldId}
                        className="text-field-payment text-xs"
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
            <Label className="text-sm font-medium">Recipients</Label>
            <ul className="flex flex-col gap-1.5 rounded-md border p-3">
              {pendingRecipients.map((recipient) => (
                <li
                  key={recipient._id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {recipient.name || recipient.email}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs capitalize">
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
            <Collapsible.Trigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors">
              More options
              {showMoreOptions ? (
                <ChevronUpIcon className="size-4" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
            </Collapsible.Trigger>
            <Collapsible.Panel className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
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
                      <Collapsible.Trigger className="bg-muted hover:bg-muted/80 flex w-full items-center justify-between p-3 transition-colors">
                        <span className="truncate text-sm font-medium">
                          {recipient.name || recipient.email}
                        </span>
                        {expandedRecipient === recipient._id ? (
                          <ChevronUpIcon className="text-muted-foreground size-4" />
                        ) : (
                          <ChevronDownIcon className="text-muted-foreground size-4" />
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
                <Label htmlFor="message" className="text-sm font-medium">
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
                  <Label className="text-sm font-medium">Signing order</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSigningMode("parallel")}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors",
                        signingMode === "parallel"
                          ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                          : "hover:bg-muted"
                      )}
                    >
                      <UsersIcon className="text-muted-foreground size-4 shrink-0" />
                      <div>
                        <p className="font-medium">All at once</p>
                        <p className="text-muted-foreground text-xs">
                          Everyone signs simultaneously
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSigningMode("sequential")}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors",
                        signingMode === "sequential"
                          ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                          : "hover:bg-muted"
                      )}
                    >
                      <ListOrderedIcon className="text-muted-foreground size-4 shrink-0" />
                      <div>
                        <p className="font-medium">In order</p>
                        <p className="text-muted-foreground text-xs">
                          One {hasOrderValues ? "group" : "person"} at a time
                        </p>
                      </div>
                    </button>
                  </div>
                  {signingMode === "sequential" && (
                    <div className="mt-3 flex items-start justify-between gap-4 rounded-md border p-3">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm font-medium">
                          Signers choose next recipient
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          Allow each signer to designate who signs after them.
                        </p>
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
            <Label className="text-sm font-medium">Deadline (optional)</Label>
            <p className="text-muted-foreground mb-2 text-xs">
              How long recipients have to sign after send
            </p>
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
              <p className="text-destructive mt-1 text-sm">{expirationError}</p>
            )}
            {getExpirationText() && (
              <p className="text-muted-foreground mt-1.5 text-xs">
                {getExpirationText()}
              </p>
            )}
          </div>

          {/* Error box - No signature fields */}
          {signatureFieldCount === 0 && (
            <div className="border-destructive/30 bg-destructive/10 rounded-md border p-3">
              <p className="text-foreground text-sm font-medium">
                Cannot send document without signature fields.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Please add at least one signature field before sending.
              </p>
            </div>
          )}

          {/* Info box */}
          {signatureFieldCount > 0 && (
            <div className="border-info/30 bg-info/10 rounded-md border p-3">
              <p className="text-foreground text-sm">
                Recipients will receive an email with a link to sign the
                document.
                {getExpirationText() && (
                  <span className="mt-1 block">{getExpirationText()}</span>
                )}
              </p>
            </div>
          )}
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
            disabled={isSending || signatureFieldCount === 0}
          >
            {isSending ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendIcon className="mr-2 h-4 w-4" />
                Send Document
              </>
            )}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
