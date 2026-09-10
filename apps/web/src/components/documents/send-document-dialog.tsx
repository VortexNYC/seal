/**
 * Send Document Dialog Component
 * SEA-119: Allows users to send documents to recipients with per-recipient custom messages
 * and optional expiration period
 */

import { useMutation } from "@tanstack/react-query";
import { formatMoney, money } from "@vortexnyc/money";
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
import { toast } from "sonner";
import { z } from "zod";

import { type DocumentDetailPaymentConfig } from "@/data/document-detail";
import { sendDocument } from "@/lib/api-client";
import { type Id } from "@/lib/ids";
import { cn, getErrorMessage } from "@/lib/utils";

import { parseSelectValue } from "../../lib/select-values";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

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

const expirationSchema = z.object({
  amount: z.number().int().min(1, "Expiration period must be at least 1"),
});

interface SendDocumentDialogProps {
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
}: SendDocumentDialogProps) {
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

  // Check if any recipients have order values set (enables sequential option)
  const hasOrderValues = recipients.some(
    (r) => r.order !== undefined && r.order !== 0
  );

  const sendDocumentMutation = useMutation({
    mutationFn: (input: {
      customMessage?: string;
      recipientMessages?: Record<string, string>;
      expirationPeriod?: { amount: number; unit: "day" | "week" | "month" };
    }) => sendDocument(documentPublicId, input),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Document</DialogTitle>
          <DialogDescription>
            Send "{documentName}" to {pendingRecipients.length} recipient
            {pendingRecipients.length !== 1 ? "s" : ""} for signing.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
                  <div className="mt-1 space-y-0.5">
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

          {/* SEA-119: Recipients list with per-recipient message */}
          <div>
            <Label className="mb-2 text-sm font-medium">Recipients</Label>
            <div className="mt-2 space-y-2">
              {pendingRecipients.map((recipient) => (
                <Collapsible
                  key={recipient._id}
                  open={expandedRecipient === recipient._id}
                  onOpenChange={(isExpanded) =>
                    setExpandedRecipient(isExpanded ? recipient._id : null)
                  }
                >
                  <div className="overflow-hidden rounded-md border">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="bg-muted hover:bg-muted/80 flex w-full items-center justify-between p-3 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                            {(recipient.name ||
                              recipient.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-medium">
                              {recipient.name || recipient.email}
                            </p>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              {recipient.name && (
                                <span className="max-w-[180px] truncate">
                                  {recipient.email}
                                </span>
                              )}
                              {recipient.name && <span>•</span>}
                              <span className="shrink-0 capitalize">
                                {recipient.role}
                              </span>
                              {getRecipientMessage(recipient._id) && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary shrink-0">
                                    Custom message
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {fieldCountsByRecipient && (
                            <span className="bg-background rounded border px-2 py-1 text-xs font-medium">
                              {fieldCountsByRecipient.get(recipient._id) ?? 0}{" "}
                              {(fieldCountsByRecipient.get(recipient._id) ??
                                0) === 1
                                ? "field"
                                : "fields"}
                            </span>
                          )}
                          {expandedRecipient === recipient._id ? (
                            <ChevronUpIcon className="text-muted-foreground h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="text-muted-foreground h-4 w-4" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border-t p-3">
                        <Textarea
                          placeholder={`Custom message for ${recipient.name || recipient.email}...`}
                          value={getRecipientMessage(recipient._id)}
                          onChange={(e) =>
                            setRecipientMessage(recipient._id, e.target.value)
                          }
                          className="min-h-[80px]"
                          maxLength={500}
                        />
                        <p className="text-muted-foreground text-xs">
                          {getRecipientMessage(recipient._id).length}/500
                          characters (leave empty to use default message)
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>

          {/* Default message for all (used when no per-recipient message) */}
          <div>
            <Label htmlFor="message" className="text-sm font-medium">
              Default Message (Optional)
            </Label>
            <p className="text-muted-foreground mb-2 text-xs">
              Used for recipients without a custom message
            </p>
            <Textarea
              id="message"
              placeholder="Add a personal message for all recipients..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {customMessage.length}/500 characters
            </p>
          </div>

          {/* Signing Mode Toggle */}
          {recipients.length > 1 && (
            <div>
              <Label className="text-sm font-medium">Signing Order</Label>
              <p className="text-muted-foreground mb-2 text-xs">
                {hasOrderValues
                  ? "Recipients have order values assigned"
                  : "Choose how recipients sign the document"}
              </p>
              <div className="grid grid-cols-2 gap-2">
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
                      Sign one {hasOrderValues ? "group" : "person"} at a time
                    </p>
                  </div>
                </button>
              </div>
              {signingMode === "sequential" && !hasOrderValues && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Recipients will sign in the order listed above. To customize
                  the order, set order values on recipients before sending.
                </p>
              )}
              {signingMode === "sequential" && (
                <div className="mt-3 flex items-start justify-between gap-4 rounded-md border p-3">
                  <div className="space-y-0.5">
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
                  />
                </div>
              )}
            </div>
          )}

          {/* Expiration Period */}
          <div>
            <Label className="text-sm font-medium">Expiration (Optional)</Label>
            <p className="text-muted-foreground mb-2 text-xs">
              Set how long recipients have to sign after sending
            </p>
            <Select
              value={expirationPreset}
              onValueChange={(val) =>
                setExpirationPreset(
                  parseSelectValue(val, EXPIRATION_PRESETS) ?? expirationPreset
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No expiration</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>

            {expirationPreset === "custom" && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(Number(e.target.value));
                    if (expirationError) setExpirationError(null);
                  }}
                  className="w-24"
                />
                <Select
                  value={customUnit}
                  onValueChange={(val) =>
                    setCustomUnit(
                      parseSelectValue(val, CUSTOM_UNITS) ?? customUnit
                    )
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Days</SelectItem>
                    <SelectItem value="week">Weeks</SelectItem>
                    <SelectItem value="month">Months</SelectItem>
                  </SelectContent>
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
