# Team Management Wireframes - All States

## Screen States & Wireframes

### 🟢 Pro Plan Team Management Dashboard

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ ▓▓▓ SEAL LOGO ▓▓▓      Workspace: Acme Corp ▼                    👤 John Doe ▼   ║ [Header: h-16 px-6 flex items-center justify-between bg-white shadow-sm]
╠═══════════════════════════════════════════════════════════════════════════════╣ [Button: variant="ghost" hover:bg-gray-100] [Avatar: h-8 w-8 rounded-full]
║ Documents  │ Team  │ Templates  │ Settings  │                               ║ [Tabs: w-full border-b bg-white]
╠═══════════════════════════════════════════════════════════════════════════════╣ [TabsList: px-6] [TabsTrigger: active/selected state]
║                                                                               ║
║                           👥 Team Members                                     ║ [text-3xl font-bold text-center mb-6]
║                                                                               ║ [Container: p-6 space-y-6 bg-gray-50 min-h-screen]
║    ┏━━━━━━━━━━━━━━━━━━━━━━━ Invite New Members ━━━━━━━━━━━━━━━━━━━━━━━┓  ║ [Button: variant="default" w-full py-3 mb-6]
║                                                                               ║
║ Active Members (4/∞)                                        🟢 4 online      ║ [flex items-center justify-between mb-4]
║                                                                               ║ [text-lg font-semibold] [text-sm text-green-600 flex items-center]
║ ╭─[MEMBER CARD: variant="elevated"]────────────────────────────────────────────────╮ ║
║ │ 👤 John Smith                                              Owner    🟢  │ ║ [Card: p-6 bg-white rounded-lg shadow-sm mb-4]
║ │    john@acmecorp.com • Joined 3 months ago                             │ ║ [flex items-start justify-between] [Badge: variant="success"]
║ │    📄 23 docs created • 🖊️ 45 signatures                                │ ║ [text-sm text-muted-foreground mt-1]
║ │    ⚙️ Can manage team, billing, and all documents                       │ ║ [text-sm text-muted-foreground mt-2 flex items-center space-x-4]
║ │                                                           <Manage ▼>   │ ║ [text-sm text-muted-foreground italic mt-1]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [Button: variant="ghost" absolute top-4 right-4]
║                                                                               ║
║ ╭─[MEMBER CARD: variant="elevated"]────────────────────────────────────────────────╮ ║
║ │ 👤 Sarah Johnson                                          Admin    🟢  │ ║ [Card: p-6 bg-white rounded-lg shadow-sm mb-4]
║ │    sarah@acmecorp.com • Joined 2 months ago                            │ ║ [flex items-start justify-between] [Badge: variant="secondary"]
║ │    📄 18 docs created • 🖊️ 32 signatures                                │ ║ [text-sm text-muted-foreground mt-1]
║ │    ⚙️ Can manage team members and documents                             │ ║ [text-sm text-muted-foreground mt-2 flex items-center space-x-4]
║ │                                                           <Manage ▼>   │ ║ [text-sm text-muted-foreground italic mt-1]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [Button: variant="ghost" absolute top-4 right-4]
║                                                                               ║
║ ╭─[MEMBER CARD: variant="elevated"]────────────────────────────────────────────────╮ ║
║ │ 👤 Mike Chen                                             Member    🟡  │ ║ [Card: p-6 bg-white rounded-lg shadow-sm mb-4]
║ │    mike@acmecorp.com • Joined 1 month ago                              │ ║ [flex items-start justify-between] [Badge: variant="outline"]
║ │    📄 12 docs created • 🖊️ 18 signatures                                │ ║ [text-sm text-muted-foreground mt-1]
║ │    ⚙️ Can create and manage own documents                               │ ║ [text-sm text-muted-foreground mt-2 flex items-center space-x-4]
║ │                                                           <Manage ▼>   │ ║ [text-sm text-muted-foreground italic mt-1]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [Button: variant="ghost" absolute top-4 right-4]
║                                                                               ║
║ ╭─[MEMBER CARD: variant="elevated"]────────────────────────────────────────────────╮ ║
║ │ 👤 Lisa Rodriguez                                        Member    ⚫  │ ║ [Card: p-6 bg-white rounded-lg shadow-sm mb-4]
║ │    lisa@acmecorp.com • Joined 2 weeks ago                              │ ║ [flex items-start justify-between] [Badge: variant="outline"]
║ │    📄 5 docs created • 🖊️ 8 signatures                                  │ ║ [text-sm text-muted-foreground mt-1]
║ │    ⚙️ Can create and manage own documents                               │ ║ [text-sm text-muted-foreground mt-2 flex items-center space-x-4]
│ │                                                           <Manage ▼>   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│ Pending Invitations (2)                                                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📧 david@acmecorp.com                                    Invited as Member│ │
│ │    Invited by Sarah Johnson • 2 days ago • Expires in 5 days           │ │
│ │    <Resend Invitation>     <Cancel Invitation>                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📧 anna@acmecorp.com                                     Invited as Admin │ │
│ │    Invited by John Smith • 1 day ago • Expires in 6 days               │ │
│ │    <Resend Invitation>     <Cancel Invitation>                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔵 Team Member Invitation Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          👥 Invite Team Members                            │
│                                                                             │
│    Add teammates to collaborate on documents and share workflows           │
│                                                                             │
│    Team Member Emails (one per line or comma-separated)                    │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ sarah@company.com                                                   │  │
│    │ mike.chen@company.com                                               │  │
│    │ lisa.rodriguez@company.com                                          │  │
│    │                                                                     │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    💡 Tip: You can invite up to 10 people at once                          │
│                                                                             │
│    Default Role for New Members                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Member ▼                                                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Role Permissions:                                                        │
│    • Member: Create documents, collaborate on shared docs                  │
│    • Admin: Member permissions + manage team members                       │
│    • Owner: Admin permissions + workspace settings & billing               │
│                                                                             │
│    Personal Message (Optional)                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Join our team to collaborate on client contracts and agreements!    │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                       Send Invitations                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                 <Cancel>                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Sending Invitations Progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        📧 Sending Team Invitations                         │
│                                                                             │
│                      Processing 3 invitations...                           │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [████████████████████░░░░░░░] 75%                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ✅ sarah@company.com sent                           │
│                         ✅ mike.chen@company.com sent                       │
│                         ⏳ lisa.rodriguez@company.com sending...             │
│                                                                             │
│                        This should take just a moment!                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Invitation Results Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ✅ Invitations Sent Successfully!                   │
│                                                                             │
│                         📧 3 invitations sent to:                          │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  ✅ sarah@company.com                               Member role      │  │
│    │  ✅ mike.chen@company.com                           Member role      │  │
│    │  ✅ lisa.rodriguez@company.com                       Member role      │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              📬 Your teammates will receive invitation emails               │
│                    They have 7 days to accept invitations                  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Back to Team                                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              🎉 Next Steps:                                                 │
│              • Share workspace overview with new members                   │
│              • Create document templates for team consistency              │
│              • Set up team notification preferences                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🚫 Free Plan Team Limitation Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal       🆓 Free Plan     Workspace: My Workspace ▼   👤 Jane Smith ▼  │
├─────────────────────────────────────────────────────────────────────────────┤
│                      🚫 Free Plan Team Limitations                         │
│                                                                             │
│                     Your free plan is limited to 1 user                    │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  🆓 Free Plan Features:                                             │  │
│    │  • 1 user per workspace (you've reached the limit)                 │  │
│    │  • 10 documents per month                                           │  │
│    │  • All core signing features                                        │  │
│    │  • Document templates                                               │  │
│    │                                                                     │  │
│    │  🚀 Pro Plan Features:                                              │  │
│    │  • Unlimited team members                                           │  │
│    │  • Unlimited documents                                              │  │
│    │  • Advanced collaboration tools                                     │  │
│    │  • Full API access                                                  │  │
│    │  • Priority support                                                 │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                       🚀 Upgrade to Pro                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        View Pro Features                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Continue with Free Plan>                           │
│                                                                             │
│              Need team collaboration? Upgrade to Pro to unlock             │
│                      unlimited members and advanced features                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔵 Member Role Management Dropdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👤 Sarah Johnson                                          Admin    🟢  │ │
│    sarah@acmecorp.com • Joined 2 months ago                            │ │
│    📄 18 docs created • 🖊️ 32 signatures                                │ │
│    ⚙️ Can manage team members and documents                             │ │
│                                                         ┌─────────────┐ │ │
│                                                         │ Change Role │ │ │
│                                                         │ Remove User │ │ │
│                                                         │ View Profile│ │ │
│                                                         │ Send Message│ │ │
│                                                         └─────────────┘ │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Role Change Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ⚠️  Change Member Role                              │
│                                                                             │
│              You're about to change Sarah Johnson's role                   │
│                                                                             │
│    Current Role: Admin                                                      │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ • Can manage team members                                           │  │
│    │ • Can access all workspace documents                                │  │
│    │ • Can create and manage document templates                          │  │
│    │ • Cannot manage billing or workspace settings                       │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    New Role: Member                                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ • Can create and manage own documents                                │  │
│    │ • Can view shared team documents                                     │  │
│    │ • Cannot manage team members                                         │  │
│    │ • Cannot access workspace settings                                   │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ⚠️  This will immediately update Sarah's permissions                     │
│                                                                             │
│    Reason for change (optional)                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Role restructuring - focusing on document creation                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Confirm Role Change                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                 <Cancel>                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Remove Team Member Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ⚠️  Remove Team Member                              │
│                                                                             │
│                Are you sure you want to remove Mike Chen?                  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ 👤 Mike Chen                                                        │  │
│    │    mike@acmecorp.com • Member • Joined 1 month ago                 │  │
│    │    📄 12 documents created • 🖊️ 18 signatures                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    What happens when you remove Mike:                                      │
│    • ❌ Immediate access revocation to all workspace documents             │
│    • 🔄 Document ownership transfer (12 documents need new owner)          │
│    • 📧 Mike will be notified of removal                                   │
│    • 🔍 Activity history will be preserved for audit purposes              │
│    • ✅ All document signatures remain legally valid                       │
│                                                                             │
│    Transfer Mike's documents to:                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ John Smith (Owner) ▼                                                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Reason for removal (optional)                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Left the company                                                    │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ⚠️  This action cannot be undone                                         │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Remove Team Member                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                 <Cancel>                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Team Management

```
┌─────────────────────────┐
│ [☰] Acme Corp    [👤] │
├─────────────────────────┤
│                         │
│ 👥 Team Members         │
│                         │
│ ┌─────────────────────┐ │
│ │   Invite Members    │ │
│ └─────────────────────┘ │
│                         │
│ Active (4) 🟢 4 online  │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 John Smith       │ │
│ │    Owner         🟢 │ │
│ │    23 docs created  │ │
│ │    ⋯               │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 Sarah Johnson    │ │
│ │    Admin         🟢 │ │
│ │    18 docs created  │ │
│ │    ⋯               │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 Mike Chen        │ │
│ │    Member        🟡 │ │
│ │    12 docs created  │ │
│ │    ⋯               │ │
│ └─────────────────────┘ │
│                         │
│ Pending (2)             │
│                         │
│ ┌─────────────────────┐ │
│ │ 📧 david@acme.com   │ │
│ │    Invited 2d ago   │ │
│ │    <Resend>         │ │
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Team Member List
- **Real-time Status**: Online/offline indicators update via Convex Presence
- **Role Indicators**: Clear visual hierarchy (Owner > Admin > Member)
- **Activity Stats**: Document count and signature count per member
- **Quick Actions**: Dropdown menu for role management and removal
- **Search/Filter**: Search members by name/email, filter by role or status

### Invitation Management
- **Bulk Processing**: Support up to 10 email addresses at once
- **Email Validation**: Real-time format checking and duplicate detection
- **Status Tracking**: Real-time invitation status updates via Convex
- **Expiration Handling**: Auto-cleanup of expired invitations

### Role Management
- **Permission Preview**: Clear explanation of role capabilities
- **Confirmation Flows**: Two-step confirmation for destructive actions
- **Real-time Updates**: Immediate permission refresh across all sessions
- **Audit Logging**: Complete activity trail for all role changes

---

## Better Auth Integration

### Organization Plugin
- **Member Management**: Leverage Better Auth organization membership
- **Invitation System**: Built-in invitation flow with token management
- **Role Assignment**: Seamless RBAC integration
- **Multi-workspace Support**: Clean workspace context separation

### RBAC Plugin
- **Permission Enforcement**: Real-time permission checking and updates
- **Role Hierarchies**: Clear Owner > Admin > Member structure
- **API Access**: Role-based API permissions and rate limiting
- **Session Management**: Automatic permission refresh on role changes

---

## Technical Integration

### Convex Real-time Features
- **Member Presence**: Live online/offline status via Convex Presence
- **Activity Tracking**: Real-time document and signature statistics
- **Permission Sync**: Instant permission updates across all clients
- **Invitation Status**: Live invitation status and response tracking

### React Email + Resend
- **Team Invitations**: Professional invitation email templates
- **Role Notifications**: Member role change communications
- **Removal Notifications**: Team member removal emails
- **Activity Digests**: Periodic team activity summaries

### State Management
- **Member List**: Real-time member list updates and status changes
- **Permission Cache**: Efficient permission checking and updates
- **UI Consistency**: Seamless state synchronization across all interfaces
- **Error Handling**: Graceful error recovery and user feedback