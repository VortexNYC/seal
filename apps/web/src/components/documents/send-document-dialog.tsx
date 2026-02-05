/**
 * Send Document Dialog Component
 * SEA-119: Allows users to send documents to recipients with per-recipient custom messages
 * and optional signing deadline
 */

import { useAction, useQuery } from "convex/react";
import { addDays, format } from "date-fns";
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { getErrorMessage } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface SendDocumentDialogProps {
  slug: string;
  documentId: Id<"documents">;
  documentName: string;
  recipients: Array<{
    _id: Id<"document_recipients">;
    name?: string;
    email: string;
    role: "signer" | "viewer" | "approver";
    status: "pending" | "viewed" | "signed" | "approved" | "declined";
  }>;
  signatureFieldCount: number;
  /** Map of recipientId to field count */
  fieldCountsByRecipient?: Map<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ConnectedAccountResult = {
  status: "not_connected" | "pending" | "restricted" | "connected";
  account: {
    chargesEnabled: boolean;
  } | null;
};

export function SendDocumentDialog({
  slug,
  documentId,
  documentName,
  recipients,
  signatureFieldCount,
  fieldCountsByRecipient,
  open,
  onOpenChange,
  onSuccess,
}: SendDocumentDialogProps) {
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // SEA-119: Per-recipient messages
  const [recipientMessages, setRecipientMessages] = useState<Record<string, string>>({});
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);

  // SEA-119: Deadline picker state
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  const sendDocumentEmails = useAction(api.documents.send_document_action.sendDocumentEmails);
  const createDraftInvoice = useAction(api.stripe.invoice_actions.createDraftInvoiceForDocument);
  const deleteDraftInvoice = useAction(api.stripe.invoice_actions.deleteDraftInvoice);

  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();

  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, {
    slug,
  }) as ConnectedAccountResult | undefined;

  // Count pending recipients
  const pendingRecipients = recipients.filter(
    (r) => r.status !== "signed" && r.status !== "approved" && r.status !== "declined",
  );

  const [includeInvoice, setIncludeInvoice] = useState(false);
  const [invoiceRecipientId, setInvoiceRecipientId] = useState<string>("");
  const [invoiceDescription, setInvoiceDescription] = useState("Document service fee");
  const [invoiceAmount, setInvoiceAmount] = useState<string>("");
  const [invoicePreview, setInvoicePreview] = useState<{
    stripeInvoiceId: string;
    amountDue: number;
    currency: string;
    lines: Array<{
      id: string;
      description: string;
      quantity: number | null;
      amount: number;
      currency: string;
    }>;
  } | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  // Refs to preserve invoice ID for cleanup and track mount state
  const invoiceIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const chargesEnabled = connectedAccount?.account?.chargesEnabled ?? false;
  const canUseInvoices = isPro && connectedAccount?.status === "connected" && chargesEnabled;

  const resetInvoiceState = () => {
    setInvoicePreview(null);
    invoiceIdRef.current = null;
    setInvoiceRecipientId("");
    setInvoiceAmount("");
    setInvoiceDescription("Document service fee");
  };

  // Keep ref in sync with state
  useEffect(() => {
    invoiceIdRef.current = invoicePreview?.stripeInvoiceId ?? null;
  }, [invoicePreview?.stripeInvoiceId]);

  // Track mount state for async cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup draft invoice when dialog closes
  useEffect(() => {
    if (open) {
      return;
    }

    // Read from ref to avoid stale state in cleanup
    const invoiceIdToDelete = invoiceIdRef.current;
    if (!invoiceIdToDelete) {
      return;
    }

    // Clear ref immediately to prevent double-deletion
    invoiceIdRef.current = null;

    deleteDraftInvoice({
      documentId,
      stripeInvoiceId: invoiceIdToDelete,
    })
      .then(() => {
        if (isMountedRef.current) {
          resetInvoiceState();
        }
      })
      .catch((error) => {
        console.error("Failed to delete invoice draft on close", error);
      });
  }, [open, deleteDraftInvoice, documentId]);

  useEffect(() => {
    if (!includeInvoice || invoiceRecipientId || pendingRecipients.length === 0) {
      return;
    }
    setInvoiceRecipientId(pendingRecipients[0]?._id ?? "");
  }, [includeInvoice, invoiceRecipientId, pendingRecipients]);

  // Clear invoice preview when inputs change (invalidate stale preview)
  useEffect(() => {
    if (invoiceIdRef.current) {
      setInvoicePreview(null);
    }
  }, [invoiceAmount, invoiceDescription, invoiceRecipientId]);

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

  const handleSend = async () => {
    if (pendingRecipients.length === 0) {
      toast.error("All recipients have already completed their actions");
      return;
    }

    // SEA-119: Validate deadline is at least 24 hours in the future
    if (deadline) {
      const minDeadline = addDays(new Date(), 1);
      if (deadline < minDeadline) {
        toast.error("Deadline must be at least 24 hours from now");
        return;
      }
    }

    setIsSending(true);

    try {
      if (includeInvoice) {
        if (!invoicePreview?.stripeInvoiceId) {
          toast.error("Create an invoice preview before sending");
          setIsSending(false);
          return;
        }
      }

      // SEA-119: Build per-recipient messages array
      const perRecipientMessages = pendingRecipients
        .filter((r) => recipientMessages[r._id]?.trim())
        .map((r) => ({
          recipientId: r._id,
          message: recipientMessages[r._id].trim(),
        }));

      const result = await sendDocumentEmails({
        documentId,
        customMessage: customMessage.trim() || undefined,
        recipientMessages: perRecipientMessages.length > 0 ? perRecipientMessages : undefined,
        deadline: deadline?.getTime(),
        stripeInvoiceId: includeInvoice ? invoicePreview?.stripeInvoiceId : undefined,
      });

      if (result.success) {
        toast.success(
          `Document sent successfully to ${result.emailsSent} recipient${result.emailsSent !== 1 ? "s" : ""}`,
        );
        onSuccess?.();
        onOpenChange(false);
        // Reset state
        setCustomMessage("");
        setRecipientMessages({});
        setDeadline(undefined);
        setIncludeInvoice(false);
        resetInvoiceState();
      } else {
        toast.error(
          `Failed to send to ${result.emailsFailed} recipient${result.emailsFailed !== 1 ? "s" : ""}`,
        );
      }
    } catch (error) {
      console.error("Error sending document:", error);
      toast.error("Failed to send document", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateInvoicePreview = async () => {
    if (!includeInvoice) return;
    if (!canUseInvoices) {
      toast.error("Connect Stripe before creating invoices");
      return;
    }

    const amountCents = Math.round(Number(invoiceAmount) * 100);
    if (!invoiceAmount || Number.isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid invoice amount");
      return;
    }

    const recipient = pendingRecipients.find((r) => r._id === invoiceRecipientId);
    if (!recipient) {
      toast.error("Select a recipient for the invoice");
      return;
    }

    setIsCreatingInvoice(true);

    try {
      const preview = await createDraftInvoice({
        documentId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        description: invoiceDescription.trim() || "Document service fee",
        amountCents,
        currency: "usd",
      });
      setInvoicePreview({
        stripeInvoiceId: preview.stripeInvoiceId,
        amountDue: preview.amountDue ?? amountCents,
        currency: preview.currency ?? "usd",
        lines: preview.lines ?? [],
      });
      toast.success("Invoice preview created");
    } catch (error) {
      toast.error("Failed to create invoice preview", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleDeleteInvoicePreview = async () => {
    if (!invoicePreview?.stripeInvoiceId) {
      setInvoicePreview(null);
      return;
    }

    setIsDeletingInvoice(true);
    try {
      await deleteDraftInvoice({
        documentId,
        stripeInvoiceId: invoicePreview.stripeInvoiceId,
      });
      resetInvoiceState();
      toast.success("Invoice draft deleted");
    } catch (error) {
      toast.error("Failed to delete invoice draft", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Document</DialogTitle>
          <DialogDescription>
            Send "{documentName}" to {pendingRecipients.length} recipient
            {pendingRecipients.length !== 1 ? "s" : ""} for signing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-medium">Include Stripe invoice</Label>
                <p className="text-muted-foreground mt-1 text-xs">
                  Create a Stripe draft invoice and attach the payment link to this email.
                </p>
              </div>
              <Switch
                checked={includeInvoice}
                onCheckedChange={(checked) => {
                  setIncludeInvoice(checked);
                  if (!checked) {
                    handleDeleteInvoicePreview();
                  }
                }}
              />
            </div>

            {includeInvoice && (
              <div className="mt-4 space-y-3">
                {/* Draft invoice preview: created in Stripe before send, finalized on send */}
                {!canUseInvoices && !isLoadingPlan && (
                  <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
                    {!isPro ? (
                      <>
                        Invoices require a Pro plan.{" "}
                        <a
                          href={`/${slug}/settings/billing`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Upgrade to Pro
                        </a>{" "}
                        to accept payments through documents.
                      </>
                    ) : (
                      <>
                        Stripe must be connected and enabled for charges. Update settings in{" "}
                        <a
                          href={`/${slug}/settings/payments`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Payments
                        </a>{" "}
                        before creating invoices.
                      </>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="invoice-amount" className="text-xs">
                      Amount (USD)
                    </Label>
                    <Input
                      id="invoice-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceAmount}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      disabled={!canUseInvoices}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invoice-recipient" className="text-xs">
                      Invoice recipient
                    </Label>
                    <Select
                      value={invoiceRecipientId}
                      onValueChange={setInvoiceRecipientId}
                      disabled={!canUseInvoices}
                    >
                      <SelectTrigger id="invoice-recipient">
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingRecipients.map((recipient) => (
                          <SelectItem key={recipient._id} value={recipient._id}>
                            {recipient.name || recipient.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="invoice-description" className="text-xs">
                    Line item description
                  </Label>
                  <Input
                    id="invoice-description"
                    value={invoiceDescription}
                    onChange={(event) => setInvoiceDescription(event.target.value)}
                    disabled={!canUseInvoices}
                  />
                </div>

                <p className="text-muted-foreground text-xs">
                  The invoice link will be sent only to the selected recipient.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateInvoicePreview}
                    disabled={!canUseInvoices || isCreatingInvoice}
                  >
                    {isCreatingInvoice ? "Creating..." : "Create invoice preview"}
                  </Button>
                  {invoicePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteInvoicePreview}
                      disabled={isDeletingInvoice}
                    >
                      {isDeletingInvoice ? "Removing..." : "Discard draft"}
                    </Button>
                  )}
                </div>

                {invoicePreview && (
                  <div className="bg-muted/40 rounded-md border p-3 text-xs">
                    <p className="text-sm font-semibold">Invoice preview</p>
                    <ul className="mt-2 space-y-1">
                      {invoicePreview.lines.length > 0 ? (
                        invoicePreview.lines.map((line) => (
                          <li key={line.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{line.description}</span>
                            <span className="shrink-0">
                              {(line.amount / 100).toFixed(2)} {line.currency.toUpperCase()}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li>No line items available.</li>
                      )}
                    </ul>
                    <div className="mt-2 flex items-center justify-between border-t pt-2">
                      <span>Total due</span>
                      <span className="font-semibold">
                        {(invoicePreview.amountDue / 100).toFixed(2)}{" "}
                        {invoicePreview.currency.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEA-119: Recipients list with per-recipient message */}
          <div>
            <Label className="mb-2 text-sm font-medium">Recipients</Label>
            <div className="mt-2 space-y-2">
              {pendingRecipients.map((recipient) => (
                <Collapsible
                  key={recipient._id}
                  open={expandedRecipient === recipient._id}
                  onOpenChange={(open) => setExpandedRecipient(open ? recipient._id : null)}
                >
                  <div className="overflow-hidden rounded-md border">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="bg-muted hover:bg-muted/80 flex w-full items-center justify-between p-3 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                            {(recipient.name || recipient.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-medium">
                              {recipient.name || recipient.email}
                            </p>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              {recipient.name && (
                                <span className="max-w-[180px] truncate">{recipient.email}</span>
                              )}
                              {recipient.name && <span>•</span>}
                              <span className="shrink-0 capitalize">{recipient.role}</span>
                              {getRecipientMessage(recipient._id) && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary shrink-0">Custom message</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {fieldCountsByRecipient && (
                            <span className="bg-background rounded border px-2 py-1 text-xs font-medium">
                              {fieldCountsByRecipient.get(recipient._id) ?? 0}{" "}
                              {(fieldCountsByRecipient.get(recipient._id) ?? 0) === 1
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
                          onChange={(e) => setRecipientMessage(recipient._id, e.target.value)}
                          className="min-h-[80px]"
                          maxLength={500}
                        />
                        <p className="text-muted-foreground text-xs">
                          {getRecipientMessage(recipient._id).length}/500 characters (leave empty to
                          use default message)
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

          {/* SEA-119: Deadline picker */}
          <div>
            <Label className="text-sm font-medium">Signing Deadline (Optional)</Label>
            <p className="text-muted-foreground mb-2 text-xs">Recipients must sign by this date</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? (
                    format(deadline, "PPP")
                  ) : (
                    <span className="text-muted-foreground">No deadline set</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  disabled={(date) => date < addDays(new Date(), 1)}
                  initialFocus
                />
                {deadline && (
                  <div className="border-t p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setDeadline(undefined)}
                    >
                      Clear Deadline
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Error box - No signature fields */}
          {signatureFieldCount === 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Cannot send document without signature fields.
              </p>
              <p className="mt-1 text-xs text-red-800 dark:text-red-200">
                Please add at least one signature field before sending.
              </p>
            </div>
          )}

          {/* Info box */}
          {signatureFieldCount > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Recipients will receive an email with a link to sign the document.
                {deadline && (
                  <span className="mt-1 block">Deadline: {format(deadline, "PPP")}</span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || signatureFieldCount === 0}>
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
