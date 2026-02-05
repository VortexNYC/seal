# Stripe Invoices (Document Send Flow)

This doc describes the Stripe‑native invoice flow used when sending documents. It intentionally avoids custom payment UI and relies on Stripe Invoicing + hosted invoice links.

## Goals

- Use Stripe Connect Standard accounts for payments.
- Create a draft invoice preview before sending.
- Finalize the invoice on send to obtain the hosted invoice URL.
- Send the hosted invoice link only to the invoice recipient.
- Delete draft invoices when the user cancels the send flow.

## User Flow Summary

1. User opens the Send Document dialog.
2. User toggles “Include Stripe invoice.”
3. User sets amount, description, and invoice recipient.
4. App creates a Stripe draft invoice and shows a preview.
5. User confirms send.
6. App finalizes the invoice and emails the hosted invoice URL to the selected recipient.

## Implementation Notes

- Draft invoices do not have `hosted_invoice_url` or `invoice_pdf`.
- Finalization happens in the send action to ensure the hosted link exists.
- Invoice links are only included for the selected invoice recipient.
- Draft invoices are deleted on cancel to keep Stripe clean.
- Invoices are blocked unless the connected account is `connected` and `chargesEnabled`.

## Key Backend Files

- `apps/backend/convex/stripe/invoice_actions.ts`
- `apps/backend/convex/stripe/invoice_mutations.ts`
- `apps/backend/convex/documents/send_document_action.ts`
- `apps/backend/convex/documents/email.ts`

## Key Frontend Files

- `apps/web/src/components/documents/send-document-dialog.tsx`
- `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx`

## Data Model

- `document_invoices` table tracks document‑scoped Stripe invoices.
- Stripe remains the source of truth; Convex stores lookup and status for UI usage.

