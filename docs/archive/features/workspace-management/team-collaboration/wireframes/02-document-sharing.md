# Document Sharing Wireframes - All States

## Screen States & Wireframes

### 🟢 Document Sharing Interface (Pro Plans)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ ▓▓▓ SEAL LOGO ▓▓▓      📄 Employment Agreement.pdf          [Profile ▼] ║ [Header: h-16 px-6 flex items-center justify-between bg-white shadow-sm]
╠═══════════════════════════════════════════════════════════════════════════════╣ [text-lg font-semibold] [Button: variant="ghost"]
║ Document  │ Recipients  │ Fields  │ Share  │ Settings  │                    ║ [Tabs: w-full border-b bg-white]
╠═══════════════════════════════════════════════════════════════════════════════╣ [TabsList: px-6] [TabsTrigger: active/selected state]
║                                                                               ║
║                       🔗 Share with Your Team                                 ║ [text-3xl font-bold text-center mb-6]
║                                                                               ║ [Container: p-6 space-y-6 bg-gray-50 min-h-screen]
║ Document Sharing Options:                                                     ║ [text-xl font-semibold mb-4]
║                                                                               ║
║ ╭─[SHARING OPTION: variant="elevated"]───────────────────────────────────────────╮ ║
║ │ (•) Private                                             👤 Only You     │ ║ [RadioGroup: p-4 bg-white rounded-lg shadow-sm mb-4]
║ │     Only you can access this document                                   │ ║ [Radio: checked] [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Badge: variant="outline"]
║                                                                               ║
║ ╭─[SHARING OPTION: variant="elevated"]───────────────────────────────────────────╮ ║
║ │ ( ) Shared with Workspace                               👥 Team Access  │ ║ [RadioGroup: p-4 bg-white rounded-lg shadow-sm mb-4 hover:bg-gray-50]
║ │     All Acme Corp members can view and collaborate                      │ ║ [Radio: unchecked] [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Badge: variant="secondary"]
║                                                                               ║
║ ╭─[SHARING OPTION: variant="elevated"]───────────────────────────────────────────╮ ║
║ │ ( ) Specific Team Members                               👤 Select People │ ║ [RadioGroup: p-4 bg-white rounded-lg shadow-sm mb-4 hover:bg-gray-50]
║ │     Choose individual members to share with                             │ ║ [Radio: unchecked] [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Badge: variant="outline"]
║                                                                               ║
║ ╭─[SHARING OPTION: variant="elevated"]───────────────────────────────────────────╮ ║
║ │ ( ) External Sharing                                    🌐 Public Link   │ ║ [RadioGroup: p-4 bg-white rounded-lg shadow-sm mb-6 hover:bg-gray-50]
║ │     Create shareable link for people outside workspace                  │ ║ [Radio: unchecked] [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Badge: variant="outline"]
║                                                                               ║
║                                                                               ║
║ Team Member Permissions:                                                      ║ [text-xl font-semibold mb-4]
║                                                                               ║
║ ╭─[MEMBER PERMISSION: variant="elevated"]─────────────────────────────────────────╮ ║
║ │ 👤 Sarah Johnson                                        Admin       ▼   │ ║ [Card: p-4 bg-white rounded-lg shadow-sm mb-4]
║ │    sarah@acmecorp.com                                  Can Edit         │ ║ [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Select: variant="outline"]
║                                                                               ║
║ ╭─[MEMBER PERMISSION: variant="elevated"]─────────────────────────────────────────╮ ║
║ │ 👤 Mike Chen                                           Member       ▼   │ ║ [Card: p-4 bg-white rounded-lg shadow-sm mb-4]
║ │    mike@acmecorp.com                                   Can View         │ ║ [flex items-center justify-between]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-sm text-muted-foreground] [Select: variant="outline"]
║                                                                               ║
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ + Add Team Member                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│ Permission Levels:                                                          │
│ • Can View: Read-only access to document                                   │
│ • Can Edit: Can modify document content and fields                         │
│ • Can Manage: Can edit document and change sharing settings                │
│                                                                             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Save Sharing Settings                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔵 Team Document Library View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Seal          Workspace: Acme Corp                    [Profile ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Documents  │ Team  │ Templates  │ Settings  │                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📚 Shared Team Documents                              Total: 24 documents   │
│                                                                             │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐    🔍 Search     📂 Filter  📋 Sort │
│ │ All (24)│  │Shared(18)│ │Private(6)│       [_______]      [____]  [___] │
│ └─────────┘  └─────────┘  └─────────┘                                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📄 Employment Agreement Template                         🔗 Shared      │ │
│ │     Created by Sarah Johnson • 2 days ago • 4 team members              │ │
│ │     👥 Can edit: Sarah, John  👁️ Can view: Mike, Lisa                    │ │
│ │     📊 Status: In Progress • 🖊️ 3 of 5 signatures collected             │ │
│ │                                           <Edit>  <Share>  <⋯>         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📄 Client Service Agreement                             🔒 Private       │ │
│ │     Created by John Smith • 1 week ago • Owner only                     │ │
│ │     👤 Owner: John Smith                                                 │ │
│ │     📊 Status: Completed • 🖊️ All signatures collected                  │ │
│ │                                           <View>  <Share>  <⋯>         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📄 NDA Template                                          🔗 Shared      │ │
│ │     Created by Mike Chen • 3 days ago • 2 team members                  │ │
│ │     👥 Can edit: Mike  👁️ Can view: Sarah, Lisa                          │ │
│ │     📊 Status: Template • 📝 Available for team use                     │ │
│ │                                           <Use>   <Share>  <⋯>         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📄 Partnership Proposal                                  🌐 External     │ │
│ │     Created by Sarah Johnson • 5 days ago • External sharing             │ │
│ │     🔗 Shared via link with external recipients                          │ │
│ │     📊 Status: Pending • 🖊️ 2 of 4 signatures collected                 │ │
│ │                                           <View>  <Share>  <⋯>         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📄 Team Policy Updates                                   🔗 Shared      │ │
│ │     Created by John Smith • 1 day ago • All team access                 │ │
│ │     👥 All team members can view and edit                                │ │
│ │     📊 Status: Draft • ✏️ Last edited by Sarah                           │ │
│ │                                           <Edit>  <Share>   <⋯>        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│    ⚡ Recently Shared                                                       │
│    • Sarah shared "Employment Agreement Template" with the team            │
│    • Mike shared "NDA Template" with Sarah and Lisa                        │
│    • John updated sharing permissions for "Team Policy Updates"            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Document Access View (Shared Document)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Seal          📄 Employment Agreement Template       [Profile ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 🔗 Shared with team • 👤 Owner: Sarah Johnson • Your access: Can Edit      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                     EMPLOYMENT AGREEMENT                                │ │
│ │                                                                         │ │
│ │ This Employment Agreement is entered into on [DATE FIELD] between      │ │
│ │ [COMPANY FIELD] and [EMPLOYEE FIELD].                                  │ │
│ │                                                                         │ │
│ │ 1. Position and Duties                                                 │ │
│ │ The Employee agrees to serve as [POSITION FIELD] and                   │ │
│ │ perform duties as assigned by the Company.                              │ │
│ │                                                                         │ │
│ │ 2. Compensation                                                         │ │
│ │ The Employee will receive a salary of [SALARY FIELD]                   │ │
│ │ per year, payable in bi-weekly installments.                           │ │
│ │                                                                         │ │
│ │ 3. Benefits                                                             │ │
│ │ Employee is entitled to standard company benefits                       │ │
│ │ including health insurance, paid time off, and retirement plan.        │ │
│ │                                                                         │ │
│ │ Signatures:                                                             │ │
│ │ ┌─────────────────────┐    ┌─────────────────────┐                    │ │
│ │ │   [EMPLOYEE SIG]    │    │   [EMPLOYER SIG]    │                    │ │
│ │ └─────────────────────┘    └─────────────────────┘                    │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📋 Document Access                                                      │ │
│ │                                                                         │ │
│ │ 👤 Sarah Johnson (Owner) • Can manage all permissions                  │ │
│ │ 👤 John Smith (Admin) • Can edit document and fields                   │ │
│ │ 👤 Mike Chen (Member) • Can view document only                         │ │
│ │ 👤 Lisa Rodriguez (Member) • Can view document only                    │ │
│ │                                                                         │ │
│ │ Last modified: 2 hours ago by Sarah Johnson                            │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Document Actions:                                                           │
│ [Save Changes]  [Share Settings]  [Send for Signature]  [Download]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Document Ownership Transfer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                       📋 Transfer Document Ownership                        │
│                                                                             │
│             Transfer ownership of "Employment Agreement Template"           │
│                                                                             │
│    Current Owner: John Smith (Owner)                                       │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ • Full control over document and sharing settings                   │  │
│    │ • Can edit, share, delete, and manage permissions                   │  │
│    │ • Can transfer ownership to other team members                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Transfer to:                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ 👤 Sarah Johnson (Admin) ▼                                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Available team members:                                                  │
│    • Sarah Johnson (Admin) - Can manage all team documents                 │
│    • Mike Chen (Member) - Can create and manage own documents              │
│    • Lisa Rodriguez (Member) - Can create and manage own documents         │
│                                                                             │
│    Reason for transfer (optional):                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Sarah is leading the HR policy updates project                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    What happens after transfer:                                            │
│    ✅ Sarah will have full ownership and control                            │
│    ✅ You will retain "Can Edit" permissions                               │
│    ✅ All existing permissions and sharing settings preserved               │
│    ✅ Document activity history maintained                                  │
│    ✅ All team members will be notified of ownership change                 │
│                                                                             │
│    ⚠️  This action cannot be undone (only new owner can transfer back)      │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Transfer Ownership                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                 <Cancel>                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🚫 Free Plan Sharing Limitation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    🚫 Free Plan Sharing Limitations                         │
│                                                                             │
│                  Team collaboration requires Pro plan                       │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  🆓 Free Plan Sharing:                                              │  │
│    │  • External sharing via email (unlimited)                           │  │
│    │  • Public document links                                            │  │
│    │  • Basic document management                                        │  │
│    │                                                                     │  │
│    │  🚀 Pro Plan Team Features:                                         │  │
│    │  • Share documents with team members                                │  │
│    │  • Advanced permission management                                   │  │
│    │  • Document ownership transfer                                      │  │
│    │  • Team document library                                            │  │
│    │  • Workspace-scoped document access                                 │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Alternative sharing options for your Free plan:                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 External Sharing                                      Available Now  │ │
│ │     Create shareable link for people outside workspace                  │ │
│ │     [Share via Email Link]                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    🚀 Try Pro Free (2 weeks)                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        View Pro Features                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Use External Sharing>                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔵 Permission Management Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        ⚙️ Document Permission Settings                       │
│                                                                             │
│                    Employment Agreement Template                            │
│                                                                             │
│    Team Member Access:                                                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 Sarah Johnson                                        Admin        ▼  │ │
│ │    sarah@acmecorp.com                                                   │ │
│ │    ┌─────────────────────────────────────────────────────────────────┐  │ │
│ │    │ (•) Can Manage - Full document control                         │  │ │
│ │    │ ( ) Can Edit - Modify document and fields                      │  │ │
│ │    │ ( ) Can View - Read-only access                                 │  │ │
│ │    │ ( ) Remove Access                                               │  │ │
│ │    └─────────────────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 Mike Chen                                           Member        ▼  │ │
│ │    mike@acmecorp.com                                                    │ │
│ │    ┌─────────────────────────────────────────────────────────────────┐  │ │
│ │    │ ( ) Can Manage - Full document control                         │  │ │
│ │    │ ( ) Can Edit - Modify document and fields                      │  │ │
│ │    │ (•) Can View - Read-only access                                 │  │ │
│ │    │ ( ) Remove Access                                               │  │ │
│ │    └─────────────────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ + Add Team Member to Document                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│    Permission Explanations:                                                │
│    • Can Manage: Edit document, change sharing settings, transfer ownership│
│    • Can Edit: Modify document content, fields, and recipients             │
│    • Can View: Read-only access, cannot make changes                       │
│                                                                             │
│    ⚠️  Changes take effect immediately                                      │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Save Permissions                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                 <Cancel>                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Document Sharing

```
┌─────────────────────────┐
│ [←] Employment Agmt [⚙️] │
├─────────────────────────┤
│                         │
│ 🔗 Share Document       │
│                         │
│ ┌─────────────────────┐ │
│ │ (•) Private         │ │
│ │     Only you        │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ ( ) Team Shared     │ │
│ │     All members     │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ ( ) Specific People │ │
│ │     Choose members  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ ( ) External Link   │ │
│ │     Public sharing  │ │
│ └─────────────────────┘ │
│                         │
│ Team Permissions:       │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 Sarah Johnson    │ │
│ │    Can Edit      ▼  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 Mike Chen        │ │
│ │    Can View      ▼  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │   Save Settings     │ │
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Team Document Library

```
┌─────────────────────────┐
│ [☰] Team Docs      [🔍] │
├─────────────────────────┤
│                         │
│ 📚 Shared (24)          │
│                         │
│ ┌─────────────────────┐ │
│ │ 📄 Employment Agmt  │ │
│ │    by Sarah • 2d    │ │
│ │    👥 4 team members │ │
│ │    🔗 Shared        │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 📄 Service Agreement│ │
│ │    by John • 1w     │ │
│ │    👤 Owner only    │ │
│ │    🔒 Private       │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 📄 NDA Template     │ │
│ │    by Mike • 3d     │ │
│ │    👥 2 team members │ │
│ │    🔗 Shared        │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 📄 Partnership Prop │ │
│ │    by Sarah • 5d    │ │
│ │    🌐 External      │ │
│ │    🔗 Public Link   │ │
│ └─────────────────────┘ │
│                         │
│ Recent Sharing:         │
│ • Sarah shared Agmt...  │
│ • Mike shared NDA...    │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Document Sharing Interface

- **Sharing Modes**: Clear visual distinction between private, team, and external sharing
- **Permission Levels**: Simple permission control (View, Edit, Manage) with clear explanations
- **Team Member Selection**: Easy team member discovery and permission assignment
- **Access Control**: Clerk RBAC integration for permission enforcement

### Team Document Library

- **Filter and Search**: Real-time filtering by sharing status and document type
- **Visual Indicators**: Clear sharing status icons and ownership badges
- **Quick Actions**: Contextual action menus for document management
- **Permission Display**: Clear indication of user's access level per document

### Document Access Control

- **Permission Management**: Granular control over team member document access
- **Ownership Transfer**: Secure document ownership transfer between team members
- **Access History**: Document access and modification tracking
- **Role-based Defaults**: Automatic permission assignment based on workspace roles

---

## Clerk Integration

### RBAC

- **Document Permissions**: Fine-grained access control per document
- **Role-based Access**: Automatic permission inheritance from workspace roles
- **Permission Cascade**: Efficient permission updates on role changes
- **API Security**: Role-based API access to shared documents

### Organization Plugin

- **Workspace Scoping**: Documents scoped to workspace context
- **Member Access**: Automatic team member discovery and access
- **Multi-workspace Support**: Clean document isolation between workspaces
- **Ownership Management**: Secure document ownership and transfer

---

## Technical Integration

### Convex Real-Time Features

- **Sharing Updates**: Real-time sharing status and permission changes
- **Document Library**: Live document list updates and sharing status
- **Permission Sync**: Instant permission updates across all clients
- **Activity Tracking**: Document sharing and access activity logging

### React Email + Resend

- **Sharing Notifications**: Professional document sharing notifications
- **Access Granted**: New team member document access emails
- **Permission Changes**: Document permission update notifications
- **Ownership Transfer**: Document ownership change notifications

### State Management

- **Document Library**: Real-time document list updates and filtering
- **Permission State**: Efficient permission caching and validation
- **Sharing State**: Live sharing status and team member access
- **UI Synchronization**: Seamless state updates across all interfaces
