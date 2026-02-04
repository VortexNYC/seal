# Bulk Operations - Wireframes

## Document Library with Bulk Selection

### Document List with Multi-Select Interface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Document Library - Bulk Operations                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─ Bulk Actions Bar ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ Select All (15 documents)    3 selected                                  │ │
│ │                                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│ │ │   Delete    │ │   Archive   │ │  Download   │ │    Send     │            │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Document List ────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ Contract_Agreement.pdf           Draft      Jan 15, 2025     2 recipients │ │
│ │ ☑️ Service_Terms.pdf                Draft      Jan 14, 2025     1 recipient  │ │
│ │ ☐ NDA_Template.pdf                  Completed  Jan 13, 2025     3 signatures │ │
│ │ ☑️ Employment_Contract.pdf          Draft      Jan 12, 2025     1 recipient  │ │
│ │ ☐ Partnership_Agreement.pdf         Sent       Jan 11, 2025     2 pending    │ │
│ │ ☐ Vendor_Agreement.pdf              Completed  Jan 10, 2025     1 signature  │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Status: 3 documents selected • Ready for bulk operations                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### All Documents Selected State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Document Library - All Selected                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─ Bulk Actions Bar (Active) ───────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ Select All (15 documents)    15 selected                                 │ │
│ │                                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│ │ │   Delete    │ │   Archive   │ │  Download   │ │Send (3 only)│            │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │ │
│ │                                                                             │ │
│ │ Note: Send only available for 3 draft documents                            │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Document List (All Selected) ────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ☑️ Contract_Agreement.pdf           Draft      Jan 15, 2025     2 recipients │ │
│ │ ☑️ Service_Terms.pdf                Draft      Jan 14, 2025     1 recipient  │ │
│ │ ☑️ NDA_Template.pdf                 Completed  Jan 13, 2025     3 signatures │ │
│ │ ☑️ Employment_Contract.pdf          Draft      Jan 12, 2025     1 recipient  │ │
│ │ ☑️ Partnership_Agreement.pdf        Sent       Jan 11, 2025     2 pending    │ │
│ │ ☑️ Vendor_Agreement.pdf             Completed  Jan 10, 2025     1 signature  │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Status: All 15 documents selected • Bulk operations ready                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bulk Delete Confirmation

### Delete Confirmation Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Confirm Bulk Delete                                                           X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ⚠️ You are about to permanently delete 3 documents                              │
│                                                                                 │
│ ┌─ Documents to be deleted ──────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ • Contract_Agreement.pdf - Draft (Jan 15, 2025)                            │ │
│ │ • Service_Terms.pdf - Draft (Jan 14, 2025)                                 │ │
│ │ • Employment_Contract.pdf - Draft (Jan 12, 2025)                           │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ⚠️ WARNING: This action cannot be undone                                        │ │
│                                                                                 │
│ To confirm deletion, type "DELETE" in the box below:                           │
│                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │   Delete    │ ← Disabled             │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Delete Confirmation - Ready to Delete

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Confirm Bulk Delete                                                           X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ⚠️ You are about to permanently delete 3 documents                              │
│                                                                                 │
│ ┌─ Documents to be deleted ──────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ • Contract_Agreement.pdf - Draft (Jan 15, 2025)                            │ │
│ │ • Service_Terms.pdf - Draft (Jan 14, 2025)                                 │ │
│ │ • Employment_Contract.pdf - Draft (Jan 12, 2025)                           │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ⚠️ WARNING: This action cannot be undone                                        │ │
│                                                                                 │
│ To confirm deletion, type "DELETE" in the box below:                           │
│                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ DELETE                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │   Delete    │ ← Active               │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bulk Status Change Interface

### Status Change Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Change Status - 5 Documents Selected                                         X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Change status for selected documents:                                           │
│                                                                                 │
│ ┌─ Current Status Summary ───────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ • 2 documents: Draft                                                        │ │
│ │ • 2 documents: Sent                                                         │ │
│ │ • 1 document: Completed                                                     │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ New Status:                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Archive                                                               ▼    │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ └── Available Options:                                                          │
│     • Archive (move to archived documents)                                     │
│     • Cancel (cancel sent documents)                                           │
│     • Reopen (reopen completed documents)                                      │
│                                                                                 │
│ ┌─ Status Change Preview ────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ 5 documents will be moved to "Archived" status                             │ │
│ │                                                                             │ │
│ │ • Contract_Agreement.pdf: Draft → Archived                                 │ │
│ │ • Service_Terms.pdf: Draft → Archived                                      │ │
│ │ • Partnership_Agreement.pdf: Sent → Archived                               │ │
│ │ • NDA_Template.pdf: Completed → Archived                                   │ │
│ │ • Vendor_Agreement.pdf: Completed → Archived                               │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │   Apply     │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bulk Download Interface

### Download Preparation Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Bulk Download - Prepare ZIP Archive                                          X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Preparing download for 4 completed documents:                                  │
│                                                                                 │
│ ┌─ Documents to Download ────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ NDA_Template.pdf (2.3 MB) - Completed                                    │ │
│ │ ✅ Partnership_Agreement.pdf (1.8 MB) - Completed                           │ │
│ │ ✅ Vendor_Agreement.pdf (3.1 MB) - Completed                                │ │
│ │ ✅ Client_Contract.pdf (2.2 MB) - Completed                                 │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Download Summary ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Total Documents: 4                                                          │ │
│ │ Total Size: 9.4 MB                                                          │ │
│ │ Estimated ZIP Size: ~8.1 MB                                                 │ │
│ │ Processing Time: ~15 seconds                                                │ │
│ │                                                                             │ │
│ │ ✅ Within size limits (500 MB max)                                          │ │
│ │ ✅ Within document limits (10 documents max)                                │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ZIP file will be named: "Documents_Export_2025-01-15.zip"                      │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │  Create ZIP │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Download Progress Interface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Creating ZIP Archive...                                                       X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Packaging documents for download:                                               │
│                                                                                 │
│ ┌─ Progress ──────────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ████████████████████████████░░░░░░░░░░░░░░ 65%                              │ │
│ │                                                                             │ │
│ │ Processing: Client_Contract.pdf (3 of 4)                                   │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ File Status ──────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ NDA_Template.pdf - Added to ZIP                                          │ │
│ │ ✅ Partnership_Agreement.pdf - Added to ZIP                                 │ │
│ │ ⏳ Client_Contract.pdf - Processing...                                      │ │
│ │ ⏳ Vendor_Agreement.pdf - Pending                                           │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Estimated time remaining: 8 seconds                                            │
│                                                                                 │
│                                 ┌─────────────┐                               │
│                                 │   Cancel    │                               │
│                                 └─────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Download Ready Interface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Download Ready! 🎉                                                             X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Your ZIP archive has been created successfully:                                │
│                                                                                 │
│ ┌─ Download Details ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ File: Documents_Export_2025-01-15.zip                                      │ │
│ │ Size: 8.1 MB                                                                │ │
│ │ Documents: 4 files                                                          │ │
│ │ Created: January 15, 2025 at 3:42 PM                                       │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Included Documents ───────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ NDA_Template.pdf (2.3 MB)                                                │ │
│ │ ✅ Partnership_Agreement.pdf (1.8 MB)                                       │ │
│ │ ✅ Client_Contract.pdf (3.1 MB)                                             │ │
│ │ ✅ Vendor_Agreement.pdf (2.2 MB)                                            │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                              ┌─────────────┐                                  │
│                              │  Download   │ ← Auto-download starts           │
│                              └─────────────┘                                  │
│                                                                                 │
│ ⏰ Download link expires in 24 hours                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bulk Send Interface

### Bulk Send Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Bulk Send - 3 Draft Documents                                                X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Send multiple documents for signing:                                            │
│                                                                                 │
│ ┌─ Documents Ready to Send ──────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ Contract_Agreement.pdf - 2 recipients configured                         │ │
│ │ ✅ Service_Terms.pdf - 1 recipient configured                               │ │
│ │ ✅ Employment_Contract.pdf - 1 recipient configured                         │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Send Summary ─────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Total Documents: 3                                                          │ │
│ │ Total Recipients: 4                                                         │ │
│ │ Total Emails: 4                                                             │ │
│ │                                                                             │ │
│ │ All documents have recipients configured ✅                                 │ │
│ │ All required fields are placed ✅                                           │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Email Template:                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Standard Invitation                                               ▼        │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                        ┌─────────────┐ ┌─────────────┐                        │
│                        │   Cancel    │ │ Send All    │                        │
│                        └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Bulk Send Progress

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Sending Documents...                                                          X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Bulk send in progress:                                                          │
│                                                                                 │
│ ┌─ Overall Progress ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ████████████████████░░░░░░░░░░░░░░░░░░░░ 67%                                │ │
│ │                                                                             │ │
│ │ Sending: 2 of 3 documents complete                                         │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Document Status ──────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ Contract_Agreement.pdf - Sent successfully (2 emails)                    │ │
│ │ ✅ Service_Terms.pdf - Sent successfully (1 email)                          │ │
│ │ ⏳ Employment_Contract.pdf - Sending... (1 email)                           │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Current: Sending Employment_Contract.pdf to john@company.com                    │
│                                                                                 │
│                                 ┌─────────────┐                               │
│                                 │   Cancel    │                               │
│                                 └─────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Interface

### Partial Failure Results

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Bulk Operation Results                                                        X │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Bulk send completed with some failures:                                        │
│                                                                                 │
│ ┌─ Results Summary ──────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ Successful: 2 documents                                                  │ │
│ │ ❌ Failed: 1 document                                                       │ │
│ │ 📧 Total emails sent: 3 of 4                                               │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─ Detailed Results ─────────────────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ ✅ Contract_Agreement.pdf - Sent successfully                               │ │
│ │    └── 2 emails delivered successfully                                     │ │
│ │                                                                             │ │
│ │ ✅ Service_Terms.pdf - Sent successfully                                    │ │
│ │    └── 1 email delivered successfully                                      │ │
│ │                                                                             │ │
│ │ ❌ Employment_Contract.pdf - Send failed                                    │ │
│ │    └── Error: Invalid email address (john@invalid-domain.com)              │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                               │
│ │Retry Failed │ │Fix & Retry  │ │    Close    │                               │
│ └─────────────┘ └─────────────┘ └─────────────┘                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Mobile Bulk Operations

### Mobile Bulk Selection

```
┌─────────────────────────────────┐
│ Documents - Bulk Select         │
├─────────────────────────────────┤
│                                 │
│ ☑️ Select All (8)   3 selected  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │☑️ Contract.pdf      Draft   │ │
│ │☑️ Terms.pdf         Draft   │ │
│ │☐ NDA.pdf           Complete│ │
│ │☑️ Employment.pdf    Draft   │ │
│ │☐ Partnership.pdf   Sent    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌── Bulk Actions ─────────────┐ │
│ │ Delete  Archive  Download   │ │
│ │                       Send  │ │
│ └─────────────────────────────┘ │
│                                 │
│      ┌─────────────────┐        │
│      │     Apply       │        │
│      └─────────────────┘        │
│                                 │
└─────────────────────────────────┘
```

This comprehensive bulk operations interface provides efficient multi-document management with clear progress tracking, error handling, and mobile compatibility while maintaining our established MVP focus and design consistency.
