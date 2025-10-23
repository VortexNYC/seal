# Billing & Subscription Management - User Flows

## Primary User Flows

### Workspace Plan Upgrade Flow (Free to Pro)
```
○ User on Free Plan (10 docs limit reached)
    ↓
□ Document Limit Reached
    ├─ Block: "You've reached your 10 document limit"
    ├─ Display: Current usage "10 of 10 documents used"
    ├─ Action: "Upgrade to Pro for unlimited documents"
    └─ Button: "Upgrade Now" leads to billing
    ↓
□ Billing Dashboard Access
    ├─ Role Check: Workspace owner only
    ├─ Display: Current Free plan details
    ├─ Show: Pro plan benefits and pricing
    └─ Action: "Upgrade to Pro - $10/month per user"
    ↓
○ Payment Method Setup (Stripe Integration)
    ├─ Form: Credit card details via Stripe
    ├─ Validation: Real-time card validation
    └─ Security: PCI-compliant processing
    ↓
□ Subscription Creation
    ├─ Stripe: Create Pro subscription
    ├─ Billing: Immediate Pro activation
    ├─ Features: Unlock unlimited documents
    └─ Notification: Email confirmation sent
    ↓
○ Pro Plan Active
    ├─ Status: "Pro Plan - $10/month for 1 user"
    ├─ Usage: "Unlimited documents"
    └─ Next billing: Display next charge date
```

### Payment Method Management Flow
```
○ Workspace Owner Accesses Billing
    ↓
□ Payment Methods Section
    ├─ Display: Current payment methods
    ├─ Show: Card ending in **** 4242
    ├─ Actions: [Edit] [Remove] [Add New]
    └─ Primary: Mark primary payment method
    ↓
○ Add New Payment Method
    ├─ Form: Credit card form via Stripe
    ├─ Validation: Card number, expiry, CVC
    └─ Save: Store payment method securely
    ↓
□ Payment Method Updated
    ├─ Success: "Payment method added successfully"
    ├─ Display: New card in payment methods list
    └─ Option: Set as primary payment method
```

### Failed Payment Recovery Flow
```
○ Payment Failure Occurs (Stripe Webhook)
    ↓
□ Payment Failed Notification
    ├─ Email: Immediate notification to workspace owner
    ├─ Dashboard: Red alert banner "Payment failed"
    ├─ Grace Period: 30 days before downgrade
    └─ Action: "Update payment method" button
    ↓
○ User Updates Payment Method
    ├─ Access: Billing dashboard
    ├─ Update: New card information
    └─ Validate: Test new payment method
    ↓
□ Payment Retry Process
    ├─ Stripe: Retry failed payment with new method
    ├─ Success: Clear failed payment status
    ├─ Failure: Continue grace period countdown
    └─ Notification: Email confirmation of payment status
    ↓
○ Payment Recovery Success
    ├─ Status: "Payment successful - service continues"
    ├─ Display: Next billing date updated
    └─ Remove: Failed payment warnings
```

### Billing History Access Flow
```
○ Workspace Owner Views Billing History
    ↓
□ Invoice History Display
    ├─ List: All previous invoices chronologically
    ├─ Show: Date, amount, status (Paid/Failed)
    ├─ Actions: [Download PDF] for each invoice
    └─ Filter: By date range or payment status
    ↓
○ Invoice Download
    ├─ Click: "Download PDF" for specific invoice
    ├─ Generate: PDF invoice via Stripe
    ├─ Content: Workspace details, billing period, charges
    └─ Download: Automatic PDF download to browser
```

## Secondary User Flows

### Plan Downgrade Flow (Pro to Free)
```
○ Workspace Owner Initiates Downgrade
    ↓
□ Downgrade Warning
    ├─ Check: Current usage vs Free plan limits
    ├─ Warning: "You have 25 documents (exceeds 10 limit)"
    ├─ Effect: "Downgrade takes effect at next billing cycle"
    └─ Confirm: Two-step confirmation required
    ↓
○ Downgrade Scheduled
    ├─ Status: "Downgrade scheduled for [date]"
    ├─ Access: Full Pro features until billing cycle end
    ├─ Cancellation: Option to cancel downgrade
    └─ Notification: Email confirmation sent
    ↓
□ Billing Cycle End
    ├─ Automatic: Downgrade to Free plan
    ├─ Limits: Enforce Free plan restrictions
    ├─ Payment: Cancel Pro subscription via Stripe
    └─ Notification: Downgrade completion email
```

### Team Member Billing Impact Flow
```
○ Workspace Owner Adds Team Member
    ↓
□ Billing Impact Check
    ├─ Free Plan: Block with upgrade prompt
    ├─ Pro Plan: Allow addition with billing update
    └─ Display: "Adding member will increase billing to $20/month"
    ↓
○ Member Addition Confirmed
    ├─ Stripe: Update subscription quantity
    ├─ Prorated: Calculate mid-month billing adjustment
    ├─ Billing: Next invoice reflects new member count
    └─ Notification: Billing update confirmation
    ↓
□ Updated Billing Display
    ├─ Status: "Pro Plan - $20/month for 2 users"
    ├─ Next billing: Updated amount and date
    └─ Members: Show current member count and roles
```

### Subscription Cancellation Flow
```
○ Workspace Owner Initiates Cancellation
    ↓
□ Cancellation Warning
    ├─ Warning: "Access continues until billing period ends"
    ├─ Date: "Service ends on [end date]"
    ├─ Data: "All data will be preserved"
    └─ Confirm: "Are you sure you want to cancel?"
    ↓
○ Cancellation Processed
    ├─ Stripe: Cancel subscription at period end
    ├─ Status: "Cancelled - expires [date]"
    ├─ Access: Maintain Pro features until expiration
    └─ Notification: Cancellation confirmation email
    ↓
□ Subscription Expiration
    ├─ Automatic: Downgrade to Free plan
    ├─ Features: Remove Pro features, apply Free limits
    ├─ Reactivation: Option to reactivate Pro plan
    └─ Notification: Plan expiration notice
```

## Error Flows

### Access Control Error Flow
```
○ Non-Owner Attempts Billing Access
    ↓
□ Permission Check (RBAC)
    ├─ Role: Check workspace owner role
    ├─ Denial: "You don't have permission to access billing"
    ├─ Display: Read-only plan information
    └─ Contact: "Contact workspace owner to manage billing"
```

### Payment Processing Error Flow
```
○ Payment Processing Failure
    ↓
□ Error Handling
    ├─ Card Declined: "Your card was declined. Please try a different card."
    ├─ Expired Card: "Your card has expired. Please update your payment method."
    ├─ Stripe Error: "Payment processing temporarily unavailable. Please try again."
    └─ Network Error: "Connection error. Please check your internet and retry."
    ↓
○ Recovery Options
    ├─ Retry: "Try Again" button for temporary errors
    ├─ Update: "Update Payment Method" for card issues
    └─ Support: "Contact Support" for persistent issues
```