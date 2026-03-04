import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { type Stripe as StripeType, loadStripe } from "@stripe/stripe-js";
import { useAction } from "convex/react";
import { CreditCardIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

interface PaymentFieldInlineProps {
  configId: Id<"payment_field_configs">;
  token: string;
  totalAmountCents: number;
  currency: string;
}

/**
 * Inline payment form using Stripe PaymentElement.
 * Fetches client_secret on-demand via getPaymentSecret action (token-authenticated).
 */
export function PaymentFieldInline({
  configId,
  token,
  totalAmountCents,
  currency,
}: PaymentFieldInlineProps) {
  const getPaymentSecret = useAction(api.stripe.payment_field_actions.getPaymentSecret);
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchSecret() {
      try {
        const result = await getPaymentSecret({ token, configId });
        setClientSecret(result.clientSecret);
        setStripePromise(
          loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string, {
            stripeAccount: result.stripeAccountId,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment form");
      } finally {
        setLoading(false);
      }
    }
    fetchSecret();
  }, [getPaymentSecret, token, configId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading payment form...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!clientSecret || !stripePromise) {
    return null;
  }

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalAmountCents / 100);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            borderRadius: "8px",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
        },
      }}
    >
      <PaymentForm amount={formattedAmount} />
    </Elements>
  );
}

function PaymentForm({ amount }: { amount: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      setIsSubmitting(true);
      try {
        const { error: stripeError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href,
          },
          redirect: "if_required",
        });

        if (stripeError) {
          toast.error(stripeError.message ?? "Payment failed");
        } else {
          toast.success("Payment successful!");
        }
      } catch (err) {
        toast.error("An unexpected error occurred");
        console.error("Payment error:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [stripe, elements],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || !elements || isSubmitting}
        className="bg-field-payment hover:bg-field-payment/90 w-full text-white"
      >
        {isSubmitting ? (
          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCardIcon className="mr-2 h-4 w-4" />
        )}
        {isSubmitting ? "Processing..." : `Pay ${amount}`}
      </Button>
    </form>
  );
}
