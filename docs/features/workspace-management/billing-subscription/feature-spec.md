# Feature: Workspace Billing & Subscription Management

## Feature Requirements (from MVP Core Features)

### Billing & Subscription Management ⭐ **Critical**

- [ ] **Subscription plan display** with current usage vs limits
- [ ] **Payment method management** (add/edit/remove payment methods)
- [ ] **Billing history** with downloadable invoices
- [ ] **Plan upgrade/downgrade** workflows
- [ ] **Usage tracking** and limit notifications
- [ ] **Billing notifications** via email

## Technology Stack Integration

- **Stripe**: Payment processing and subscription management
- **Clerk**: Workspace owner billing access control
- **Convex**: Usage tracking and billing data storage
- **React Email + Resend**: Billing notification emails

## Business Requirements

- Workspace-level billing (one subscription per workspace)
- Free tier: 10 docs/month, 1 user, no payment required
- Pro tier: $10/month per seat, unlimited features
- Clear upgrade prompts and usage visibility

---

## Edge Cases (from Feature Edge Cases Breakdown)

### Billing Access Control (Clerk Integration)

- [ ] **Workspace Owner**: Full billing access and management
  - View current plan, usage, and billing history
  - Add/edit/remove payment methods
  - Upgrade/downgrade subscription plans
  - Download invoices and receipts
- [ ] **Workspace Member**: Limited billing visibility
  - View current workspace plan and features
  - See usage limits (read-only)
  - Cannot modify billing or payment methods

### Subscription Plan Display Edge Cases

- [ ] **Free Plan Display**: Show current usage vs 10 document limit
  - Usage: "7 of 10 documents used this month"
  - Features: "1 user, 10 documents/month, basic features"
  - Action: Clear upgrade button to Pro plan
- [ ] **Pro Plan Display**: Show unlimited features and per-seat pricing
  - Usage: "Unlimited documents, 3 active users"
  - Billing: "Next billing: March 15 ($30/month for 3 users)"
  - Features: All Pro features listed
- [ ] **Trial Period Display**: Show remaining trial days
  - Status: "Pro Trial - 12 days remaining"
  - Action: Add payment method to continue Pro after trial

### Payment Method Management Edge Cases (Stripe Integration)

- [ ] **Add Payment Method**: Connect credit card via Stripe
  - Form: Standard credit card form with Stripe Elements secure processing
  - Validation: Real-time card validation
  - Success: Payment method saved, subscription activated
- [ ] **Update Payment Method**: Edit existing payment information
  - Process: Update existing Stripe payment method
  - Validation: New card verification
  - Effect: Next billing uses updated payment method
- [ ] **Remove Payment Method**: Delete payment method
  - Restriction: Cannot remove only payment method on paid plan
  - Warning: "This will downgrade workspace to Free plan"
  - Confirmation: Two-step confirmation process
- [ ] **Failed Payment Recovery**: Handle payment failures
  - Status: "Payment failed - please update your payment method"
  - Grace Period: 30 days before downgrade to Free plan
  - Retry: Manual retry option after updating payment method

### Plan Change Edge Cases

- [ ] **Upgrade to Pro**: Change from Free to Pro plan
  - Immediate: Pro features activated immediately
  - Billing: Prorated billing for current month
  - Payment: Requires valid payment method
- [ ] **Downgrade to Free**: Change from Pro to Free plan
  - Effective: At next billing cycle (not immediate)
  - Warning: Usage will be limited to Free plan restrictions
  - Data: All data preserved, but limited access if over Free limits
- [ ] **Member Count Changes**: Adding/removing workspace members
  - Pro Plan: Billing adjusts automatically per seat ($10/user/month)
  - Free Plan: Cannot add members (upgrade prompt shown)
  - Prorated: Mid-month member changes are prorated

### Usage Tracking Edge Cases (Convex Integration)

- [ ] **Free Plan Usage Tracking**: Track documents against 10/month limit
  - Counter: Reset monthly on billing date
  - Warning: "2 documents remaining this month" at 8/10
  - Block: Prevent new document creation at 10/10 with upgrade prompt
- [ ] **Pro Plan Usage Display**: Show usage for analytics (no limits)
  - Display: "47 documents this month, 8 active users"
  - Purpose: Usage analytics only, no restrictions
- [ ] **Usage Reset**: Monthly usage counter resets
  - Timing: Reset on billing date each month
  - Display: Clear indication of next reset date

### Billing History Edge Cases (Stripe Invoice Management)

- [ ] **Invoice Generation**: Monthly invoice creation via Stripe
  - Content: Workspace name, billing period, itemized charges
  - Delivery: Automatic email to workspace owner
  - Format: PDF download available
- [ ] **Invoice Downloads**: Access to billing history
  - List: All previous invoices with dates and amounts
  - Download: PDF invoice download for each billing period
  - Retention: Full billing history available
- [ ] **Failed Payment Invoices**: Handle unpaid invoices
  - Status: Clear indication of failed payments
  - Action: "Retry payment" button for failed invoices
  - Recovery: Update payment method and retry

### Billing Notifications Edge Cases (React Email + Resend)

- [ ] **Successful Payment**: Payment confirmation notifications
  - Email: Receipt with invoice attached via React Email
  - Content: Payment amount, next billing date, workspace details
- [ ] **Payment Failure**: Failed payment notifications
  - Email: Immediate notification with recovery instructions
  - Content: Reason for failure, update payment method link
  - Follow-up: Reminder emails at 7, 14, and 28 days
- [ ] **Plan Change**: Upgrade/downgrade notifications
  - Email: Confirmation of plan change with new billing details
  - Content: New plan features, billing amount, effective date
- [ ] **Trial Expiration**: Trial ending notifications
  - Email: 7 days before trial ends, day of expiration
  - Content: Add payment method to continue Pro features

### Stripe Integration Edge Cases

- [ ] **Stripe Subscription Creation**: New Pro subscription setup
  - Process: Create Stripe subscription with workspace context
  - Webhook: Handle subscription created webhook
  - State: Update workspace to Pro plan status
- [ ] **Stripe Payment Processing**: Handle payment events
  - Success: Payment succeeded webhook updates billing status
  - Failure: Payment failed webhook triggers recovery flow
  - Retry: Automatic retry handling via Stripe
- [ ] **Stripe Subscription Updates**: Plan changes via Stripe
  - Upgrade: Update subscription tier and billing amount
  - Downgrade: Schedule downgrade for next billing cycle
  - Cancellation: Cancel subscription but maintain access until period end
- [ ] **Stripe Webhook Handling**: Process Stripe webhook events
  - Authentication: Verify Stripe webhook signatures
  - Processing: Update Convex database based on webhook events
  - Errors: Handle webhook processing failures with retry
