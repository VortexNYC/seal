import { useQuery } from "convex/react";
import { CreditCardIcon, Loader2Icon } from "lucide-react";

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Badge } from "../../ui/badge";

interface PaymentFieldSummaryProps {
  fieldId: Id<"signature_fields">;
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

/**
 * Read-only summary of a payment field's configuration.
 * Used in the signing view to show what payment is required.
 */
export function PaymentFieldSummary({ fieldId }: PaymentFieldSummaryProps) {
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

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Payment Required</span>
        </div>
        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
          {PAYMENT_TYPE_LABELS[config.paymentType] ?? config.paymentType}
        </Badge>
      </div>

      {/* Line items */}
      <div className="space-y-1">
        {config.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-700">
              {item.description}
              {item.quantity > 1 && (
                <span className="text-muted-foreground"> x{item.quantity}</span>
              )}
            </span>
            <span className="font-medium text-gray-900">
              {formatCents(item.quantity * item.unitPrice, config.currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between border-t border-emerald-200 pt-2">
        <span className="text-sm font-semibold text-gray-900">Total</span>
        <span className="text-sm font-bold text-emerald-700">
          {formatCents(config.totalAmountCents, config.currency)}
        </span>
      </div>
    </div>
  );
}
