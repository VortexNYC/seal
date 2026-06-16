export const VORTEX_PAYMENTS_CONSUMER_CONTRACT = {
  packageName: "@vortex/payments",
  visibility: "internal",
  productName: "Vortex Payments",
  rules: [
    "Consumers import payment and billing surfaces from @vortex/payments entrypoints.",
    "Consumers must not import app-local Convex/backend modules to render payment or billing surfaces.",
    "Consumers must not treat processor ids as active product state.",
    "Billing remains an internal domain inside the Vortex Payments product boundary.",
  ],
} as const;

export type VortexPaymentsConsumerContract = typeof VORTEX_PAYMENTS_CONSUMER_CONTRACT;
