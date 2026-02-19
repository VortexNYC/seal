# Email Integration - Wireframes

## Email Composition Interface

### Document Invitation Email Composer

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Send Document - Compose Email                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Document: Contract_Agreement.pdf                                                │
│                                                                                 │
│ ┌─ Recipients ──────────────────────────────────────────────────────────────────┐ │
│ │ • john@company.com (Recipient 1)                                             │ │
│ │ • sarah@client.com (Recipient 2)                                             │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Email Template:                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Standard Invitation              ▼                                          │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Subject Line:                                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Please sign: Contract_Agreement.pdf                                         │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Custom Message (Optional):                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Hi there,                                                                   │ │
│ │                                                                             │ │
│ │ Please review and sign the attached contract. Let me know if you have      │ │
│ │ any questions.                                                              │ │
│ │                                                                             │ │
│ │ Thanks!                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Preview   │ │    Send     │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Email Template Selection

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Select Email Template                                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Choose a template for your signing request:                                     │
│                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ┌── Standard Invitation ──────────┐  ┌── Contract Review ──────────────┐   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │ Hi [Name],                      │  │ Dear [Name],                    │   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │ Please review and sign the      │  │ Please review the attached      │   │ │
│ │ │ attached document.              │  │ contract and provide your       │   │ │
│ │ │                                 │  │ electronic signature.           │   │ │
│ │ │ Click here to sign: [Link]      │  │                                 │   │ │
│ │ │                                 │  │ Sign here: [Link]               │   │ │
│ │ │         [Select]                │  │         [Select]                │   │ │
│ │ └─────────────────────────────────┘  └─────────────────────────────────┘   │ │
│ │                                                                             │ │
│ │ ┌── Urgent Request ───────────────┐  ┌── Reminder Template ────────────┐   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │ URGENT: [Name],                 │  │ Hi [Name],                      │   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │ This document requires your     │  │ Just a friendly reminder that   │   │ │
│ │ │ immediate signature.            │  │ your signature is needed.       │   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │ Sign now: [Link]                │  │ Complete signing: [Link]        │   │ │
│ │ │                                 │  │                                 │   │ │
│ │ │         [Select]                │  │         [Select]                │   │ │
│ │ └─────────────────────────────────┘  └─────────────────────────────────┘   │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                                 ┌─────────────┐                               │
│                                 │    Cancel   │                               │
│                                 └─────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Email Preview Interface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Email Preview - Review Before Sending                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─ Email Preview ───────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ From: yourname@company.com                                                  │ │
│ │ To: john@company.com, sarah@client.com                                      │ │
│ │ Subject: Please sign: Contract_Agreement.pdf                                │ │
│ │                                                                             │ │
│ │ ─────────────────────────────────────────────────────────────────────────── │ │
│ │                                                                             │ │
│ │ Hi there,                                                                   │ │
│ │                                                                             │ │
│ │ Please review and sign the attached contract. Let me know if you have      │ │
│ │ any questions.                                                              │ │
│ │                                                                             │ │
│ │ Thanks!                                                                     │ │
│ │                                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │ │
│ │ │                        📄 View & Sign Document                      │   │ │
│ │ └─────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                             │ │
│ │ Document: Contract_Agreement.pdf                                            │ │
│ │ Sent via Seal - Secure Electronic Signatures                               │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │    Back     │ │    Send     │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Email Tracking Interface

### Email Delivery Status Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Document Status - Email Tracking                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Contract_Agreement.pdf - Sent 2 hours ago                                      │
│                                                                                 │
│ ┌─ Email Delivery Status ───────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ┌─ john@company.com (Recipient 1) ─────────────────────────────────────┐   │ │
│ │ │                                                                       │   │ │
│ │ │ ✅ Email Delivered - 2 hours ago                                      │   │ │
│ │ │ ✅ Email Opened - 1 hour ago                                          │   │ │
│ │ │ ✅ Document Viewed - 45 minutes ago                                   │   │ │
│ │ │ ⏳ Signature Pending                                                   │   │ │
│ │ │                                                                       │   │ │
│ │ │ ┌─────────────────┐                                                   │   │ │
│ │ │ │ Send Reminder   │                                                   │   │ │
│ │ │ └─────────────────┘                                                   │   │ │
│ │ │                                                                       │   │ │
│ │ └───────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                             │ │
│ │ ┌─ sarah@client.com (Recipient 2) ──────────────────────────────────────┐   │ │
│ │ │                                                                       │   │ │
│ │ │ ✅ Email Delivered - 2 hours ago                                      │   │ │
│ │ │ ❌ Email Not Opened                                                   │   │ │
│ │ │ ⏳ Document Not Viewed                                                │   │ │
│ │ │ ⏳ Signature Pending                                                   │   │ │
│ │ │                                                                       │   │ │
│ │ │ ┌─────────────────┐                                                   │   │ │
│ │ │ │ Send Reminder   │                                                   │   │ │
│ │ │ └─────────────────┘                                                   │   │ │
│ │ │                                                                       │   │ │
│ │ └───────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Overall Progress: 0 of 2 signatures complete                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Email Bounce Error State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Email Delivery Issue - Action Required                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ⚠️ Email delivery failed for sarah@client.com                                   │
│                                                                                 │
│ ┌─ Delivery Failure Details ────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Recipient: sarah@client.com                                                 │ │
│ │ Failure Reason: Invalid email address (domain not found)                   │ │
│ │ Attempted: 2 hours ago                                                      │ │
│ │                                                                             │ │
│ │ The email could not be delivered because the email address appears to be   │ │
│ │ invalid or the domain does not exist.                                       │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Resolution Options:                                                             │
│                                                                                 │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                   │
│ │ Update Email    │ │ Retry Delivery  │ │ Remove Recipient│                   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘                   │
│                                                                                 │
│ ┌─ Update Email Address ─────────────────────────────────────────────────────┐   │
│ │                                                                           │   │
│ │ New Email Address:                                                        │   │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ sarah@newclient.com                                                 │   │   │
│ │ └─────────────────────────────────────────────────────────────────────┘   │   │
│ │                                                                           │   │
│ │                          ┌─────────────┐                                │   │
│ │                          │ Update & Send│                                │   │
│ │                          └─────────────┘                                │   │
│ │                                                                           │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Reminder Email Interface

### Send Manual Reminder

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Send Reminder - Contract_Agreement.pdf                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Send a friendly reminder to recipients who haven't signed yet:                  │
│                                                                                 │
│ ┌─ Select Recipients ────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ john@company.com (Email opened, document viewed, pending signature)      │ │
│ │ ☑️ sarah@client.com (Email delivered, not opened yet)                       │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Reminder Message:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Hi there,                                                                   │ │
│ │                                                                             │ │
│ │ Just a friendly reminder that your signature is needed on the document     │ │
│ │ I sent earlier.                                                             │ │
│ │                                                                             │ │
│ │ Please sign at your earliest convenience.                                   │ │
│ │                                                                             │ │
│ │ Thanks!                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Reminder Preview ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Subject: Reminder: Please sign Contract_Agreement.pdf                       │ │
│ │                                                                             │ │
│ │ [Custom message above]                                                      │ │
│ │                                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │ │
│ │ │                        📄 Complete Signing                          │   │ │
│ │ └─────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │Send Reminder│                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Automated Reminder Settings

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Configure Automatic Reminders                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Set up automatic reminder emails for recipients who haven't signed:            │
│                                                                                 │
│ ┌─ Reminder Schedule ────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ Enable automatic reminders                                               │ │
│ │                                                                             │ │
│ │ Send first reminder after:                                                  │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐     │ │
│ │ │ 3 days                                                            ▼ │     │ │
│ │ └─────────────────────────────────────────────────────────────────────┘     │ │
│ │                                                                             │ │
│ │ Send additional reminders every:                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐     │ │
│ │ │ 2 days                                                            ▼ │     │ │
│ │ └─────────────────────────────────────────────────────────────────────┘     │ │
│ │                                                                             │ │
│ │ Maximum reminders per recipient:                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐     │ │
│ │ │ 3 reminders                                                       ▼ │     │ │
│ │ └─────────────────────────────────────────────────────────────────────┘     │ │
│ │                                                                             │ │
│ │ Stop reminders when:                                                        │ │
│ │ ☑️ Document is fully signed                                                  │ │
│ │ ☑️ Recipient opts out of reminders                                          │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │    Apply    │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Completion Notification

### Document Completion Email Interface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Document Completed! 🎉                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Great news! All signatures have been collected for Contract_Agreement.pdf      │
│                                                                                 │
│ ┌─ Completion Summary ───────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Document: Contract_Agreement.pdf                                            │ │
│ │ Completed: January 15, 2025 at 3:42 PM                                     │ │
│ │                                                                             │ │
│ │ Signatures Collected:                                                       │ │
│ │ ✅ john@company.com - Signed January 15, 2025 at 2:15 PM                   │ │
│ │ ✅ sarah@client.com - Signed January 15, 2025 at 3:42 PM                   │ │
│ │                                                                             │ │
│ │ All parties have been automatically notified of completion.                 │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Completion Email Preview ─────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ To: All signers (john@company.com, sarah@client.com)                       │ │
│ │ Subject: ✅ Contract_Agreement.pdf has been completed                        │ │
│ │                                                                             │ │
│ │ Dear signers,                                                               │ │
│ │                                                                             │ │
│ │ The document "Contract_Agreement.pdf" has been fully signed by all          │ │
│ │ parties. A copy of the completed document is attached.                     │ │
│ │                                                                             │ │
│ │ Thank you for your participation in this signing process.                   │ │
│ │                                                                             │ │
│ │ 📎 Attachment: Contract_Agreement_Signed.pdf                                │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                   │
│ │ Download Signed │ │ Send Completion │ │ View Document   │                   │
│ │ Document        │ │ Emails          │ │ Details         │                   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Mobile Email Interface

### Mobile Email Composer

```
┌─────────────────────────────────┐
│ Send Document                   │
├─────────────────────────────────┤
│                                 │
│ Document: Contract.pdf          │
│                                 │
│ To: john@company.com            │
│     sarah@client.com            │
│                                 │
│ Template:                       │
│ ┌─────────────────────────────┐ │
│ │ Standard Invitation       ▼ │ │
│ └─────────────────────────────┘ │
│                                 │
│ Subject:                        │
│ ┌─────────────────────────────┐ │
│ │ Please sign: Contract.pdf   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Message:                        │
│ ┌─────────────────────────────┐ │
│ │ Hi there,                   │ │
│ │                             │ │
│ │ Please review and sign the  │ │
│ │ attached contract.          │ │
│ │                             │ │
│ │ Thanks!                     │ │
│ └─────────────────────────────┘ │
│                                 │
│      ┌─────────────────┐        │
│      │      Send       │        │
│      └─────────────────┘        │
│                                 │
└─────────────────────────────────┘
```

Perfect! Now we have **clean, simple, MVP-focused email integration** that matches our established style and principles. No overcomplicated features, just the essentials for professional document signing workflow.
