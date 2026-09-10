import { CreditCardIcon } from "lucide-react";

interface PaymentFieldSummaryProps {
  fieldId: string;
  /** Recipient signing token for payment authentication (signing page only) */
  token?: string;
  /** Whether to show inline payment form instead of "Pay Now" link */
  showInlinePayment?: boolean;
}

/**
 * Read-only summary of a payment field's configuration.
 * Payment collection is managed in Vortex Payments; this summary will be
 * restored once the payment field data is available through the Worker backend.
 */
export function PaymentFieldSummary({
  fieldId,
  token,
  showInlinePayment,
}: PaymentFieldSummaryProps) {
  void fieldId;
  void token;
  void showInlinePayment;

  return (
    <div className="border-field-payment-border bg-field-payment-surface/50 space-y-3 rounded-lg border p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <CreditCardIcon className="text-field-payment h-4 w-4" />
        <span className="text-field-payment text-sm font-semibold">
          Payment collection
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        Payment fields are managed in Vortex Payments. The summary will be
        restored once payment data is available.
      </p>
    </div>
  );
}
