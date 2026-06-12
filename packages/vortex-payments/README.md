# Vortex Payments

Vortex Payments is the internal product package for Vortex-owned payment, billing, merchant, and operator surfaces.

This package is intentionally private while Vortex validates Seal, Aqua, Plasma, and other internal consumers. The package shape is external-ready, but publication is not allowed until the service is ready to be sold.

## Package Boundary

- `@vortex/payments/react` is the web consumer surface.
- `@vortex/payments/react-native` is the future native consumer surface.
- `@vortex/payments/surfaces` is the framework-neutral hosted and embedded surface contract.
- `@vortex/payments/testing` is the package-boundary inspection surface.
- `@vortex/payments/consumer-contract` is the adoption rule surface.

`@vortex/billing` remains a domain package. It owns invoices, subscriptions, receipts, dunning, and customer billing state. Vortex Payments is the product boundary consumers should see.
