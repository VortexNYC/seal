import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { CreditCard as CreditCardIcon } from "@phosphor-icons/react";

interface PaymentFieldSummaryProps {
  fieldId: string;
  token?: string;
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
    <LayerCard className="flex flex-col items-center gap-3 p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <CreditCardIcon className="size-4" />
        <Text size="sm">Payment collection</Text>
      </div>
      <Text variant="secondary" size="sm">
        Payment fields are managed in Vortex Payments. The summary will be
        restored once payment data is available.
      </Text>
    </LayerCard>
  );
}
