# Document Sending - Wireframes

## 01: Document Sending Interface Wireframes

### Final Document Review (After Field Placement)

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                              [☰] [⚙] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Recipients > Fields > Send │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📤 Review and Send Document                             │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Final Review                                    │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 📄 service-agreement.pdf                        │ │ │
│ │ │ 📊 Status: Ready to send                        │ │ │
│ │ │ 📅 Created: March 15, 2024                      │ │ │
│ │ │ 📑 Pages: 3 pages                               │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✅ Document Validation:                            │ │
│ │ • All signature fields assigned to recipients      │ │
│ │ • 2 recipients configured                          │ │
│ │ • Parallel signing workflow selected              │ │
│ │ • All email addresses valid                       │ │
│ │                                                     │ │
│ │         [📄 Preview Document]  [✏️ Edit Fields]     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Recipients Summary:                                  │
│ • John Smith (Client) - 🔵 Blue fields                 │
│ • Your Company (Service Provider) - 🟢 Green fields    │
│                                                         │
│ [◀ Back to Fields] [Continue to Messages →]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Document Preview Modal

```
┌─────────────────────────────────────────────────────────┐
│ Document Preview                                  [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📄 service-agreement.pdf                               │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │           SERVICE AGREEMENT                     │ │ │
│ │ │                                                 │ │ │
│ │ │ Between: ________________                       │ │ │
│ │ │                                                 │ │ │
│ │ │ 🔵 [John Smith - Signature]                    │ │ │
│ │ │                                                 │ │ │
│ │ │ And: ____________________                       │ │ │
│ │ │                                                 │ │ │
│ │ │ 🟢 [Your Company - Signature]                  │ │ │
│ │ │                                                 │ │ │
│ │ │ Date: ___________                              │ │ │
│ │ │ 🔵 [John Smith - Date]                         │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ Page 1 of 3               [◀] [▶] [🔍+] [🔍-]      │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 Field Summary:                                       │
│ • 🔵 John Smith: 1 signature, 1 date field             │
│ • 🟢 Your Company: 1 signature field                   │
│                                                         │
│ [Close Preview]                        [Continue →]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Custom Message Composition

### Individual Message Composer

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                              [☰] [⚙] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Send               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✉️ Custom Messages for Recipients                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith (Client) - john@clientcompany.com    │ │
│ │                                                     │ │
│ │ 📧 Subject:                                        │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Service Agreement - Signature Required         │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 📝 Personal Message: (Optional)                    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Hi John,                                        │ │ │
│ │ │                                                 │ │ │
│ │ │ Please review and sign the service agreement   │ │ │
│ │ │ for our Q1 project. Let me know if you have    │ │ │
│ │ │ any questions.                                  │ │ │
│ │ │                                                 │ │ │
│ │ │ Best regards,                                   │ │ │
│ │ │ Sarah                                           │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ 📊 Characters: 147/1000                            │ │
│ │                                                     │ │
│ │ [📝 Use Template] [🔄 Reset Message]               │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Previous Message] [Next Message →] [2 of 2]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Message Templates Selection

```
┌─────────────────────────────────────────────────────────┐
│ Choose Message Template                           [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📝 Professional Message Templates                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Contract Signing                                │ │
│ │ Professional template for contract signatures      │ │
│ │ "Please review and sign the attached contract..."  │ │
│ │                              [Use This Template]   │ │
│ │                                                     │ │
│ │ 🤝 Agreement Review                                │ │
│ │ Friendly template for agreement reviews            │ │
│ │ "I hope this message finds you well..."           │ │
│ │                              [Use This Template]   │ │
│ │                                                     │ │
│ │ ⚡ Urgent Signature                                │ │
│ │ Template for time-sensitive documents              │ │
│ │ "This document requires your urgent attention..."  │ │
│ │                              [Use This Template]   │ │
│ │                                                     │ │
│ │ 🎯 Custom Message                                  │ │
│ │ Start with a blank message                         │ │
│ │ "Write your own personalized message..."          │ │
│ │                              [Use Custom Message]  │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                              [Apply Template]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### All Messages Review

```
┌─────────────────────────────────────────────────────────┐
│ Review All Messages                               [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📧 Message Summary Before Sending                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 John Smith (john@clientcompany.com)             │ │
│ │ Subject: Service Agreement - Signature Required    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Hi John,                                        │ │ │
│ │ │                                                 │ │ │
│ │ │ Please review and sign the service agreement   │ │ │
│ │ │ for our Q1 project. Let me know if you have    │ │ │
│ │ │ any questions.                                  │ │ │
│ │ │                                                 │ │ │
│ │ │ Best regards, Sarah                             │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                              [Edit] │ │
│ │                                                     │ │
│ │ 🏢 Your Company (you@yourcompany.com)              │ │
│ │ Subject: Service Agreement - Please Sign           │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Dear Team,                                      │ │ │
│ │ │                                                 │ │ │
│ │ │ Please review and sign this service agreement  │ │ │
│ │ │ to finalize our partnership with the client.   │ │ │
│ │ │                                                 │ │ │
│ │ │ Thank you.                                      │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                              [Edit] │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Back to Edit] [Send Document]                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Sending Process and Confirmation

### Final Send Confirmation

```
┌─────────────────────────────────────────────────────────┐
│ Send Document                                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📤 Ready to Send Document                               │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │                                                     │ │
│ │ 📊 Sending Summary:                                │ │
│ │ • Recipients: 2 people                             │ │
│ │ • Workflow: Parallel signing (all at once)        │ │
│ │ • Email delivery: Immediate                        │ │
│ │ • Estimated completion: 2-3 days                   │ │
│ │                                                     │ │
│ │ 👥 Recipients:                                     │ │
│ │ • John Smith (john@clientcompany.com)              │ │
│ │ • Your Company (you@yourcompany.com)               │ │
│ │                                                     │ │
│ │ ⚡ Action: Document will be sent immediately       │ │
│ │                                                     │ │
│ │ ℹ️ After sending, you can track progress and      │ │
│ │ send reminders from the document status page.     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                    [📤 Send Document Now]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Sending Progress

```
┌─────────────────────────────────────────────────────────┐
│ Sending Document...                               [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📤 Document Delivery in Progress                        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🔄 Sending Status:                                 │ │
│ │                                                     │ │
│ │ ✅ John Smith (john@clientcompany.com)             │ │
│ │    📧 Email delivered • Sent 2 seconds ago         │ │
│ │                                                     │ │
│ │ 🔄 Your Company (you@yourcompany.com)              │ │
│ │    📤 Sending email...                             │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ████████████████░░░░░░░░░░░░░ 67%     │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ⏱️ Estimated completion: 15 seconds                │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Please keep this window open until sending completes │
│                                                         │
│                               [Cancel Sending]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Sending Complete

```
┌─────────────────────────────────────────────────────────┐
│ Document Sent Successfully!                       [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🎉 Document Delivered Successfully                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │                                                     │ │
│ │ ✅ Delivery Summary:                               │ │
│ │                                                     │ │
│ │ ✅ John Smith (john@clientcompany.com)             │ │
│ │    📧 Delivered • 3:42 PM                          │ │
│ │                                                     │ │
│ │ ✅ Your Company (you@yourcompany.com)              │ │
│ │    📧 Delivered • 3:42 PM                          │ │
│ │                                                     │ │
│ │ 📊 Status: Awaiting Signatures                     │ │
│ │ 🔔 You'll receive notifications when recipients    │ │
│ │ view and sign the document.                        │ │
│ │                                                     │ │
│ │ 📈 Track progress and send reminders from the     │ │
│ │ document status page.                              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [📊 View Status] [📄 Back to Documents] [📤 Send Another] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Status Tracking and Management

### Document Status Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                              [☰] [⚙] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Status             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📊 Document Status: Awaiting Signatures                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Sent: Today at 3:42 PM • Parallel Workflow         │ │
│ │                                                     │ │
│ │ 📈 Progress: 0 of 2 signatures completed           │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%     │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Recipient Status:                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: 📧 Delivered • Not yet viewed               │ │
│ │ Sent: 3:42 PM • Last activity: Email delivered     │ │
│ │                    [📧 Send Reminder] [📞 Contact]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Your Company                             🟢      │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: 📧 Delivered • Not yet viewed               │ │
│ │ Sent: 3:42 PM • Last activity: Email delivered     │ │
│ │                    [📧 Send Reminder] [📞 Contact]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔄 Refresh Status] [📝 Add Note] [📊 Download Report]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Status with Recipient Activity

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Document Status: In Progress                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Sent: 2 hours ago • Progress: 1 of 2 completed     │ │
│ │                                                     │ │
│ │ 📈 Progress: 50% complete                          │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ████████████████░░░░░░░░░░░░░░░ 50%    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: ✅ Signed • Completed 1:15 PM               │ │
│ │ Activity: Viewed 12:30 PM • Signed 1:15 PM         │ │
│ │                         [👁️ View Signature]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Your Company                             🟢      │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: 👀 Viewed • Last activity: 30 min ago      │ │
│ │ Activity: Delivered 3:42 PM • Viewed 4:15 PM       │ │
│ │                    [📧 Send Reminder] [📞 Contact]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 1 signature remaining • Estimated completion: 1 day  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Sending Experience

### Mobile Final Review

```
┌───────────────────────────┐
│ Seal Send           [☰] │
├───────────────────────────┤
│                           │
│ 📤 Review & Send         │
│                           │
│ ┌───────────────────────┐ │
│ │ 📄 service-agreement  │ │
│ │ Ready to send         │ │
│ │                       │ │
│ │ ✅ 2 recipients       │ │
│ │ ✅ All fields assigned│ │
│ │ ✅ Parallel workflow  │ │
│ │                       │ │
│ │ [👁️ Preview Document] │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ 👥 Recipients:            │
│ • John Smith (Client)     │
│ • Your Company            │
│                           │
│ [◀ Back] [Messages →]     │
│                           │
└───────────────────────────┘
```

### Mobile Message Composer

```
┌───────────────────────────┐
│ Custom Message      [✕] │
├───────────────────────────┤
│                           │
│ 👤 John Smith            │
│ john@company.com          │
│                           │
│ Subject:                  │
│ [Agreement - Please Sign] │
│                           │
│ Message:                  │
│ ┌───────────────────────┐ │
│ │ Hi John,              │ │
│ │                       │ │
│ │ Please review and     │ │
│ │ sign the agreement.   │ │
│ │                       │ │
│ │ Thanks!               │ │
│ │ Sarah                 │ │
│ │                       │ │
│ └───────────────────────┘ │
│ 142/1000 characters       │
│                           │
│ [📝 Template] [Clear]     │
│                           │
│ [◀ Back] [Next →] [1/2]   │
│                           │
└───────────────────────────┘
```

### Mobile Send Confirmation

```
┌───────────────────────────┐
│ Send Document       [✕] │
├───────────────────────────┤
│                           │
│ 📤 Ready to Send         │
│                           │
│ ┌───────────────────────┐ │
│ │ 📄 service-agreement  │ │
│ │                       │ │
│ │ 👥 2 recipients       │ │
│ │ 📧 Immediate delivery │ │
│ │ ⏱️ Est. 2-3 days      │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ Recipients:               │
│ • John Smith             │
│ • Your Company           │
│                           │
│ After sending, track      │
│ progress from Documents   │
│                           │
│ [Cancel] [📤 Send Now]    │
│                           │
└───────────────────────────┘
```

---

## Error Handling and Edge Cases

### Email Delivery Failure

```
┌─────────────────────────────────────────────────────────┐
│ Delivery Issue Detected                           [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ Email Delivery Failed                               │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📧 Delivery Status:                                │ │
│ │                                                     │ │
│ │ ✅ John Smith (john@clientcompany.com)             │ │
│ │    📧 Delivered successfully                        │ │
│ │                                                     │ │
│ │ ❌ Your Company (you@yourcompany.com)              │ │
│ │    ⚠️ Delivery failed: Invalid email address      │ │
│ │                                                     │ │
│ │ 📝 What happened:                                  │ │
│ │ The email address appears to be invalid or         │ │
│ │ no longer exists. Please update the recipient's    │ │
│ │ email address and try sending again.               │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [✏️ Update Email Address] [🔄 Retry Sending] [Close]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Network Interruption Recovery

```
┌─────────────────────────────────────────────────────────┐
│ Resume Sending                                    [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔄 Sending Interrupted                                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📧 Partial Delivery Completed:                     │ │
│ │                                                     │ │
│ │ ✅ John Smith (john@clientcompany.com)             │ │
│ │    📧 Delivered successfully                        │ │
│ │                                                     │ │
│ │ ⏳ Your Company (you@yourcompany.com)              │ │
│ │    🔄 Sending interrupted by network issue          │ │
│ │                                                     │ │
│ │ 💡 What to do:                                     │ │
│ │ You can resume sending to the remaining recipient  │ │
│ │ or retry sending to all recipients (already        │ │
│ │ delivered recipients won't receive duplicates).    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔄 Resume Sending] [📧 Retry All] [Cancel]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Loading States for Async Operations

### Bulk Document Sending Progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         📤 Sending to 47 Recipients                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ 🚀 **Quarterly-Review.pdf** - Mass Distribution                        │ │
│ │                                                                         │ │
│ │ **Overall Progress:** 32/47 sent (68%)                                 │ │
│ │ ████████████████████████████████████░░░░░░░░░░░░░░░ 68%                │ │
│ │                                                                         │ │
│ │ **Status:**                                                             │ │
│ │ ✅ Sent: 32 recipients                                                  │ │
│ │ 🔄 Sending: 3 recipients                                                │ │
│ │ ⏳ Queue: 12 remaining                                                   │ │
│ │                                                                         │ │
│ │ **Currently sending to:**                                               │ │
│ │ • sarah.johnson@company.com                                             │ │
│ │ • mike.chen@company.com                                                 │ │
│ │ • lisa.rodriguez@company.com                                            │ │
│ │                                                                         │ │
│ │ **Estimated completion:** 2 minutes                                    │ │
│ │ **Rate limiting:** Respecting email provider limits                    │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ 💡 You'll be notified when all emails are sent                            │
│                                                                             │
│ [Run in Background] [Cancel Remaining] [View Sent List]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Large Document Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       🔄 Processing Large Document                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ 📄 **Annual-Report.pdf** (34.7 MB, 127 pages)                         │ │
│ │                                                                         │ │
│ │ **Processing steps:**                                                   │ │
│ │ ✅ Document uploaded successfully                                       │ │
│ │ ✅ Security scan completed - clean                                      │ │
│ │ ✅ PDF optimization in progress                                         │ │
│ │ ⏳ Generating page thumbnails                                           │ │
│ │ ⏳ Preparing for signature field placement                              │ │
│ │                                                                         │ │
│ │ **Current step:** Optimizing document size                             │ │
│ │ ████████████████████████████████░░░░░░░░░░░░ 72%                       │ │
│ │                                                                         │ │
│ │ **Progress:**                                                           │ │
│ │ • Original size: 34.7 MB                                               │ │
│ │ • Optimized size: 18.2 MB (48% reduction)                             │ │
│ │ • Processing time: ~3 minutes remaining                                 │ │
│ │                                                                         │ │
│ │ 💡 Large documents take longer to process for optimal performance      │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Work on Other Documents] [Cancel Processing]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Webhook Test Progress

````
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🔗 Testing Webhook                                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ **Endpoint:** https://api.yourapp.com/webhooks/seal                     │ │
│ │ **Event:** document.completed                                           │ │
│ │                                                                         │ │
│ │ **Test Progress:**                                                      │ │
│ │ ✅ Webhook payload generated                                            │ │
│ │ ✅ SSL certificate validated                                            │ │
│ │ 🔄 Sending test payload...                                              │ │
│ │ ⏳ Waiting for response                                                  │ │
│ │                                                                         │ │
│ │ **Test payload:**                                                       │ │
│ │ ```json                                                                 │ │
│ │ {                                                                       │ │
│ │   "event": "document.completed",                                        │ │
│ │   "data": {                                                             │ │
│ │     "document_id": "test_doc_123",                                      │ │
│ │     "status": "completed"                                               │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ │ ```                                                                     │ │
│ │                                                                         │ │
│ │ ⏱️ Response timeout: 10 seconds                                         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel Test] [View Test History]                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
````

### Webhook Test Success

````
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ✅ Webhook Test Successful                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ **Endpoint:** https://api.yourapp.com/webhooks/seal                     │ │
│ │ **Test completed:** Just now                                            │ │
│ │                                                                         │ │
│ │ **✅ Test Results:**                                                    │ │
│ │ • Request sent successfully                                             │ │
│ │ • Response received: 200 OK                                             │ │
│ │ • Response time: 247ms                                                  │ │
│ │ • SSL certificate: Valid                                                │ │
│ │                                                                         │ │
│ │ **Response headers:**                                                   │ │
│ │ • Content-Type: application/json                                        │ │
│ │ • X-Powered-By: Express                                                 │ │
│ │                                                                         │ │
│ │ **Response body:**                                                      │ │
│ │ ```json                                                                 │ │
│ │ {                                                                       │ │
│ │   "success": true,                                                      │ │
│ │   "message": "Webhook received successfully"                            │ │
│ │ }                                                                       │ │
│ │ ```                                                                     │ │
│ │                                                                         │ │
│ │ 🎉 Your webhook is working correctly!                                  │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Test Again] [View All Webhooks] [Close]                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
````

### Webhook Test Failure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ❌ Webhook Test Failed                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ **Endpoint:** https://api.yourapp.com/webhooks/seal                     │ │
│ │ **Test failed:** Just now                                               │ │
│ │                                                                         │ │
│ │ **❌ Error Details:**                                                   │ │
│ │ • Status: 500 Internal Server Error                                     │ │
│ │ • Response time: 5,247ms                                                │ │
│ │ • Error: Connection timeout after 5 seconds                            │ │
│ │                                                                         │ │
│ │ **Common causes:**                                                      │ │
│ │ • Server is down or overloaded                                          │ │
│ │ • Endpoint URL is incorrect                                             │ │
│ │ • Firewall blocking requests from our servers                          │ │
│ │ • SSL certificate issues                                                │ │
│ │                                                                         │ │
│ │ **Troubleshooting:**                                                    │ │
│ │ 1. Verify the endpoint URL is correct                                  │ │
│ │ 2. Check your server logs for incoming requests                        │ │
│ │ 3. Test the endpoint with curl or Postman                              │ │
│ │ 4. Ensure your server accepts POST requests                            │ │
│ │                                                                         │ │
│ │ Need help? Contact support with this test ID: WHT-2024-0315-001        │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [🔄 Retry Test] [Edit Webhook] [Contact Support] [Close]                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

This comprehensive wireframe collection covers the complete document sending workflow, from final review through custom messaging to delivery confirmation and status tracking, with proper mobile support, robust error handling, and comprehensive loading states for all async operations - all while maintaining the clean pricing model without artificial restrictions.
