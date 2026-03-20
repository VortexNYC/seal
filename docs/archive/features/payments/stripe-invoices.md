# Stripe Invoices (Payment Field System)

This doc describes the Stripe-native payment flow used when sending documents with payment fields. It relies on Stripe Invoicing, Subscriptions, and Subscription Schedules via Stripe Connect.

## Goals

- Use Stripe Connect accounts for payments between document senders and recipients.
- Create per-recipient, per-field invoices (or subscriptions) with line items configured in the document editor.
- Finalize invoices on send to obtain hosted invoice URLs for email inclusion.
- Track payment status via Stripe webhooks updating `payment_field_configs`.

## Architecture

The system uses a single source of truth: `payment_field_configs`. Each payment field on a document gets its own config row, which stores both the payment configuration (items, terms, methods) and the Stripe state (invoice ID, subscription ID, payment status).

```
Document Editor          Send Flow                       Stripe Webhooks
─────────────────        ─────────────────                ──────────────────
Add payment field  →     Create Stripe objects       →    invoice.paid
Configure items    →       one_time: Invoice          →    → paymentStatus: "paid"
Set terms/methods  →       recurring: Subscription    →
Set payment type   →       installments: Sub Schedule  →   invoice.payment_failed
                           deposit_balance: 2 Invoices →    → paymentStatus: "failed"
                         Finalize & store IDs          →
                         Email hosted link             →   customer.subscription.updated
                                                       →    → status mapping
                                                       →   customer.subscription.deleted
                                                       →    → "paid" or "cancelled"
```

## Payment Types

### One-time (`one_time`)

Standard Stripe Invoice with line items. Finalized immediately to generate `hosted_invoice_url`.

### Recurring (`recurring`)

Creates a Stripe Subscription (or Subscription Schedule for fixed iteration counts).

- **Open-ended** (`endCondition: "never"`): Standard subscription, runs until cancelled.
- **After N payments** (`endCondition: "after_count"`): Subscription Schedule with `end_behavior: "cancel"`.
- **Until date** (`endCondition: "on_date"`): Subscription with `cancel_at` timestamp.

Platform fee is applied as `application_fee_percent` on the subscription.

### Installments (`installments`)

Uses Subscription Schedules with fixed iteration count. Total amount is split equally across `count` installments, billed at the configured `interval` (week or month).

Supports an optional `firstPaymentAmount` for a custom first installment — in this case, a one-time invoice is created for the first payment and a subscription handles the remaining installments.

### Deposit + Balance (`deposit_balance`)

Creates two separate Stripe Invoices:

- **Deposit invoice**: Due immediately (`days_until_due: 1`), amount = `totalAmountCents × depositPercent / 100`.
- **Balance invoice**: Due after `balanceDueDays`, amount = remainder.

Platform fee is split proportionally between the two invoices.

## User Flow Summary

1. User adds a payment field to the document canvas and assigns it to a recipient.
2. User configures the payment: type, line items, currency, due date terms, allowed payment methods.
3. User opens the Send Document dialog — payment summary is displayed.
4. User confirms send.
5. Backend creates Stripe objects on the connected account for each payment field config (invoice, subscription, or schedule depending on payment type).
6. Invoices are finalized immediately to generate `hosted_invoice_url`.
7. Recipient receives an email with the signing link and the hosted invoice URL.
8. Recipient pays via Stripe's hosted invoice page.
9. Stripe webhook fires and updates `payment_field_configs.paymentStatus`.

## Payment Status Lifecycle

```
pending → created → awaiting → paid
                             → failed
                             → cancelled
```

- **pending**: Config created in draft, no Stripe objects yet.
- **created**: Stripe objects created but not yet sent.
- **awaiting**: Invoice finalized and sent to recipient (or subscription is active).
- **paid**: Recipient has paid (set by `invoice.paid` webhook, or subscription completed naturally).
- **failed**: Payment failed or invoice marked uncollectible (set by `invoice.payment_failed`, `invoice.marked_uncollectible`, or subscription `past_due`/`unpaid` webhook).
- **cancelled**: Invoice voided/deleted or subscription cancelled (set by `invoice.voided`, `invoice.deleted`, or `customer.subscription.deleted` webhook).

## Webhook Handling

All Connect events are handled in `connect_webhook_handlers.ts`. Events are idempotent — duplicate events are skipped via `stripe_webhook_events`.

### Invoice Events

Each handler calls `updatePaymentStatusFromWebhook`, which looks up the config by `stripeInvoiceId` (via the `by_stripe_invoice` index):

| Stripe Event                   | Payment Status |
| ------------------------------ | -------------- |
| `invoice.paid`                 | `"paid"`       |
| `invoice.payment_failed`       | `"failed"`     |
| `invoice.voided`               | `"cancelled"`  |
| `invoice.marked_uncollectible` | `"failed"`     |
| `invoice.deleted`              | `"cancelled"`  |

### Subscription Events

Each handler calls `updatePaymentStatusFromSubscriptionWebhook`, which looks up the config by `stripeSubscriptionId` (via the `by_stripe_subscription` index):

| Stripe Event                    | Status Mapping                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `customer.subscription.updated` | Maps Stripe status: `active`→`"awaiting"`, `past_due`→`"failed"`, `canceled`→`"cancelled"`, `unpaid`→`"failed"`, `incomplete`→`"awaiting"`, `incomplete_expired`→`"cancelled"`, `trialing`→`"awaiting"`, `paused`→`"awaiting"` |
| `customer.subscription.deleted` | `"paid"` if ended naturally (`ended_at` set + `cancel_at_period_end`), otherwise `"cancelled"`                                                                                                                                 |

## Platform Fees

- **Free tier**: 1% of total amount
- **Pro tier**: 0.25% of total amount

For one-time and deposit/balance payments, fees are applied as `application_fee_amount` on the invoice. For recurring and installment payments, fees are applied as `application_fee_percent` on the subscription.

Fee handling (`absorb` vs `pass_to_recipient`) controls whether the platform fee appears as a visible line item on the invoice.

## Implementation Notes

- Invoice metadata includes `paymentFieldConfigId`, `paymentFieldId`, `documentId`, and `organizationId`.
- Invoices are blocked unless the connected account has `chargesEnabled`.
- All invoices use `collection_method: "send_invoice"` (never `charge_automatically`) since new customers never have a saved payment method.
- Wallet methods (`apple_pay`, `google_pay`) are filtered from `payment_method_types` — they are automatically enabled when `card` is present.
- `ach_debit` is mapped to `us_bank_account` for Stripe API compatibility.

## Key Backend Files

- `apps/backend/convex/stripe/payment_field_actions.ts` — Creates Stripe invoices/subscriptions for payment fields during the send flow.
- `apps/backend/convex/stripe/connect_webhook_handlers.ts` — Handles invoice and subscription lifecycle webhooks, updates `payment_field_configs`.
- `apps/backend/convex/payment_fields/mutations.ts` — Config CRUD and webhook-driven status updates.
- `apps/backend/convex/payment_fields/queries.ts` — Read queries for payment configs.
- `apps/backend/convex/payment_fields/helpers.ts` — Validation and computation helpers.
- `apps/backend/convex/documents/send_document_action.ts` — Orchestrates the send flow including payment object creation.
- `apps/backend/convex/schemas/payment_field_configs.ts` — Table schema with indexes.

## Key Frontend Files

- `apps/web/src/components/documents/send-document-dialog.tsx` — Shows payment summary before sending.
- `apps/web/src/components/documents/field-toolbar.tsx` — Payment field button in the field palette (gated on Stripe Connect).
- `apps/web/src/components/documents/field-input-manager.tsx` — Routes payment fields to `PaymentFieldSummary`.
- `apps/web/src/components/documents/field-inputs/payment-field-summary.tsx` — Read-only payment config view for signers.
- `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx` — Stripe Connect account settings.

## Data Model

- `payment_field_configs` table is the single source of truth for payment state.
- Each row has a 1:1 relationship with a `signature_fields` row where `fieldType === "payment"`.
- Indexed by `fieldId`, `documentId`, `organizationId`, `stripeInvoiceId`, and `stripeSubscriptionId`.
- Stripe remains the authoritative source; Convex stores status for real-time UI updates.

## Legacy System (Deprecated)

The previous `document_invoices` table and associated files (`invoice_actions.ts`, `invoice_mutations.ts`, `invoice_queries.ts`) have been removed from active code. The `document_invoices` table definition is retained in the schema for production data compatibility but is no longer read or written to by any code path.
