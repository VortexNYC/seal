                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
     ║                        📋 DOCUMENT LIBRARY INTERFACE WIREFRAMES                               ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════════╝

## Main Document Library Views

### Pro Plan Document Library
[Mobile Viewport: 375px width with responsive component stacking]
[Desktop Viewport: 1200px width with multi-column layout]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/workspace/documents              ⚪ ⚫ 🔍 ≡           ║
║ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📄 Documents                                      [Button: variant="default" + Upload Document] ║
║                                                                                                  ║
║  [Input: variant="outline" placeholder="Search documents..."]  [Select: Sort Recent] [Toggle: List/Grid] ║
║                                                                                                  ║
║  📁 Folders                                                                                      ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ 📁 Legal Documents (8)    📁 Reports (5)       📁 Templates (3)                            ┃    ║
║  ┃ 📁 Active Contracts (12)  📁 HR Documents (4)  [Button: variant="ghost" + New Folder]     ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║  📋 Recent Documents                                                                             ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ ╭───────╮  📄 Service-Agreement.pdf    [Badge: variant="default" ✅ Completed]    [Button: size="sm"] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  3 pages • Legal Documents • 2 hours ago                                     ┃    ║
║  ┃ │ PAGE  │  [Badge: variant="outline" 🏷️ contract] [Badge: variant="outline" legal]                     ┃    ║
║  ┃ │  1/3  │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📊 Q1-Report.xlsx → PDF      [Badge: variant="secondary" 🔄 Pending]     [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📊   │  1 page • Reports • 1 day ago                                               ┃    ║
║  ┃ │ CHART │  [Badge: variant="outline" 🏷️ quarterly] [Badge: variant="outline" report]                   ┃    ║
║  ┃ │       │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📝 Meeting-Notes.docx → PDF  [Badge: variant="secondary" 📝 Draft]       [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📝   │  2 pages • General • 3 days ago                                             ┃    ║
║  ┃ │ TEXT  │  [Badge: variant="outline" 🏷️ meeting] [Badge: variant="outline" notes]                      ┃    ║
║  ┃ │       │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║                               [Button: variant="outline" Load More Documents]                   ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Free Plan Document Library
[Mobile Viewport: 375px with usage indicators prominent]
[Desktop Viewport: 1200px with usage tracking sidebar]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/workspace/documents              ⚪ ⚫ 🔍 ≡           ║
║ 🏠 Seal       [Badge: variant="secondary" 🆓 Free Plan]    Workspace: My Workspace ▼   👤 Jane Smith ▼   ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📄 Documents                           [Progress: value={8} max={10} className="w-32"] 8/10 documents used ║
║                                      [Button: variant="default" + Upload Document] 2 remaining  ║
║                                                                                                  ║
║  [Input: variant="outline" placeholder="Search documents..."  [Select: Sort Recent] [Toggle: List/Grid]  ║
║                                                                                                  ║
║  📁 Folders                                                                                      ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ 📁 Contracts (3)      📁 Personal (2)      📁 Work (3)                                      ┃    ║
║  ┃ [Button: variant="ghost" + New Folder]                                                       ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║  📋 Recent Documents                                                                             ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ ╭───────╮  📄 Contract.pdf             [Badge: variant="default" ✅ Completed]    [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  3 pages • Contracts • 2 days ago                                           ┃    ║
║  ┃ │ PAGE  │  [Badge: variant="outline" 🏷️ contract]                                    ┃    ║
║  ┃ │  1/3  │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📄 Invoice.pdf              [Badge: variant="secondary" 🔄 Pending]     [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  1 page • Work • 1 week ago                                                 ┃    ║
║  ┃ │ TEXT  │  [Badge: variant="outline" 🏷️ invoice]                                    ┃    ║
║  ┃ │       │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║  [Alert: variant="default" icon="💡"] Tip: 2 documents remaining this month (resets Feb 15)      ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Free Plan - Limit Reached
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal       🆓 Free Plan    Workspace: My Workspace ▼   👤 Jane Smith ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📄 Documents                               📊 10/10 documents used         │
│                           🚫 Upload Limit Reached (resets Feb 15)          │
│                                                                             │
│  🔍 [Search documents...]                    📊 Sort: Recent ▼  📋 List 📱  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      📊 Document Limit Reached                     │    │
│  │                                                                     │    │
│  │              You've used all 10 documents this month               │    │
│  │             📄 Your documents remain accessible • Limit resets Feb 15   │    │
│  │                                                                     │    │
│  │              💡 You can still manage existing documents            │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  📋 Your Documents (manage, view, download available)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📄 Contract.pdf              ✅ Completed         [👁️] [📥] [🗑️]     │    │
│  │ 📄 Invoice.pdf               🔄 Pending          [👁️] [📥] [🗑️]     │    │
│  │ 📄 Agreement.pdf             📝 Draft            [👁️] [📥] [🗑️]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Folder and Organization Views

### Folder Navigation View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📄 Documents > 📁 Legal Documents                     [+ Upload Document]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ← Back to All Documents                           📊 Sort: Name ▼  📋 List │
│                                                                             │
│  🔍 [Search in Legal Documents...]                                          │
│                                                                             │
│  📋 Documents in Legal Documents (8 documents)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-Agreement.pdf    ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • 2 hours ago • John Doe                          │    │
│  │ │ PAGE  │  🏷️ contract, service, legal                              │    │
│  │ │  1/3  │                                                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 NDA-Template.pdf         📝 Draft       [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  2 pages • 1 week ago • Jane Smith                        │    │
│  │ │ TEMP  │  🏷️ nda, template, legal                                  │    │
│  │ │       │                                                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 Employment-Contract.pdf  ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  5 pages • 2 weeks ago • John Doe                         │    │
│  │ │ PAGE  │  🏷️ employment, contract, legal                          │    │
│  │ │  1/5  │                                                           │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                                   [Load More Documents]                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Create New Folder Dialog
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           📁 Create New Folder                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Folder Name: [Client Contracts                      ]                     │
│                                                                             │
│  Parent Folder: [📁 Legal Documents ▼]                                     │
│                                                                             │
│  📋 Folder Structure Preview:                                              │
│  📁 Legal Documents                                                         │
│    └── 📁 Client Contracts  ← New folder                                   │
│                                                                             │
│                                                                             │
│                                    [Cancel]              [Create Folder]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Search and Filter Interface

### Search Results View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📄 Documents                                         [+ Upload Document]   │
│                                                                             │
│  🔍 [contract                             ] 🔎 [Clear Search]               │
│                                                                             │
│  🎯 Search Results for "contract" (5 documents found)                      │
│                                                                             │
│  📊 Filters: [All Status ▼] [All Folders ▼] [All Tags ▼] [All Types ▼]     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-**Contract**.pdf  ✅ Completed  [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • 📁 Legal Documents                               │    │
│  │ │ PAGE  │  Contains: "service **contract**", "**contract** terms"     │    │
│  │ │  1/3  │  🏷️ **contract**, service, legal                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 Employment-**Contract**.pdf ✅ Completed [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  5 pages • 📁 Legal Documents                               │    │
│  │ │ PAGE  │  Contains: "employment **contract**", "**contractor**"      │    │
│  │ │  1/5  │  🏷️ employment, **contract**, legal                        │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 **Contract**-Template.pdf  📝 Draft     [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  2 pages • 📁 Templates                                     │    │
│  │ │ TEMP  │  Contains: "**contract** template", "standard **contract**" │    │
│  │ │       │  🏷️ template, **contract**                                 │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                                     [Load More Results]                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Advanced Filter Panel
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Advanced Search & Filters                                          ❌   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📝 Search Query: [contract                               ]                 │
│                                                                             │
│  📊 Document Status:                                                        │
│  ☑️ Draft         ☑️ Pending        ☑️ Completed                           │
│                                                                             │
│  📁 Folders:                                                               │
│  ☑️ All Folders                                                            │
│  ☐ Legal Documents    ☐ Reports    ☐ Templates                            │
│  ☐ HR Documents       ☐ Archived                                          │
│                                                                             │
│  🏷️ Tags:                                                                   │
│  [contract] [legal] [+ Add tag filter]                                     │
│                                                                             │
│  📅 Date Range:                                                             │
│  Created: [Last 30 days ▼]                                                │
│  Modified: [Any time ▼]                                                    │
│                                                                             │
│  📄 Document Type:                                                          │
│  ☑️ PDF    ☑️ Converted Documents    ☑️ Templates                          │
│                                                                             │
│                              [Clear Filters]    [Apply Filters]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Document Context Menu and Actions

### Document Context Menu
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌───────┐  📄 Service-Agreement.pdf    ✅ Comp┌─────────────────────────────┐│
│ │  📄   │  3 pages • Legal Documents • 2 hour│ 👁️ Preview Document         ││
│ │ PAGE  │  🏷️ contract, service, legal      │ 📝 Edit Signature Fields   ││
│ │  1/3  │                               │ ──────────────────────────── ││
│ └───────┘                               │ 👥 Share Document           ││
│                                         │ 🔗 Create Sharing Link      ││
│ ┌───────┐  📄 NDA-Template.pdf         │ 📧 Send for Signature       ││
│ │  📄   │  2 pages • 1 week ago • Jane │ ──────────────────────────── ││
│ │ TEMP  │  🏷️ nda, template, legal     │ 📁 Move to Folder           ││
│ │       │                               │ ✏️ Rename Document           ││
│ └───────┘                               │ 🏷️ Edit Tags                ││
│                                         │ ──────────────────────────── ││
│                                         │ 📥 Download PDF             ││
│                                         │ 📋 Document Details         ││
│                                         │ ──────────────────────────── ││
│                                         │ 🗑️ Delete Document          ││
│                                         └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Move to Folder Dialog
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             📁 Move Document                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Move "Service-Agreement.pdf" to folder:                                   │
│                                                                             │
│  📁 Workspace Folders                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ○ 📁 Legal Documents (current location)                             │    │
│  │ ● 📁 Active Contracts                                               │    │
│  │ ○ 📁 Templates                                                      │    │
│  │ ○ 📁 Reports                                                        │    │
│  │ ○ 📁 HR Documents                                                   │    │
│  │ ○ 📁 Archived                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                      [+ Create New Folder]                                 │
│                                                                             │
│                                    [Cancel]              [Move Document]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tag Management Dialog
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            🏷️ Manage Document Tags                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Document: Service-Agreement.pdf                                           │
│                                                                             │
│  🏷️ Current Tags:                                                           │
│  [contract ❌] [service ❌] [legal ❌]                                       │
│                                                                             │
│  ➕ Add New Tag:                                                            │
│  [client                                ] [Add Tag]                        │
│                                                                             │
│  📋 Suggested Tags:                                                         │
│  [+ agreement] [+ business] [+ 2024] [+ important]                         │
│                                                                             │
│  🏷️ All Workspace Tags:                                                     │
│  [+ contract] [+ legal] [+ template] [+ report] [+ meeting]                │
│  [+ invoice] [+ hr] [+ client] [+ draft] [+ final]                         │
│                                                                             │
│                                    [Cancel]              [Save Tags]       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Document Library

### Mobile Library View
```
┌─────────────────────────────┐
│ 🏠 Seal  Acme Corp ▼  ☰    │
├─────────────────────────────┤
│                             │
│ 📄 Documents          [+]   │
│                             │
│ 🔍 [Search...]              │
│                             │
│ 📁 Folders                  │
│ ┌─────────────────────────┐ │
│ │📁 Legal (8) 📁 Reports  │ │
│ │📁 HR (4)   📁 Templates │ │
│ └─────────────────────────┘ │
│                             │
│ 📋 Recent Documents         │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Contract.pdf  [⚙️]│ │
│ ││📄│✅ Completed • 2h    │ │
│ │└──┘Legal • contract     │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📊 Report.xlsx    [⚙️]│ │
│ ││📊│🔄 Pending • 1d      │ │
│ │└──┘Reports • quarterly  │ │
│ └─────────────────────────┘ │
│                             │
│         [Load More]         │
│                             │
└─────────────────────────────┘
```

### Mobile Navigation Menu (Hamburger)
```
┌─────────────────────────────┐
│ 🏠 Seal  Acme Corp ▼  ☰    │ ← Hamburger tapped
├─────────────────────────────┤
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │ 📄 Documents to Sign    │ │ ← Primary for signers
│ │                         │ │
│ │ ──────────────────────  │ │
│ │                         │ │
│ │ 📋 Recent Documents     │ │
│ │                         │ │
│ │ 🔍 Search Documents     │ │
│ │                         │ │
│ │ 📁 Browse Folders       │ │
│ │                         │ │
│ │ ──────────────────────  │ │
│ │                         │ │
│ │ ⚙️ Account Settings     │ │
│ │                         │ │
│ │ 📊 Billing (Pro Plan)   │ │
│ │                         │ │
│ │ ❓ Help & Support       │ │
│ │                         │ │
│ │ ──────────────────────  │ │
│ │                         │ │
│ │ 🔐 Sign Out             │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│         [Tap to close]      │
│                             │
└─────────────────────────────┘
```

### Mobile Menu - Documents to Sign Priority
```
┌─────────────────────────────┐
│ Documents to Sign     [✕]  │
├─────────────────────────────┤
│                             │
│ ✍️ Ready for Your Signature │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Service Agreement │ │
│ ││📄│From: Sarah Johnson  │ │
│ │└──┘⏰ Due in 3 days     │ │
│ │    [Review & Sign]      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 NDA Document     │ │
│ ││📄│From: Mike Chen      │ │
│ │└──┘⏰ Due in 1 week     │ │
│ │    [Review & Sign]      │ │
│ └─────────────────────────┘ │
│                             │
│ 📋 Completed Signatures     │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Contract.pdf     │ │
│ ││✅│✅ Signed yesterday   │ │
│ │└──┘[View Document]      │ │
│ └─────────────────────────┘ │
│                             │
│         [◀ Back]            │
│                             │
└─────────────────────────────┘
```

### Mobile Search Results
```
┌─────────────────────────────┐
│ ← 🔍 "contract"        [❌] │
├─────────────────────────────┤
│                             │
│ 🎯 3 results found          │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Service-          │ │
│ ││📄│   **Contract**.pdf  │ │
│ │└──┘✅ Legal • 2h ago    │ │
│ │    **contract**, service│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Employment-       │ │
│ ││📄│   **Contract**.pdf  │ │
│ │└──┘✅ Legal • 2w ago    │ │
│ │    employment, **contract** │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 **Contract**-     │ │
│ ││📄│   Template.pdf      │ │
│ │└──┘📝 Templates • 1m ago│ │
│ │    template, **contract** │ │
│ └─────────────────────────┘ │
│                             │
└─────────────────────────────┘
```

---

## Mobile Bottom Sheets

### Document Quick Actions Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │ ← Document [⚙️] tapped
├─────────────────────────────┤
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Contract.pdf  [⚙️]│ │ ← This document's menu
│ ││📄│✅ Completed • 2h    │ │
│ │└──┘Legal • contract     │ │
│ └─────────────────────────┘ │
│                             │
│ ╔═════════════════════════╗ │ ← Bottom sheet appears
│ ║ Contract.pdf            ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 👁️ View Document        ║ │
│ ║                         ║ │
│ ║ 📥 Download PDF         ║ │
│ ║                         ║ │
│ ║ 🔗 Share Link           ║ │
│ ║                         ║ │
│ ║ ─────────────────────   ║ │
│ ║                         ║ │
│ ║ 📁 Move to Folder       ║ │
│ ║                         ║ │
│ ║ 🗑️ Delete Document      ║ │ ← Destructive action at bottom
│ ║                         ║ │
│ ╚═════════════════════════╝ │
│         [Tap to close]      │
└─────────────────────────────┘
```

### Move to Folder Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │
├─────────────────────────────┤
│                             │
│                             │
│                             │
│                             │
│                             │
│ ╔═════════════════════════╗ │
│ ║ Move to Folder          ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 📁 Legal Documents ○    ║ │ ← Current folder
│ ║                         ║ │
│ ║ 📁 Active Contracts ●   ║ │ ← Selected destination
│ ║                         ║ │
│ ║ 📁 Templates ○          ║ │
│ ║                         ║ │
│ ║ 📁 Reports ○            ║ │
│ ║                         ║ │
│ ║ 📁 HR Documents ○       ║ │
│ ║                         ║ │
│ ║ ─────────────────────   ║ │
│ ║                         ║ │
│ ║ [Cancel] [Move Here]    ║ │
│ ║                         ║ │
│ ╚═════════════════════════╝ │
└─────────────────────────────┘
```

### Delete Confirmation Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │
├─────────────────────────────┤
│                             │
│                             │
│                             │
│                             │
│                             │
│                             │
│ ╔═════════════════════════╗ │
│ ║ Delete Document         ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 🗑️ Delete Contract.pdf? ║ │
│ ║                         ║ │
│ ║ This action cannot be   ║ │
│ ║ undone. The document    ║ │
│ ║ will be permanently     ║ │
│ ║ deleted.                ║ │
│ ║                         ║ │
│ ║ [Cancel] [🗑️ Delete]    ║ │
│ ║                         ║ │
│ ╚═════════════════════════╝ │
└─────────────────────────────┘
```

### Filter/Sort Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │
├─────────────────────────────┤
│                             │
│ 📊 Sort: Recent ▼  📋 List  │ ← Sort button tapped
│                             │
│                             │
│ ╔═════════════════════════╗ │
│ ║ Sort & Filter           ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 📊 Sort by:             ║ │
│ ║ ● Recent                ║ │
│ ║ ○ Name A-Z              ║ │
│ ║ ○ Name Z-A              ║ │
│ ║ ○ Size                  ║ │
│ ║ ○ Status                ║ │
│ ║                         ║ │
│ ║ 📋 Show:                ║ │
│ ║ ☑️ Completed            ║ │
│ ║ ☑️ Pending              ║ │
│ ║ ☑️ Draft                ║ │
│ ║                         ║ │
│ ║ [Reset] [Apply]         ║ │
│ ║                         ║ │
│ ╚═════════════════════════╝ │
└─────────────────────────────┘
```

### Share Document Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │
├─────────────────────────────┤
│                             │
│                             │
│                             │
│                             │
│ ╔═════════════════════════╗ │
│ ║ Share Contract.pdf      ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 🔗 Create sharing link  ║ │
│ ║    Anyone with link     ║ │
│ ║                         ║ │
│ ║ 📧 Send via email       ║ │
│ ║    Enter email address  ║ │
│ ║                         ║ │
│ ║ 📱 Share to app         ║ │
│ ║    Messages, WhatsApp   ║ │
│ ║                         ║ │
│ ║ 🚀 Send for signature   ║ │
│ ║    Create signing flow  ║ │
│ ║                         ║ │
│ ╚═════════════════════════╝ │
│         [Cancel]            │
└─────────────────────────────┘
```

### Document Upload Type Bottom Sheet
```
┌─────────────────────────────┐
│ 📄 Documents          [+]   │ ← Upload button tapped
├─────────────────────────────┤
│                             │
│                             │
│                             │
│                             │
│ ╔═════════════════════════╗ │
│ ║ Add Document            ║ │
│ ╠═════════════════════════╣ │
│ ║                         ║ │
│ ║ 📄 Upload File          ║ │
│ ║    From device storage  ║ │
│ ║                         ║ │
│ ║ 📸 Scan with Camera     ║ │
│ ║    Document → PDF       ║ │
│ ║                         ║ │
│ ║ 📝 Create from Template ║ │
│ ║    Use existing format ║ │
│ ║                         ║ │
│ ╚═════════════════════════╝ │
│         [Cancel]            │
└─────────────────────────────┘
```

---

## Bulk Operations Confirmations

### Bulk Delete Documents Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🗑️ Delete 7 Documents                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │        Are you sure you want to delete these 7 documents?              │ │
│ │                                                                         │ │
│ │ ⚠️ **This action cannot be undone**                                     │ │
│ │                                                                         │ │
│ │ **Documents to be deleted:**                                            │ │
│ │ ✅ Service-Agreement.pdf                                                │ │
│ │ ✅ Contract-Template.docx                                               │ │
│ │ ✅ Quarterly-Report.xlsx                                                │ │
│ │ ✅ Meeting-Notes.pdf                                                    │ │
│ │ ✅ Invoice-Template.pdf                                                 │ │
│ │ ✅ Employee-Handbook.docx                                               │ │
│ │ ✅ Project-Proposal.pdf                                                 │ │
│ │                                                                         │ │
│ │ **What will be lost:**                                                  │ │
│ │ • All document content and metadata                                     │ │
│ │ • Signature workflows and field configurations                         │ │
│ │ • Document sharing permissions and links                               │ │
│ │ • Version history and audit trails                                      │ │
│ │                                                                         │ │
│ │ **Note:** Any active signing workflows will be cancelled               │ │
│ │                                                                         │ │
│ │ Type "DELETE 7 DOCUMENTS" to confirm:                                   │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │                                                                     │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]  [📦 Archive Instead]  [🗑️ Permanently Delete All]               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bulk Move Documents Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                      📁 Move 5 Documents                                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │     Move 5 documents to "Active Contracts" folder?                     │ │
│ │                                                                         │ │
│ │ **Documents to move:**                                                  │ │
│ │ ✅ Service-Agreement.pdf                                                │ │
│ │ ✅ Contract-Template.docx                                               │ │
│ │ ✅ Employee-Contract.pdf                                                │ │
│ │ ✅ Vendor-Agreement.pdf                                                 │ │
│ │ ✅ Partnership-Contract.docx                                            │ │
│ │                                                                         │ │
│ │ **From:** 📁 Legal Documents                                           │ │
│ │ **To:** 📁 Active Contracts                                            │ │
│ │                                                                         │ │
│ │ **Impact:**                                                             │ │
│ │ • Documents will be moved to the new folder                            │ │
│ │ • Sharing permissions will remain unchanged                            │ │
│ │ • Any bookmarked links will continue to work                           │ │
│ │ • Folder organization will be updated                                   │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]                                           [📁 Move Documents]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

These wireframes provide comprehensive coverage of the document library functionality while maintaining clean design principles and proper freemium model integration throughout the experience.