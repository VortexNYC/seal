# Document Status Tracking - Wireframes

## 01: Status Tracking Interface Wireframes

### Main Status Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                    Sarah Johnson [⚙] [⟲] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Status             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📊 Document Status: In Progress                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Sent: March 15, 2024 at 3:42 PM • Parallel Workflow│ │
│ │                                                     │ │
│ │ 📈 Overall Progress: 1 of 2 signatures completed   │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ████████████████░░░░░░░░░░░░░░░ 50%    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ⏱️ Started: 2 hours ago • Est. completion: 1 day   │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Recipient Status:                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: ✅ Signed • Completed at 1:15 PM            │ │
│ │ Activity: Delivered 3:42 PM • Viewed 12:30 PM      │ │
│ │                         [👁️ View Signature]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Your Company                             🟢      │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: 👀 Viewed • Last activity: 30 min ago      │ │
│ │ Activity: Delivered 3:42 PM • Viewed 4:15 PM       │ │
│ │                         [📧 Send Reminder]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔄 Refresh Status] [📧 Send Reminders] [🗑️ Cancel Doc] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Initial Status (Just Sent)

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Document Status: Sent                                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Sent: March 15, 2024 at 3:42 PM (2 minutes ago)    │ │
│ │                                                     │ │
│ │ 📈 Overall Progress: 0 of 2 signatures completed   │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%     │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 📧 All recipients have been notified via email     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Recipient Status:                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: 📧 Email sent • Not yet viewed              │ │
│ │ Activity: Delivered 3:42 PM                         │ │
│ │                         [📧 Send Reminder]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Your Company                             🟢      │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: 📧 Email sent • Not yet viewed              │ │
│ │ Activity: Delivered 3:42 PM                         │ │
│ │                         [📧 Send Reminder]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Recipients will receive email notifications to sign  │
│ the document. You'll be notified as they progress.     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Document Completed Status

```
┌─────────────────────────────────────────────────────────┐
│ 🎉 Document Status: Completed                           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ✅ service-agreement.pdf                           │ │
│ │ Completed: March 15, 2024 at 5:20 PM               │ │
│ │ Total time: 1 hour 38 minutes                       │ │
│ │                                                     │ │
│ │ 📈 All signatures collected successfully!           │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ██████████████████████████████ 100%    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 🎯 Document is now legally binding and complete    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Final Recipient Status:                             │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: ✅ Signed • Completed at 1:15 PM            │ │
│ │ Duration: 1 hr 33 min from email to signature       │ │
│ │                         [👁️ View Signature]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Your Company                             🟢      │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: ✅ Signed • Completed at 5:20 PM            │ │
│ │ Duration: 1 hr 38 min from email to signature       │ │
│ │                         [👁️ View Signature]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [📥 Download Signed Document] [📧 Email Copies] [📊 View Report] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Activity Timeline

### Detailed Activity History

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Document Activity Timeline                           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🎉 March 15, 2024 • 5:20 PM                        │ │
│ │ ✅ Document completed                               │ │
│ │ Your Company signed document                        │ │
│ │                                                     │ │
│ │ 📧 March 15, 2024 • 4:15 PM                        │ │
│ │ 👀 Document viewed                                  │ │
│ │ Your Company opened signing link                    │ │
│ │                                                     │ │
│ │ 🎯 March 15, 2024 • 1:15 PM                        │ │
│ │ ✅ Signature completed                              │ │
│ │ John Smith signed document                          │ │
│ │                                                     │ │
│ │ 📧 March 15, 2024 • 12:30 PM                       │ │
│ │ 👀 Document viewed                                  │ │
│ │ John Smith opened signing link                      │ │
│ │                                                     │ │
│ │ 📤 March 15, 2024 • 3:42 PM                        │ │
│ │ 📧 Emails delivered                                 │ │
│ │ Document sent to all recipients                     │ │
│ │                                                     │ │
│ │ 📝 March 15, 2024 • 3:40 PM                        │ │
│ │ 🚀 Document created                                 │ │
│ │ Document prepared with fields and recipients        │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [📥 Download Activity Report] [📧 Email Timeline]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Sequential Signing Progress

### Sequential Workflow Status

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Document Status: In Progress (Sequential)            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 partnership-agreement.pdf                       │ │
│ │ Sent: March 15, 2024 • Sequential Signing Order    │ │
│ │                                                     │ │
│ │ 📈 Progress: Step 2 of 3 • 1 of 3 signatures       │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ██████████░░░░░░░░░░░░░░░░░░░░░░░ 33%    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 👤 Current Signer: Sarah Johnson                   │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🔄 Sequential Signing Order:                           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1️⃣ ✅ John Smith (Client)              🔵          │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: ✅ Signed • Completed at 1:15 PM            │ │
│ │ Passed to next signer automatically                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 2️⃣ 🔄 Sarah Johnson (Partner)          🟡 ACTIVE   │ │
│ │ sarah@partnercompany.com                            │ │
│ │ Status: 👀 Viewed • Currently reviewing             │ │
│ │ Received: 1:16 PM • Viewed: 2:30 PM                │ │
│ │                         [📧 Send Reminder]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 3️⃣ ⏳ Your Company                     🟢          │ │
│ │ you@yourcompany.com                                 │ │
│ │ Status: ⏳ Waiting for turn                         │ │
│ │ Will receive after Sarah completes                  │ │
│ │                           [View Position]           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Sarah must complete signing before Your Company     │
│ receives the document.                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Email Delivery Issues

### Email Delivery Failure Status

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Document Status: Delivery Issue                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Sent: March 15, 2024 at 3:42 PM                    │ │
│ │                                                     │ │
│ │ ⚠️ Issue: Email delivery failed for 1 recipient    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Progress: ████████████████░░░░░░░░░░░░░░░ 50%    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 🚨 Action required to continue                      │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 👥 Recipient Status:                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ John Smith                               🔵      │ │
│ │ john@clientcompany.com                              │ │
│ │ Status: ✅ Signed • Completed at 1:15 PM            │ │
│ │ Activity: Delivered 3:42 PM • Signed successfully  │ │
│ │                         [👁️ View Signature]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ❌ Your Company                             🟢      │ │
│ │ invalid@yourcompany.com                             │ │
│ │ Status: ❌ Email bounced • Invalid email address    │ │
│ │ Error: "Address not found" • Bounced at 3:43 PM    │ │
│ │                         [✏️ Update Email] [🔄 Retry] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Fix the email address issue to complete the document │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Update Recipient Email

```
┌─────────────────────────────────────────────────────────┐
│ Update Recipient Email                            [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✏️ Fix Email Address                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 Recipient: Your Company                         │ │
│ │                                                     │ │
│ │ ❌ Current Email (bounced):                        │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ invalid@yourcompany.com                         │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✅ New Email Address:                              │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ correct@yourcompany.com                         │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ✅ Valid email format                               │ │
│ │                                                     │ │
│ │ ⚠️ What happens next:                              │ │
│ │ • Document will be sent to the new email address   │ │
│ │ • Recipient will receive signing invitation        │ │
│ │ • Progress tracking will resume normally           │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                    [📧 Update & Send Document] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Document Cancellation

### Cancel Document Confirmation

```
┌─────────────────────────────────────────────────────────┐
│ Cancel Document                                   [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🗑️ Cancel Document Signing Process                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ⚠️ Are you sure you want to cancel this document?  │ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │ Current Status: In Progress (1 of 2 completed)     │ │
│ │                                                     │ │
│ │ 📧 Impact on recipients:                           │ │
│ │ • John Smith: Already signed (will be notified)    │ │
│ │ • Your Company: Will receive cancellation email    │ │
│ │                                                     │ │
│ │ 🚫 What happens when you cancel:                   │ │
│ │ • All signing links will be deactivated           │ │
│ │ • Recipients will be notified via email            │ │
│ │ • Document will be marked as cancelled             │ │
│ │ • This action cannot be undone                     │ │
│ │                                                     │ │
│ │ 💡 Reason for cancellation (optional):             │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Contract terms need revision                    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Keep Document Active]          [🗑️ Cancel Document]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Send Reminder Modal

### Send Reminder to Recipient

```
┌─────────────────────────────────────────────────────────┐
│ Send Reminder                                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📧 Send Reminder Email                                  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 Recipient: Your Company                         │ │
│ │ 📧 Email: you@yourcompany.com                      │ │
│ │                                                     │ │
│ │ 📊 Current Status: Viewed 30 minutes ago           │ │
│ │ 📅 Last Reminder: None sent                        │ │
│ │                                                     │ │
│ │ 📝 Custom Message (optional):                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Hi,                                             │ │ │
│ │ │                                                 │ │ │
│ │ │ Just a friendly reminder to sign the service   │ │ │
│ │ │ agreement when you have a moment.               │ │ │
│ │ │                                                 │ │ │
│ │ │ Thanks!                                         │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✅ Email will include document link and status     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                        [📧 Send Reminder Now] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Status Tracking

### Mobile Status Dashboard

```
┌───────────────────────────┐
│ Seal Status         [☰]  │
├───────────────────────────┤
│                           │
│ 📊 In Progress           │
│                           │
│ ┌───────────────────────┐ │
│ │ 📄 service-agreement  │ │
│ │ Sent: 2 hrs ago       │ │
│ │                       │ │
│ │ Progress: 1/2 (50%)   │ │
│ │ ████████████░░░░░░░░  │ │
│ │                       │ │
│ │ Est. complete: 1 day  │ │
│ └───────────────────────┘ │
│                           │
│ 👥 Recipients:            │
│                           │
│ ┌───────────────────────┐ │
│ │ ✅ John Smith     🔵  │ │
│ │ Signed at 1:15 PM     │ │
│ │ [👁️ View]             │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │ 👀 Your Company   🟢  │ │
│ │ Viewed 30 min ago     │ │
│ │ [📧 Send Reminder]    │ │
│ └───────────────────────┘ │
│                           │
│ [🔄 Refresh] [📧 Remind]  │
│                           │
└───────────────────────────┘
```

### Mobile Send Reminder

```
┌───────────────────────────┐
│ Send Reminder       [✕]  │
├───────────────────────────┤
│                           │
│ 📧 Remind Recipient      │
│                           │
│ 👤 Your Company          │
│ you@yourcompany.com       │
│                           │
│ Status: Viewed 30m ago    │
│ Last reminder: None       │
│                           │
│ ┌───────────────────────┐ │
│ │ Hi,                   │ │
│ │                       │ │
│ │ Just a friendly       │ │
│ │ reminder to sign the  │ │
│ │ service agreement.    │ │
│ │                       │ │
│ │ Thanks!               │ │
│ └───────────────────────┘ │
│                           │
│ [Cancel] [📧 Send]        │
│                           │
└───────────────────────────┘
```

This comprehensive status tracking interface provides senders with clear visibility into document progress with email-based notifications, per-recipient tracking, and essential management tools while maintaining our simplified MVP approach.
