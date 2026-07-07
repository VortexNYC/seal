# Seal Document Payment Vortex Live Proof

Date: 2026-07-07
Host: herdr
Repo: /home/debian/Projects/Seal
Branch: codex/seal-vortex-document-payment-proof

## Command

```bash
cd /home/debian/Projects/Seal
SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live
```

## Result

Passed.

```json
{
  "ok": true,
  "check": "seal_document_payment_vortex_live",
  "boundary": "Creates a live Vortex-hosted document payment link. Actual card payment, platform-fee settlement, and payout reconciliation remain follow-up proof.",
  "sealDeployment": "dev:clever-goose-484",
  "vortexDeployment": "dev:notable-leopard-969",
  "vortexBaseUrl": "https://notable-leopard-969.convex.site",
  "proofRunId": "mraopvye_ezz5bx",
  "organizationId": "nh77n50weg647ywh9t3skjqdkn8a29pb",
  "documentId": "m1739cvde9w1x0zpj48qeagbw58a3rt4",
  "lineItemId": "seal_document_payment_line_mraopvye_ezz5bx",
  "priceId": "vtx_price_seal_document_payment_mraopvye_ezz5bx",
  "billingAccountId": "bacc_seal_document_payment_mraopvye_ezz5bx",
  "customerId": "vtx_cust_seal_document_payment_mraopvye_ezz5bx",
  "merchantAccountId": "ma_seal_document_payment_proof",
  "payment": {
    "vortexPayableId": "payable_mraoq9vj_sv6qnc8z",
    "hostedInvoiceUrl": "https://notable-leopard-969.convex.site/pay/pay_nUIiDG0pBcFAnaKiuK50gF1y4m3YleHOydRv3y98MKQ",
    "totalAmountCents": 4200,
    "currency": "usd"
  },
  "state": {
    "paymentStatus": "awaiting",
    "invoiceStatus": "open",
    "invoiceProvider": "vortex_billing"
  }
}
```

## What This Proves

- Seal can create a live one-time document-payment payable through Vortex.
- Vortex returns a hosted payment URL.
- Seal stores the document invoice as `vortex_billing`.
- Seal stores the payment in `awaiting` state with an open invoice.

## What This Does Not Prove

- Sandbox card payment completion.
- Real webhook projection after a paid checkout.
- Platform-fee movement.
- Settlement and payout reconciliation.
- Recurring, installment, and deposit/balance document payment creation.

## Next Limiter

Pay the hosted Vortex checkout for `payable_mraoq9vj_sv6qnc8z`, then prove the real webhook updates Seal and the merchant money path is visible through Vortex settlement/payout surfaces.
