# Sender Dashboard - Main Interface Wireframe

## Dashboard Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [🏠 Home] [📄 Documents] [👥 Workspaces] [⚙️ Settings] [User ▼] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      📊 SENDER DASHBOARD                        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │              📈 DOCUMENT OVERVIEW                           │ │
│ │                                                             │ │
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │ │
│ │ │ DRAFT   │ │  SENT   │ │COMPLETED│ │EXPIRED  │           │ │
│ │ │   12    │ │   8     │ │   45    │ │   2     │           │ │
│ │ │ 📝 Edit │ │ 📤 View │ │ ⬇️ Down │ │ 🔄 Renew│           │ │
│ │ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │   📋 RECENT ACTIVITY │  │     ⭐ PRIORITY DOCUMENTS         │ │
│ │                      │  │                                   │ │
│ │ 🔵 Contract.pdf      │  │ 🔴 URGENT: NDA expires in 2 days │ │
│ │    Signed by John    │  │ 📄 Employee_Contract.pdf          │ │
│ │    2 hours ago       │  │ ┌─────────┬─────────┬───────────┐ │ │
│ │                      │  │ │📤 Remind│ 👁️ View │ ⏰ Extend │ │ │
│ │ 🟡 Invoice_Q4.pdf    │  │ └─────────┴─────────┴───────────┘ │ │
│ │    Viewed by Client  │  │                                   │ │
│ │    4 hours ago       │  │ 🟡 MEDIUM: Service Agreement     │ │
│ │                      │  │ 📄 Service_Agreement_2024.pdf    │ │
│ │ 🟢 Terms.pdf         │  │ ┌─────────┬─────────┬───────────┐ │ │
│ │    Sent to vendor    │  │ │📤 Remind│ 👁️ View │ 📋 Details│ │ │
│ │    Yesterday         │  │ └─────────┴─────────┴───────────┘ │ │
│ │                      │  │                                   │ │
│ │ [View All Activity]  │  │ [View All Priority Docs]         │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    ⚡ QUICK ACTIONS                          │ │
│ │                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │ │
│ │ │ 📄 NEW DOC  │ │ 📤 SEND ALL │ │ ⬇️ DOWNLOAD │           │ │
│ │ │   Create    │ │  Reminders  │ │ Completed   │           │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      📚 ALL DOCUMENTS                           │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 [Search documents...]  [📅 Filter] [⚙️ Sort] [☑️ Select]│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑️ │ 📄 Contract_Template.pdf      │ 🔵 SENT    │ 2024-01-15│ │
│ │    │ To: john@company.com           │ ⏰ 3 days  │ [Actions▼]│ │
│ ├────┼────────────────────────────────┼───────────┼───────────┤ │
│ │ ☑️ │ 📄 Service_Agreement.pdf       │ 🟢 SIGNED  │ 2024-01-10│ │
│ │    │ To: vendor@service.com         │ ✅ Done    │ [Actions▼]│ │
│ ├────┼────────────────────────────────┼───────────┼───────────┤ │
│ │ ☑️ │ 📄 Employee_Handbook.pdf       │ 📝 DRAFT   │ 2024-01-08│ │
│ │    │ Not sent yet                   │ ✏️ Edit    │ [Actions▼]│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [◀️ Previous] [1] [2] [3] [Next ▶️]                            │
└─────────────────────────────────────────────────────────────────┘
```

## Interactive Elements

### Document Overview Cards

- **Click**: Navigate to detailed document list for that status
- **Quick Action Buttons**: Perform common actions without navigation
- **Real-time Updates**: Numbers update automatically via Convex

### Recent Activity Feed

- **Activity Items**: Click to view document details
- **Real-time Updates**: New activities appear automatically
- **Scroll**: Show last 10 activities with "View All" option

### Priority Documents

- **Priority Indicators**: Red (Urgent), Yellow (Medium), Green (Low)
- **Quick Actions**: Direct action buttons for immediate workflow
- **Deadline Tracking**: Visual countdown for approaching deadlines

### Quick Actions Bar

- **New Document**: Opens document creation flow
- **Send Reminders**: Bulk reminder for pending documents
- **Download Completed**: Bulk download of recent completions

### All Documents Table

- **Search Bar**: Real-time document search
- **Filters**: Status, date range, recipient, workspace
- **Bulk Selection**: Checkboxes for bulk operations
- **Actions Dropdown**: Context-specific actions per document
- **Pagination**: Handle large document libraries

## Mobile Responsive Layout

```
┌─────────────────────┐
│ ☰ 📊 Dashboard      │
└─────────────────────┘

┌─────────────────────┐
│   📈 OVERVIEW       │
│                     │
│ DRAFT    SENT       │
│  12       8         │
│                     │
│ DONE    EXPIRED     │
│  45       2         │
└─────────────────────┘

┌─────────────────────┐
│  ⭐ PRIORITY DOCS   │
│                     │
│ 🔴 Contract.pdf     │
│    Expires in 2 days│
│ [Remind] [View]     │
│                     │
│ 🟡 Agreement.pdf    │
│    Due next week    │
│ [Remind] [View]     │
└─────────────────────┘

┌─────────────────────┐
│  ⚡ QUICK ACTIONS   │
│                     │
│ [📄 New] [📤 Send] │
│ [⬇️ Download All]   │
└─────────────────────┘

┌─────────────────────┐
│  📚 ALL DOCUMENTS   │
│                     │
│ 🔍 [Search...]      │
│                     │
│ 📄 Contract.pdf     │
│ 🔵 SENT • 3 days    │
│ [View] [Remind]     │
│                     │
│ 📄 Agreement.pdf    │
│ ✅ SIGNED • Done    │
│ [Download] [View]   │
└─────────────────────┘
```

## States and Loading

### Loading State

```
┌─────────────────────────────────────┐
│         📊 SENDER DASHBOARD          │
│                                     │
│ ⏳ Loading dashboard data...        │
│                                     │
│ ┌─────────────┐ ┌─────────────┐     │
│ │ ⏳ Loading  │ │ ⏳ Loading  │     │
│ │   Stats     │ │  Activity   │     │
│ └─────────────┘ └─────────────┘     │
└─────────────────────────────────────┘
```

### Error State

```
┌─────────────────────────────────────┐
│         📊 SENDER DASHBOARD          │
│                                     │
│ ❌ Dashboard couldn't load          │
│                                     │
│ [🔄 Refresh] [📧 Contact Support]   │
└─────────────────────────────────────┘
```

### Empty State (New User)

```
┌─────────────────────────────────────┐
│         📊 SENDER DASHBOARD          │
│                                     │
│         🎉 Welcome to Seal!         │
│                                     │
│     No documents yet. Get started   │
│     by creating your first document │
│                                     │
│    [📄 Create First Document]       │
└─────────────────────────────────────┘
```
