# Recipient Management - Wireframes

## 01: Recipient Setup Interface Wireframes

### Initial Recipient Setup (After Document Processing)

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                              [☰] [⚙] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Recipients         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👥 Configure Recipients                                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Who needs to sign this document?                │ │
│ │                                                     │ │
│ │ Add recipients to define your signing workflow.    │ │
│ │ You can configure signing order and roles here.    │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 📄 Document: service-agreement.pdf              │ │ │
│ │ │ 📊 Status: Ready for recipient setup            │ │ │
│ │ │ 📅 Created: March 15, 2024                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │         [➕ Add First Recipient]                    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📝 Recipients will be assigned signature fields in the │
│ next step.                                              │
│                                                         │
│ [◀ Back to Processing]                         [Help] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Add Recipient Form

```
┌─────────────────────────────────────────────────────────┐
│ Add Recipient                                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👤 Recipient Details                                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 Full Name: *                                    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ John Smith                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✉️ Email Address: *                                │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ john@clientcompany.com                          │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ✅ Valid email format                              │ │
│ │                                                     │ │
│ │ 🎭 Recipient Role:                                 │ │
│ │ ● Signer (will complete signature fields)          │ │
│ │ ○ CC (receives copy, no signing required)          │ │
│ │ ○ Reviewer (can view and provide feedback)         │ │
│ │                                                     │ │
│ │ 📝 Internal Notes (optional):                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Client representative for Q1 project            │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                              [Add Recipient]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recipients List with Multiple Recipients

```
┌─────────────────────────────────────────────────────────┐
│ Seal                                              [☰] [⚙] │
├─────────────────────────────────────────────────────────┤
│ Documents > service-agreement.pdf > Recipients         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👥 Recipients (2 added)                                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                                  [✏️] │ │
│ │ john@clientcompany.com                              │ │
│ │ Role: Signer | Order: 1st                           │ │
│ │ Color: 🔵 Blue                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Your Company                                [✏️] │ │
│ │ you@yourcompany.com                                 │ │
│ │ Role: Signer | Order: 2nd                          │ │
│ │ Color: 🟢 Green                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [➕ Add Another Recipient]                              │
│                                                         │
│ 🔄 Signing Workflow:                                   │
│ ● Everyone signs at the same time (Parallel)           │
│ ○ Specific signing order required (Sequential)         │
│                                                         │
│ 📊 Summary: 2 Signers | Parallel Workflow              │
│                                                         │
│ [◀ Back] [🔄 Change Order] [Continue to Fields →]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Signing Order Configuration

### Sequential Signing Setup

```
┌─────────────────────────────────────────────────────────┐
│ Configure Signing Order                          [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔄 Sequential Signing Workflow                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ Recipients will receive the document in order:      │ │
│ │                                                     │ │
│ │ 1️⃣ First to Sign                                   │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 👤 John Smith                            [↕]  │   │ │
│ │ │ john@clientcompany.com                        │   │ │
│ │ │ Role: Signer                                  │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ 2️⃣ Signs After John Completes                      │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 🏢 Your Company                          [↕]  │   │ │
│ │ │ you@yourcompany.com                           │   │ │
│ │ │ Role: Signer                                  │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ ⏳ Each recipient waits for the previous signer    │ │
│ │ to complete before receiving the document.          │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Back to Parallel] [Preview Workflow] [✅ Confirm Order] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Parallel Signing Workflow

```
┌─────────────────────────────────────────────────────────┐
│ Signing Workflow Configuration                   [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔄 Parallel Signing Workflow                           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ All recipients receive the document simultaneously: │ │
│ │                                                     │ │
│ │ ┌─────────────────┐    ┌─────────────────┐         │ │
│ │ │ 👤 John Smith   │    │ 🏢 Your Company │         │ │
│ │ │ Client Signer   │    │ Service Provider │         │ │
│ │ │ 🔵 Blue Fields  │    │ 🟢 Green Fields  │         │ │
│ │ └─────────────────┘    └─────────────────┘         │ │
│ │                                                     │ │
│ │ ⚡ Benefits:                                       │ │
│ │ • Faster completion time                            │ │
│ │ • No waiting between signers                        │ │
│ │ • Document completes when all finish               │ │
│ │                                                     │ │
│ │ 📊 Estimated completion: 1-3 days                  │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔄 Switch to Sequential] [✅ Use Parallel Workflow]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Recipient Role Management

### Edit Recipient Details

```
┌─────────────────────────────────────────────────────────┐
│ Edit Recipient                                    [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👤 Update Recipient Information                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 Full Name:                                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ John Smith                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✉️ Email Address:                                  │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ john@clientcompany.com                          │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 🎭 Recipient Role:                                 │ │
│ │ ● Signer (will complete signature fields)          │ │
│ │ ○ CC (receives copy, no signing required)          │ │
│ │ ○ Reviewer (can view and provide feedback)         │ │
│ │                                                     │ │
│ │ 🎨 Field Color: [🔵 Blue    ▼]                    │ │
│ │                                                     │ │
│ │ 📍 Signing Position:                               │ │
│ │ [1st to sign ▼] (if sequential workflow)           │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🗑️ Remove Recipient] [Cancel] [Save Changes]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Remove Recipient Confirmation

```
┌─────────────────────────────────────────────────────────┐
│ Remove Recipient                                  [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ Remove John Smith from document?                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 John Smith (john@clientcompany.com)             │ │
│ │ Role: Signer | Color: 🔵 Blue                      │ │
│ │                                                     │ │
│ │ ⚠️ Impact of removal:                              │ │
│ │                                                     │ │
│ │ ✅ Safe to remove:                                 │ │
│ │ • No signature fields assigned yet                 │ │
│ │ • Signing order will update automatically          │ │
│ │                                                     │ │
│ │ 📝 Remaining recipients:                           │ │
│ │ • Your Company (Service Provider)                  │ │
│ │                                                     │ │
│ │ This action cannot be undone.                       │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                              [Remove Recipient] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Error Handling and Validation

### Email Validation Error

```
┌─────────────────────────────────────────────────────────┐
│ Add Recipient                                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👤 Recipient Details                                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 👤 Full Name: *                                    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ John Smith                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✉️ Email Address: *                                │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ john@invalid-email                              │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ❌ Invalid email format                            │ │
│ │ 💡 Did you mean: john@gmail.com?                   │ │
│ │                                                     │ │
│ │ ℹ️ Common formats:                                 │ │
│ │ • name@company.com                                  │ │
│ │ • name@gmail.com                                    │ │
│ │ • firstname.lastname@domain.com                     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                              [Add Recipient]   │
│                            (disabled until valid)      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Duplicate Recipient Warning

```
┌─────────────────────────────────────────────────────────┐
│ Duplicate Recipient Detected                      [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ This email is already added                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📧 john@clientcompany.com                          │ │
│ │                                                     │ │
│ │ This email already exists as:                       │ │
│ │                                                     │ │
│ │ 👤 John Smith                                      │ │
│ │ Role: Signer | Color: 🔵 Blue                      │ │
│ │ Position: 1st to sign                              │ │
│ │                                                     │ │
│ │ ✅ Your options:                                   │ │
│ │ • Edit the existing recipient                       │ │
│ │ • Use a different email address                     │ │
│ │ • Cancel and return to recipient list              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [✏️ Edit Existing] [📝 Different Email] [❌ Cancel]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Recipient Management

### Mobile Recipient Setup

```
┌───────────────────────────┐
│ Seal Recipients      [☰] │
├───────────────────────────┤
│                           │
│ 👥 Configure Recipients  │
│                           │
│ ┌───────────────────────┐ │
│ │ 📄 service-agreement  │ │
│ │ Ready for recipients  │ │
│ └───────────────────────┘ │
│                           │
│ 📝 Who needs to sign?    │
│                           │
│ Recipients: 0             │
│                           │
│ [➕ Add First Recipient] │
│                           │
│ 💡 Add recipients first,  │
│ then place signature      │
│ fields in next step.      │
│                           │
│ [◀ Back]                 │
│                           │
└───────────────────────────┘
```

### Mobile Add Recipient Form

```
┌───────────────────────────┐
│ Add Recipient        [✕] │
├───────────────────────────┤
│                           │
│ 👤 Recipient Details      │
│                           │
│ Name: *                   │
│ [John Smith         ]     │
│                           │
│ Email: *                  │
│ [john@company.com   ]     │
│ ✅ Valid                  │
│                           │
│ Role:                     │
│ ● Signer                  │
│ ○ CC                      │
│ ○ Reviewer                │
│                           │
│ Notes (optional):         │
│ [Client contact     ]     │
│                           │
│ [Cancel] [Add Recipient]  │
│                           │
└───────────────────────────┘
```

### Mobile Recipients List

```
┌───────────────────────────┐
│ Seal Recipients      [☰] │
├───────────────────────────┤
│                           │
│ 👥 Recipients (2)         │
│                           │
│ ┌───────────────────────┐ │
│ │ 👤 John Smith     [✏] │ │
│ │ john@company.com      │ │
│ │ Signer | 🔵 Blue     │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │ 🏢 Your Company   [✏] │ │
│ │ you@company.com       │ │
│ │ Signer | 🟢 Green    │ │
│ └───────────────────────┘ │
│                           │
│ [➕ Add Recipient]        │
│                           │
│ 🔄 Workflow:              │
│ ● Parallel signing        │
│ ○ Sequential order        │
│                           │
│ [◀ Back] [Continue →]     │
│                           │
└───────────────────────────┘
```

---

## Recipient Setup Complete

### Ready for Field Placement

```
┌─────────────────────────────────────────────────────────┐
│ Recipients Configured                             [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ Recipients successfully configured!                  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📊 Recipient Summary:                              │ │
│ │ • Total recipients: 2                              │ │
│ │ • Signers: 2                                       │ │
│ │ • CC recipients: 0                                 │ │
│ │ • Workflow: Parallel signing                       │ │
│ │                                                     │ │
│ │ 👥 Recipient Details:                              │ │
│ │ • John Smith (Client) - 🔵 Blue fields            │ │
│ │ • Your Company (Service Provider) - 🟢 Green fields│ │
│ │                                                     │ │
│ │ ✅ All recipients have valid email addresses       │ │
│ │ ✅ Signing workflow configured                      │ │
│ │ ✅ Recipient roles assigned                         │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🎯 Next Steps:                                          │
│ • Place signature fields and assign to recipients      │ │
│ • Configure field properties and validation            │ │
│ • Review and send document for signatures              │ │
│                                                         │
│ [◀ Edit Recipients] [Add Signature Fields →]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This completes the comprehensive wireframes for recipient management, covering the clean recipient setup that happens before field placement, with no artificial limits and intuitive workflow transitions.