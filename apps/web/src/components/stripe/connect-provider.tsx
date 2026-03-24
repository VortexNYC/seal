/**
 * Stripe Connect Provider
 *
 * Reusable wrapper that initializes a Stripe Connect instance and provides it
 * to embedded components (AccountOnboarding, AccountManagement, NotificationBanner).
 *
 * Features:
 * - Single initialization with useRef guard (safe in StrictMode)
 * - Dynamic theme updates when dark/light mode changes
 * - Automatic session refresh via fetchClientSecret callback
 * - Loading skeleton and error states
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { useAction } from "convex/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { getStripeConnectAppearance } from "@/lib/stripe-theme";
import { cn } from "@/lib/utils";

interface StripeConnectProviderProps {
  organizationId: Id<"organizations">;
  children: ReactNode;
  className?: string;
}

export function StripeConnectProvider({
  organizationId,
  children,
  className,
}: StripeConnectProviderProps) {
  const { resolvedTheme } = useTheme();
  const createAccountSession = useAction(api.stripe.connect_actions.createAccountSession);

  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(
    null,
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard against re-initialization (React StrictMode double-invokes effects)
  const hasInitialized = useRef(false);
  const instanceRef = useRef<StripeConnectInstance | null>(null);

  const isDark = resolvedTheme === "dark";

  // Stripe calls this on init AND when the session expires (automatic refresh)
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { clientSecret } = await createAccountSession({ organizationId });
    return clientSecret;
  }, [createAccountSession, organizationId]);

  // Initialize Stripe Connect (only once)
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    const initializeConnect = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;
        if (!publishableKey) {
          throw new Error("VITE_STRIPE_PUBLISHABLE_KEY is not configured");
        }

        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret,
          appearance: getStripeConnectAppearance(isDark),
        });

        instanceRef.current = instance;
        setStripeConnectInstance(instance);
        hasInitialized.current = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize Stripe Connect";
        setError(message);
        console.error("Stripe Connect initialization failed:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeConnect();
  }, [fetchClientSecret, isDark]);

  // Update appearance when theme changes (after initialization)
  useEffect(() => {
    if (instanceRef.current && hasInitialized.current) {
      instanceRef.current.update({
        appearance: getStripeConnectAppearance(isDark),
      });
    }
  }, [isDark]);

  if (isInitializing) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-muted h-6 w-48 rounded-md" />
            <div className="bg-muted h-9 w-24 rounded-md" />
          </div>
          <div className="border-border flex gap-4 border-b pb-3">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-4 w-32 rounded" />
            <div className="bg-muted h-4 w-20 rounded" />
            <div className="bg-muted h-4 flex-1 rounded" />
          </div>
          {[1, 2, 3].map((i) => (
            <div className="flex gap-4 py-3" key={i}>
              <div className="bg-muted h-4 w-24 rounded" />
              <div className="bg-muted h-4 w-32 rounded" />
              <div className="bg-muted h-4 w-20 rounded" />
              <div className="bg-muted h-4 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn("border-destructive/30 bg-destructive/10 rounded-md border p-4", className)}
      >
        <p className="text-destructive text-sm font-medium">Failed to load Stripe components</p>
        <p className="text-muted-foreground mt-1 text-xs">{error}</p>
      </div>
    );
  }

  if (!stripeConnectInstance) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        {children}
      </ConnectComponentsProvider>
    </div>
  );
}
