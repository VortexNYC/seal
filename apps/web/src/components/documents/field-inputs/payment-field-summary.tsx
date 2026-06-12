import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { CreditCardIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface PaymentFieldSummaryProps {
  fieldId: Id<"signature_fields">;
  /** Recipient signing token for payment authentication (signing page only) */
  token?: string;
  /** Whether to show inline payment form instead of "Pay Now" link */
  showInlinePayment?: boolean;
}

function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  installments: "Installments",
  deposit_balance: "Deposit + Balance",
};

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  created: { label: "Created", variant: "secondary" },
  awaiting: { label: "Awaiting Payment", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

/**
 * Read-only summary of a payment field's configuration.
 * Used in the signing view to show what payment is required.
 * Uses the Vortex Payments hosted collection handoff instead of mounting
 * provider card-entry SDKs in the Seal signing flow.
 */
export function PaymentFieldSummary({
  fieldId,
  token,
  showInlinePayment,
}: PaymentFieldSummaryProps) {
  const config = useQuery(api.payment_fields.queries.getPaymentConfigByField, { fieldId });

  if (config === undefined) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (config === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CreditCardIcon className="text-muted-foreground h-6 w-6" />
        <p className="text-muted-foreground text-sm">Payment not yet configured</p>
      </div>
    );
  }

  const isPayable = config.paymentStatus !== "paid" && config.paymentStatus !== "cancelled";

  return (
    <div className="border-field-payment-border bg-field-payment-surface/50 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="text-field-payment h-4 w-4" />
          <span className="text-field-payment text-sm font-semibold">Payment Required</span>
        </div>
        <Badge variant="outline" className="border-field-payment-border text-field-payment">
          {PAYMENT_TYPE_LABELS[config.paymentType] ?? config.paymentType}
        </Badge>
      </div>

      {/* Line items */}
      <div className="space-y-1">
        {config.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-foreground">
              {item.description}
              {item.quantity > 1 && (
                <span className="text-muted-foreground"> x{item.quantity}</span>
              )}
            </span>
            <span className="text-foreground font-medium">
              {formatCents(item.quantity * item.unitPrice, config.currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-field-payment-border flex justify-between border-t pt-2">
        <span className="text-foreground text-sm font-semibold">Total</span>
        <span className="text-field-payment text-sm font-bold">
          {formatCents(config.totalAmountCents, config.currency)}
        </span>
      </div>

      {/* Payment status */}
      {config.paymentStatus && (
        <div className="border-field-payment-border flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground text-xs">Status</span>
          <Badge variant={PAYMENT_STATUS_CONFIG[config.paymentStatus]?.variant ?? "secondary"}>
            {PAYMENT_STATUS_CONFIG[config.paymentStatus]?.label ?? config.paymentStatus}
          </Badge>
        </div>
      )}

      {config.hostedInvoiceUrl && isPayable && (
        <VortexPaymentCollectionHandoff
          hostedInvoiceUrl={config.hostedInvoiceUrl}
          signingMode={showInlinePayment === true && Boolean(token)}
        />
      )}
    </div>
  );
}

function VortexPaymentCollectionHandoff({
  hostedInvoiceUrl,
  signingMode,
}: {
  hostedInvoiceUrl: string;
  signingMode: boolean;
}) {
  return (
    <div className="border-field-payment-border space-y-2 border-t pt-3">
      {signingMode && (
        <p className="text-muted-foreground text-xs text-pretty">
          Payment is collected through Vortex Payments before this document can be completed.
        </p>
      )}
      <Button asChild className="bg-field-payment hover:bg-field-payment/90 w-full text-white">
        <a href={hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
          <CreditCardIcon className="size-4" />
          Pay with Vortex Payments
          <ExternalLinkIcon className="size-4" />
        </a>
      </Button>
    </div>
  );
}
