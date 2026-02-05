import { useAction, useQuery } from "convex/react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CreditCardIcon,
  EyeIcon,
  HelpCircleIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { getErrorMessage } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { InputCurrency, parseCurrency } from "../ui/input-currency";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface Recipient {
  _id: Id<"document_recipients">;
  name?: string;
  email: string;
  role: "signer" | "viewer" | "approver";
  status: "pending" | "viewed" | "signed" | "approved" | "declined";
}

interface InvoiceSidebarSectionProps {
  documentId: Id<"documents">;
  slug: string;
  recipients: Recipient[];
  isOpen: boolean;
  onOpenChange: () => void;
  onInvoiceChange?: () => void;
  /** Whether the user can create/delete invoices (only in draft mode) */
  canEdit?: boolean;
}

type ConnectedAccountResult = {
  status: "not_connected" | "pending" | "restricted" | "connected";
  account: {
    chargesEnabled: boolean;
  } | null;
};

export function InvoiceSidebarSection({
  documentId,
  slug,
  recipients,
  isOpen,
  onOpenChange,
  onInvoiceChange,
  canEdit = false,
}: InvoiceSidebarSectionProps) {
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("Document service fee");
  const [invoiceRecipientId, setInvoiceRecipientId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    lines?: Array<{
      id: string;
      description: string;
      quantity: number | null;
      amount: number;
      currency: string;
    }>;
  } | null>(null);

  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();

  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, {
    slug,
  }) as ConnectedAccountResult | undefined;

  const existingInvoice = useQuery(api.stripe.invoice_queries.getInvoiceByDocument, {
    documentId,
  });

  const createDraftInvoice = useAction(api.stripe.invoice_actions.createDraftInvoiceForDocument);
  const deleteDraftInvoice = useAction(api.stripe.invoice_actions.deleteDraftInvoice);
  const getInvoicePreview = useAction(api.stripe.invoice_actions.getInvoicePreview);

  const chargesEnabled = connectedAccount?.account?.chargesEnabled ?? false;
  const canUseInvoices = isPro && connectedAccount?.status === "connected" && chargesEnabled;

  // Filter to pending recipients only (signers and approvers who haven't completed)
  const pendingRecipients = recipients.filter(
    (r) => r.status !== "signed" && r.status !== "approved" && r.status !== "declined",
  );

  // Auto-select first recipient if none selected
  if (!invoiceRecipientId && pendingRecipients.length > 0) {
    setInvoiceRecipientId(pendingRecipients[0]._id);
  }

  const handleCreateInvoice = async () => {
    if (!canUseInvoices) {
      toast.error("Connect Stripe before creating invoices");
      return;
    }

    const amount = parseCurrency(invoiceAmount);
    const amountCents = Math.round(amount * 100);
    if (!invoiceAmount || Number.isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid invoice amount");
      return;
    }

    const recipient = pendingRecipients.find((r) => r._id === invoiceRecipientId);
    if (!recipient) {
      toast.error("Select a recipient for the invoice");
      return;
    }

    setIsCreating(true);

    try {
      await createDraftInvoice({
        documentId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        description: invoiceDescription.trim() || "Document service fee",
        amountCents,
        currency: "usd",
      });
      toast.success("Draft invoice created");
      // Reset form
      setInvoiceAmount("");
      setInvoiceDescription("Document service fee");
      onInvoiceChange?.();
    } catch (error) {
      toast.error("Failed to create invoice", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!existingInvoice?.stripeInvoiceId) return;

    setIsDeleting(true);

    try {
      await deleteDraftInvoice({
        documentId,
        stripeInvoiceId: existingInvoice.stripeInvoiceId,
      });
      toast.success("Invoice draft deleted");
      onInvoiceChange?.();
    } catch (error) {
      toast.error("Failed to delete invoice", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenPreview = async () => {
    setShowPreview(true);

    // Only fetch preview data if we have a draft invoice (to get line items)
    if (existingInvoice?.stripeInvoiceId && existingInvoice.status === "draft") {
      setIsLoadingPreview(true);
      try {
        const preview = await getInvoicePreview({
          documentId,
          stripeInvoiceId: existingInvoice.stripeInvoiceId,
        });
        setPreviewData(preview);
      } catch (error) {
        console.error("Failed to load preview:", error);
        // Still show dialog with basic data
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  // Determine status for header display
  const getStatusConfig = () => {
    if (!existingInvoice) {
      return {
        bgColor: "bg-slate-100 dark:bg-slate-800",
        textColor: "text-slate-600 dark:text-slate-400",
        label: "No invoice",
        description: "No invoice has been created for this document.",
      };
    }

    switch (existingInvoice.status) {
      case "draft":
        return {
          bgColor: "bg-amber-100 dark:bg-amber-900",
          textColor: "text-amber-600 dark:text-amber-400",
          label: "Draft",
          description:
            "Invoice is saved but not yet sent. It will be finalized and sent when you send the document.",
        };
      case "open":
        return {
          bgColor: "bg-blue-100 dark:bg-blue-900",
          textColor: "text-blue-600 dark:text-blue-400",
          label: "Awaiting Payment",
          description:
            "Invoice has been sent to the recipient and is awaiting payment. The recipient can pay via the invoice link.",
        };
      case "paid":
        return {
          bgColor: "bg-emerald-100 dark:bg-emerald-900",
          textColor: "text-emerald-600 dark:text-emerald-400",
          label: "Paid",
          description: "Payment has been successfully received for this invoice.",
        };
      case "void":
        return {
          bgColor: "bg-slate-100 dark:bg-slate-800",
          textColor: "text-slate-600 dark:text-slate-400",
          label: "Voided",
          description:
            "Invoice has been voided and is no longer collectible. No payment is expected.",
        };
      case "uncollectible":
        return {
          bgColor: "bg-red-100 dark:bg-red-900",
          textColor: "text-red-600 dark:text-red-400",
          label: "Uncollectible",
          description:
            "Invoice has been marked as uncollectible. Payment attempts have failed and no further collection will be attempted.",
        };
      default:
        return {
          bgColor: "bg-slate-100 dark:bg-slate-800",
          textColor: "text-slate-600 dark:text-slate-400",
          label: existingInvoice.status,
          description: "",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <>
      <Collapsible
        open={isOpen}
        onOpenChange={onOpenChange}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-100 text-emerald-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-emerald-900 dark:text-emerald-400">
                <CreditCardIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              </div>
              <div className="text-left">
                <span className="block font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                  Invoice
                </span>
                {existingInvoice && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`font-sans text-xs ${statusConfig.textColor} flex cursor-help items-center gap-1`}
                      >
                        {existingInvoice.status === "paid" && (
                          <CheckCircleIcon className="h-3 w-3" />
                        )}
                        {statusConfig.label}
                        <HelpCircleIcon className="h-3 w-3 opacity-60" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[250px]">
                      <p className="text-xs">{statusConfig.description}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <ChevronDownIcon
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
          <div className="mt-4 space-y-4">
            {/* Not Eligible State - Only show when canEdit and no invoice exists */}
            {!existingInvoice && !canUseInvoices && !isLoadingPlan && canEdit && (
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

            {/* Draft Invoice State - Show details and delete option (only if canEdit) */}
            {existingInvoice && existingInvoice.status === "draft" && (
              <div className="space-y-3">
                <div className="bg-muted/40 rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Draft Invoice</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {(existingInvoice.amountDue / 100).toFixed(2)}{" "}
                        {existingInvoice.currency.toUpperCase()}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        To: {existingInvoice.customerEmail}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={handleOpenPreview}>
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Preview invoice</TooltipContent>
                      </Tooltip>
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleDeleteInvoice}
                              disabled={isDeleting}
                              className="text-destructive hover:text-destructive"
                            >
                              {isDeleting ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2Icon className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete invoice</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <p className="text-muted-foreground text-xs">
                    This invoice will be sent when you send the document.
                  </p>
                )}
              </div>
            )}

            {/* Finalized Invoice State - Read-only status (open, paid, void, uncollectible) */}
            {existingInvoice &&
              (existingInvoice.status === "open" ||
                existingInvoice.status === "paid" ||
                existingInvoice.status === "void" ||
                existingInvoice.status === "uncollectible") && (
                <div className="bg-muted/40 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    {existingInvoice.status === "paid" && (
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {existingInvoice.status === "paid"
                            ? "Invoice Paid"
                            : existingInvoice.status === "open"
                              ? "Invoice Sent"
                              : existingInvoice.status === "void"
                                ? "Invoice Voided"
                                : "Invoice Uncollectible"}
                        </p>
                        {existingInvoice.status === "open" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex cursor-help items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                Awaiting Payment
                                <HelpCircleIcon className="h-2.5 w-2.5 opacity-60" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">{statusConfig.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {(existingInvoice.amountDue / 100).toFixed(2)}{" "}
                        {existingInvoice.currency.toUpperCase()} - {existingInvoice.customerEmail}
                      </p>
                      {existingInvoice.hostedInvoiceUrl && existingInvoice.status !== "void" && (
                        <a
                          href={existingInvoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary mt-1 block text-xs underline-offset-2 hover:underline"
                        >
                          View invoice
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* No Invoice State - Show creation form (only if canEdit and has recipients) */}
            {!existingInvoice && canUseInvoices && canEdit && pendingRecipients.length > 0 && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="invoice-amount" className="text-xs">
                      Amount (USD)
                    </Label>
                    <InputCurrency
                      id="invoice-amount"
                      value={invoiceAmount}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      placeholder="$0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invoice-recipient" className="text-xs">
                      Invoice recipient
                    </Label>
                    <Select value={invoiceRecipientId} onValueChange={setInvoiceRecipientId}>
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
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateInvoice}
                  disabled={isCreating || !invoiceAmount || !invoiceRecipientId}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Draft Invoice"
                  )}
                </Button>
              </div>
            )}

            {/* No Recipients State - Show message to add recipients first */}
            {!existingInvoice && canUseInvoices && canEdit && pendingRecipients.length === 0 && (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                  <CreditCardIcon className="h-6 w-6" />
                </div>
                <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                  Add a recipient first
                </div>
                <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                  You need to add at least one recipient before creating an invoice.
                </div>
              </div>
            )}

            {/* Read-only empty state when no invoice and not in edit mode */}
            {!existingInvoice && !canEdit && (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                  <CreditCardIcon className="h-6 w-6" />
                </div>
                <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                  No invoice
                </div>
                <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                  No invoice was attached to this document.
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Invoice Preview Dialog */}
      {existingInvoice && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Invoice Preview
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    existingInvoice.status === "draft"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : existingInvoice.status === "paid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : existingInvoice.status === "open"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {existingInvoice.status}
                </span>
              </DialogTitle>
              <DialogDescription>
                {existingInvoice.status === "draft"
                  ? "This invoice will be finalized and sent when you send the document."
                  : existingInvoice.status === "open"
                    ? "This invoice has been sent and is awaiting payment."
                    : existingInvoice.status === "paid"
                      ? "This invoice has been paid."
                      : "Invoice details"}
              </DialogDescription>
            </DialogHeader>

            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {/* Bill To Section */}
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                    Bill To
                  </p>
                  <p className="text-sm font-medium">
                    {existingInvoice.customerName || existingInvoice.customerEmail}
                  </p>
                  {existingInvoice.customerName && (
                    <p className="text-muted-foreground text-sm">{existingInvoice.customerEmail}</p>
                  )}
                </div>

                {/* Line Items */}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                    Line Items
                  </p>
                  <div className="rounded-lg border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                            Description
                          </th>
                          <th className="text-muted-foreground px-4 py-2 text-right text-xs font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData?.lines && previewData.lines.length > 0 ? (
                          previewData.lines.map((line) => (
                            <tr key={line.id} className="border-b last:border-0">
                              <td className="px-4 py-3 text-sm">{line.description || "—"}</td>
                              <td className="px-4 py-3 text-right text-sm font-medium">
                                {(line.amount / 100).toFixed(2)} {line.currency.toUpperCase()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-b last:border-0">
                            <td className="px-4 py-3 text-sm">Document service fee</td>
                            <td className="px-4 py-3 text-right text-sm font-medium">
                              {(existingInvoice.amountDue / 100).toFixed(2)}{" "}
                              {existingInvoice.currency.toUpperCase()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50">
                          <td className="px-4 py-3 text-sm font-semibold">Total</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold">
                            {(existingInvoice.amountDue / 100).toFixed(2)}{" "}
                            {existingInvoice.currency.toUpperCase()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Invoice ID */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Invoice ID</span>
                  <span className="text-muted-foreground font-mono">
                    {existingInvoice.stripeInvoiceId}
                  </span>
                </div>

                {/* View on Stripe link for finalized invoices */}
                {existingInvoice.hostedInvoiceUrl && (
                  <div className="border-t pt-4">
                    <a
                      href={existingInvoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary flex items-center justify-center gap-2 text-sm font-medium underline-offset-2 hover:underline"
                    >
                      <CreditCardIcon className="h-4 w-4" />
                      View full invoice on Stripe
                    </a>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
