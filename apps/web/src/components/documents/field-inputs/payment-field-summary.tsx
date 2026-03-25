import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { CreditCardIcon, Loader2Icon } from "lucide-react";

import { Badge } from "../../ui/badge";
import { PaymentFieldInline } from "./payment-field-inline";

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
 * When `showInlinePayment` is true and a `token` is provided,
 * renders an inline PaymentElement instead of the "Pay Now" link.
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

      {/* Inline payment form (when on signing page with active payment) */}
      {showInlinePayment && token && isPayable && (
        <PaymentFieldInline
          configId={config._id}
          token={token}
          totalAmountCents={config.totalAmountCents}
          currency={config.currency}
        />
      )}

      {/* Fallback: Pay Now link (when inline is not available) */}
      {!showInlinePayment && config.hostedInvoiceUrl && isPayable && (
        <a
          href={config.hostedInvoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-field-payment hover:bg-field-payment/90 mt-1 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Pay Now &rarr;
        </a>
      )}
    </div>
  );
}
