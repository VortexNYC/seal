                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
     ║                           🔍 SEARCH & FILTERING WIREFRAMES                                    ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════════╝

## Main Search Interface

### Global Search Bar
[Mobile Viewport: 375px with collapsible filters]
[Desktop Viewport: 1200px with persistent filter sidebar]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents/search                 ⚪ ⚫ 🔍 ≡           ║
║ 🏠 Seal                                    👤 John Doe    [Badge: variant="default"] 🔄 Pro Plan ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📄 Documents                                         [Button: variant="default" + Upload Document] ║
║                                                                                                  ║
║  [Input: variant="outline" placeholder="Search documents..." className="w-full"] [Button: variant="outline" icon="🔎"] [Button: variant="ghost" 🎛️ Filters] ║
║                                                                                                  ║
║  📋 All Documents (32 documents)                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ ╭───────╮  📄 Service-Agreement.pdf    [Badge: variant="default" ✅ Completed]    [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  3 pages • Legal Documents • 2 hours ago                                     ┃    ║
║  ┃ │ PAGE  │  [Badge: variant="outline" 🏷️ contract] [Badge: variant="outline" service] [Badge: variant="outline" legal] ┃    ║
║  ┃ │  1/3  │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📊 Q1-Report.xlsx → PDF      [Badge: variant="secondary" 🔄 Pending]     [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📊   │  1 page • Reports • 1 day ago                                               ┃    ║
║  ┃ │ CHART │  [Badge: variant="outline" 🏷️ quarterly] [Badge: variant="outline" report]        ┃    ║
║  ┃ │       │                                                                             ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Active Search with Real-time Results
[Component: Live search with highlighted matches and result metrics]
[Mobile Viewport: Simplified result cards with swipe actions]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║  [Input: value="contract" className="w-full"] [Button: variant="ghost" icon="❌"] [Button: variant="outline" 🎛️ Filters] ║
║                                                                                                  ║
║  [Badge: variant="default" icon="🎯"] Search Results for "contract" (5 documents found)        ║
║                                                                                                  ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ ╭───────╮  📄 Service-**Contract**.pdf  [Badge: variant="default" ✅ Completed]  [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  3 pages • 📁 Legal Documents • 2 hours ago                                  ┃    ║
║  ┃ │ PAGE  │  Contains: "service **contract**", "**contract** terms"                       ┃    ║
║  ┃ │  1/3  │  [Badge: variant="outline" **contract**] [Badge: variant="outline" service] [Badge: variant="outline" legal] ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📄 Employment-**Contract**.pdf [Badge: variant="default" ✅ Completed] [Button] [Button] [DropdownMenu] ┃    ║
║  ┃ │  📄   │  5 pages • 📁 Legal Documents • 1 week ago                                   ┃    ║
║  ┃ │ PAGE  │  Contains: "employment **contract**", "**contractor**"                        ┃    ║
║  ┃ │  1/5  │  [Badge: variant="outline" employment] [Badge: variant="outline" **contract**] [Badge: variant="outline" legal] ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┃                                                                                       ┃    ║
║  ┃ ╭───────╮  📝 **Contract**-Template.docx → PDF [Button] [Button] [DropdownMenu]         ┃    ║
║  ┃ │  📝   │  2 pages • 📁 Templates • 2 weeks ago                                        ┃    ║
║  ┃ │ TEMP  │  Contains: "**contract** template", "standard **contract**"                   ┃    ║
║  ┃ │       │  [Badge: variant="outline" template] [Badge: variant="outline" **contract**]                    ┃    ║
║  ┃ ╰───────╯                                                                             ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║                                   [Button: variant="outline"] Load More Results                  ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Search with No Results
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [xyz123 document                      ] ❌ [🎛️ Filters]                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │                      🔍 No documents found                          │    │
│  │                                                                     │    │
│  │              No documents match "xyz123 document"                  │    │
│  │                                                                     │    │
│  │                       Try these suggestions:                       │    │
│  │                   • Check your spelling                            │    │
│  │                   • Use fewer or different keywords                │    │
│  │                   • Remove filters to see more documents           │    │
│  │                   • Search in all folders                          │    │
│  │                                                                     │    │
│  │                        [Clear Search]                              │    │
│  │                                                                     │    │
│  │                        [Remove All Filters]                        │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Advanced Filter Interface

### Filter Panel Expanded
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [contract                             ] ❌ [🎛️ Filters ▼]               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          🎛️ Filters                                │    │
│  │                                                                     │    │
│  │  📊 Status:                                                         │    │
│  │  ☑️ Draft (8)    ☑️ Pending (12)    ☑️ Completed (15)              │    │
│  │                                                                     │    │
│  │  📁 Folders:                                                        │    │
│  │  [All Folders ▼]                                                    │    │
│  │                                                                     │    │
│  │  🏷️ Tags:                                                           │    │
│  │  [contract ❌] [legal ❌] [+ Add tag]                               │    │
│  │                                                                     │    │
│  │  📅 Date Range:                                                     │    │
│  │  Created: [Last 30 days ▼]                                         │    │
│  │                                                                     │    │
│  │  📄 Document Type:                                                  │    │
│  │  ☑️ PDF    ☑️ Converted    ☑️ Templates                            │    │
│  │                                                                     │    │
│  │                      [Clear All]        [Apply Filters]            │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  🎯 Search Results for "contract" with filters (3 of 5 documents)          │
│  Active: 📊 All Status • 🏷️ contract, legal • 📅 Last 30 days              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Folder Filter Dropdown
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📁 Folders:                                                                │
│  [All Folders ▼]              ┌─────────────────────────────────────────┐   │
│                                │ ☑️ All Folders (32)                     │   │
│                                │ ──────────────────────────────────────── │   │
│                                │ ☐ 📁 Legal Documents (8)               │   │
│                                │ ☐ 📁 Reports (5)                       │   │
│                                │ ☐ 📁 Templates (3)                     │   │
│                                │ ☐ 📁 HR Documents (4)                  │   │
│                                │ ☐ 📁 Active Contracts (12)             │   │
│                                └─────────────────────────────────────────┘   │
│                                                                             │
│  🏷️ Tags:                                                                   │
│  [contract ❌] [legal ❌] [+ Add tag]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Date Range Filter
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📅 Date Range:                                                             │
│  Created: [Last 30 days ▼]    ┌─────────────────────────────────────────┐   │
│                                │ ● Last 30 days                          │   │
│                                │ ○ Last 7 days                           │   │
│                                │ ○ This month                            │   │
│                                │ ○ Last 3 months                        │   │
│                                │ ○ This year                             │   │
│                                │ ──────────────────────────────────────── │   │
│                                │ ○ Custom date range                     │   │
│                                │   From: [Jan 1, 2024 ▼]                │   │
│                                │   To:   [Jan 31, 2024 ▼]               │   │
│                                └─────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Folder-Scoped Search

### Search Within Specific Folder
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📄 Documents > 📁 Legal Documents                     [+ Upload Document]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔍 [Search in Legal Documents...            ] 🔎 [🎛️ Filters]             │
│                                                                             │
│  📋 Documents in Legal Documents (8 documents)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-Agreement.pdf    ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • 2 hours ago • John Doe                          │    │
│  │ │ PAGE  │  🏷️ contract, service, legal                              │    │
│  │ │  1/3  │                                                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 Employment-Contract.pdf  ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  5 pages • 1 week ago • Jane Smith                        │    │
│  │ │ PAGE  │  🏷️ employment, contract, legal                          │    │
│  │ │  1/5  │                                                           │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                             💡 Search all folders instead?                  │
│                                   [Search Everywhere]                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Folder-Scoped Search Results
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📄 Documents > 📁 Legal Documents                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔍 [agreement                            ] ❌ [🎛️ Filters]                 │
│                                                                             │
│  🎯 Search Results in Legal Documents for "agreement" (2 documents found)  │
│  💡 Search all folders to find 3 more matches → [Search Everywhere]        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-**Agreement**.pdf ✅ Completed  [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • 📁 Legal Documents • 2 hours ago                │    │
│  │ │ PAGE  │  Contains: "service **agreement**", "**agreement** terms"   │    │
│  │ │  1/3  │  🏷️ contract, service, legal                              │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 NDA-**Agreement**.pdf     📝 Draft       [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  2 pages • 📁 Legal Documents • 3 days ago                 │    │
│  │ │ PAGE  │  Contains: "non-disclosure **agreement**"                  │    │
│  │ │  1/2  │  🏷️ nda, **agreement**, legal                             │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tag-Based Filtering

### Tag Filter Selection
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏷️ Tags:                                                                   │
│  [contract ❌] [+ Add tag]     ┌─────────────────────────────────────────┐   │
│                                │ 🔍 [Search tags...]                     │   │
│                                │                                         │   │
│                                │ 📈 Popular Tags:                        │   │
│                                │ ☑️ contract (15)    ☐ legal (12)       │   │
│                                │ ☐ report (8)       ☐ template (6)      │   │
│                                │ ☐ meeting (5)      ☐ invoice (4)       │   │
│                                │                                         │   │
│                                │ 📋 All Tags:                            │   │
│                                │ ☐ agreement (7)    ☐ business (3)      │   │
│                                │ ☐ client (9)       ☐ draft (11)        │   │
│                                │ ☐ final (6)        ☐ hr (4)            │   │
│                                │ ☐ important (8)    ☐ quarterly (3)     │   │
│                                │                                         │   │
│                                │              [Apply Tags]               │   │
│                                └─────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Tag Filter Results
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [                                     ] ❌ [🎛️ Filters ▼]               │
│                                                                             │
│  🎯 Documents with tags: contract, legal (4 documents found)               │
│  Active: 🏷️ contract, legal                                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-Agreement.pdf    ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • Legal Documents • 2 hours ago                   │    │
│  │ │ PAGE  │  🏷️ contract, service, **legal**                          │    │
│  │ │  1/3  │                                                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 Employment-Contract.pdf  ✅ Completed    [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  5 pages • Legal Documents • 1 week ago                   │    │
│  │ │ PAGE  │  🏷️ employment, **contract**, **legal**                  │    │
│  │ │  1/5  │                                                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 NDA-Agreement.pdf        📝 Draft       [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  2 pages • Legal Documents • 3 days ago                   │    │
│  │ │ PAGE  │  🏷️ nda, **contract**, **legal**                         │    │
│  │ │  1/2  │                                                           │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Search Result Management

### Search Result Sorting
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [contract                             ] ❌ [🎛️ Filters]                 │
│                                                                             │
│  🎯 Search Results for "contract" (5 documents found)                      │
│  📊 Sort: [Relevance ▼] [Date ▼] [Name ▼] [Status ▼]                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📄 Service-**Contract**.pdf  ✅ Completed  [👁️] [📝] [⚙️] │    │
│  │ │  📄   │  3 pages • Legal Documents • 2 hours ago                   │    │
│  │ │ PAGE  │  🎯 High relevance - 5 matches                             │    │
│  │ │  1/3  │  🏷️ **contract**, service, legal                           │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📝 **Contract**-Template.docx → PDF [👁️] [📝] [⚙️]       │    │
│  │ │  📝   │  2 pages • Templates • 2 weeks ago                         │    │
│  │ │ TEMP  │  🎯 Medium relevance - 3 matches                          │    │
│  │ │       │  🏷️ template, **contract**                                 │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Search with Quick Actions
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 Search Results for "quarterly report" (3 documents found)              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ┌───────┐  📊 Q1-**Quarterly**-**Report**.xlsx→PDF [👁️] [📝] [⚙️]   │    │
│  │ │  📊   │  1 page • Reports • 1 day ago                              │    │
│  │ │ CHART │  🏷️ **quarterly**, **report**                             │    │
│  │ │       │  📧 [Send for Signature] 📥 [Download] 👥 [Share]          │    │
│  │ └───────┘                                                           │    │
│  │                                                                     │    │
│  │ ┌───────┐  📄 Q4-**Quarterly**-**Report**.pdf   ✅ Completed       │    │
│  │ │  📄   │  8 pages • Reports • 3 months ago                         │    │
│  │ │ PAGE  │  🏷️ **quarterly**, **report**, 2023                      │    │
│  │ │  1/8  │  📧 [Send for Signature] 📥 [Download] 👥 [Share]          │    │
│  │ └───────┘                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Search Interface

### Mobile Search View
```
┌─────────────────────────────┐
│ 🔍 [Search docs...]    [🎛️] │
├─────────────────────────────┤
│                             │
│ 🎯 "contract" (3 found)     │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Service-          │ │
│ ││📄│   **Contract**.pdf  │ │
│ │└──┘✅ Legal • 2h ago    │ │
│ │    **contract**, service│ │
│ │                    [⚙️] │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📄 Employment-       │ │
│ ││📄│   **Contract**.pdf  │ │
│ │└──┘✅ Legal • 1w ago    │ │
│ │    **contract**, legal  │ │
│ │                    [⚙️] │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │┌──┐📝 **Contract**-     │ │
│ ││📝│   Template.docx     │ │
│ │└──┘📝 Templates • 2w ago│ │
│ │    template, **contract** │
│ │                    [⚙️] │ │
│ └─────────────────────────┘ │
│                             │
│         [Load More]         │
│                             │
└─────────────────────────────┘
```

### Mobile Filter Panel
```
┌─────────────────────────────┐
│ 🎛️ Filters            [❌] │
├─────────────────────────────┤
│                             │
│ 📊 Status                   │
│ ☑️ Draft  ☑️ Pending        │
│ ☑️ Completed                │
│                             │
│ 📁 Folder                   │
│ [All Folders ▼]             │
│                             │
│ 🏷️ Tags                     │
│ [contract ❌] [legal ❌]     │
│ [+ Add tag]                 │
│                             │
│ 📅 Date                     │
│ [Last 30 days ▼]            │
│                             │
│       [Clear All]           │
│                             │
│      [Apply Filters]        │
│                             │
└─────────────────────────────┘
```

---

## Advanced Search States

### Search Loading State
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [complex search query with many terms] 🔎 [🎛️ Filters]                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │                        🔄 Searching...                              │    │
│  │                                                                     │    │
│  │                   Finding documents that match                      │    │
│  │                  "complex search query with many terms"            │    │
│  │                                                                     │    │
│  │                  ██████████████████░░░░                            │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Search Error State
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 [contract terms agreement            ] ❌ [🎛️ Filters]                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │                       ⚠️ Search Error                              │    │
│  │                                                                     │    │
│  │              Unable to complete search request                      │    │
│  │              Please check your connection and try again             │    │
│  │                                                                     │    │
│  │                        [Retry Search]                               │    │
│  │                                                                     │    │
│  │                      [Clear Search & Start Over]                    │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

These wireframes provide comprehensive coverage of the search and filtering functionality while maintaining clean design principles, fast performance indicators, and seamless integration with the document organization features we've built.