# Email Integration – Wireframes

## 01: Compose and Send

### A) Quick Send (Default Messaging)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Seal                                                        [☰] [⚙] │
├──────────────────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Messages > Review & Send         │
├──────────────────────────────────────────────────────────────────────┤
│ 📧 Quick Send                                                         │
│                                                                      │
│ Info                                                                 │
│ • Recipients: John Smith (Signer), Legal Team (Signer)               │
│ • Workflow: Parallel                                                 │
│ • Delivery: Email via provider                                       │
│                                                                      │
│ Default Message (read-only)                                          │
│ Subject: Signature Request – {documentTitle}                          │
│ Body:                                                                │
│   Hi {recipientName},                                                │
│   Please review and sign "{documentTitle}".                          │
│   Best regards, {senderDisplayName}                                   │
│                                                                      │
│ [Customize Messages]                                   [Send Now]    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### E) Mobile Variants

```
┌─────────────────────────┐
│        Seal ☰           │
├─────────────────────────┤
│ Quick Send                                     │
│ Recipients: 2                                   │
│ Subject: Signature Request – {documentTitle}    │
│ Body: Hi {recipientName}, please review and…    │
│                                                 │
│ [Customize]                         [Send Now]  │
└─────────────────────────┘

┌─────────────────────────┐
│        Seal ☰           │
├─────────────────────────┤
│ Compose (Per Recipient)                            │
│ John Smith                                         │
│ Subject: …                                         │
│ [ Body editor multiline …………………… ]                 │
│ [Insert ▾]  [Templates ▾]     [Next ▶]             │
│                                                   │
│ < Back                           Review & Send ▶   │
└─────────────────────────┘
```

### F) State Variants

#### 🔵 Initial/Empty

```
• Custom Send: subject/body empty, helper text shown.
• Quick Send: default message preview visible, no edits.
```

#### 🟡 Loading

```
• Loading recipients/templates: ⏳ Loading… overlays editor areas.
```

#### 🟢 Success

```
• Banner: ✅ Emails queued for delivery to 2 recipients.
```

#### 🔴 Error

```
• Validation: ❌ Subject required / ❌ Invalid recipient email.
• Send failure: ❌ Could not queue emails. Try again.
```

#### ⚪ Edge Cases

```
• Long recipient lists: paginate/accordion collapse recipients.
• Variable preview: show resolved variables in preview safely.
```

### B) Custom Send (Per-Recipient Personalization)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Seal                                                        [☰] [⚙] │
├──────────────────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Messages > Compose                │
├──────────────────────────────────────────────────────────────────────┤
│ 👤 John Smith (Signer) – john@client.com                              │
│ Subject: Service Agreement – Signature Required                       │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Body editor                                                      │ │
│ │ [Hi John, please review and sign the service agreement...]       │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ [Insert Variable ▾] [Templates ▾]  Char: 124                         │
│                                                                      │
│ 👤 Legal Team (Signer) – legal@yourco.com                             │
│ Subject: Service Agreement – Please Sign                              │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Body editor                                                      │ │
│ │ [Team, please sign the attached agreement for Q1...]             │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ [Insert Variable ▾] [Templates ▾]  Char: 92                          │
│                                                                      │
│ [Preview All]                                         [Review & Send]│
└──────────────────────────────────────────────────────────────────────┘
```

Notes

- Variables allowed: recipient name, document title, sender details.
- Templates: pick and apply as starting points; no template creation here.

### C) Template Picker (Modal)

```
┌──────────────────────────────────────────────────────────┐
│ Message Templates                                 [✕]   │
├──────────────────────────────────────────────────────────┤
│ 📋 Contract Signing                                      │
│   Professional template for contract signatures          │
│   Preview: "Please review and sign…"       [Use Template]│
│                                                          │
│ 🤝 Agreement Review                                      │
│   Friendly template for agreement reviews                │
│   Preview: "I hope this finds you well…"  [Use Template] │
│                                                          │
│ ⚡ Urgent Signature                                      │
│   Template for time-sensitive documents                  │
│   Preview: "This requires your urgent attention…" [Use]  │
│                                                          │
│ [Cancel]                                        [Apply]  │
└──────────────────────────────────────────────────────────┘
```

### D) Review & Confirm

```
┌──────────────────────────────────────────────────────────────────────┐
│ Review & Send                                                [✕]     │
├──────────────────────────────────────────────────────────────────────┤
│ Recipients (2)                                                        │
│ • John Smith – Subject + first 2 lines (read-only) [Edit]             │
│ • Legal Team – Subject + first 2 lines (read-only) [Edit]             │
│                                                                      │
│ Delivery                                                              │
│ • Emails sent via provider per recipient (unique secure link)         │
│ • States tracked: queued → sending → delivered/opened/clicked         │
│                                                                      │
│ [Back]                                                   [Send]       │
└──────────────────────────────────────────────────────────────────────┘
```
