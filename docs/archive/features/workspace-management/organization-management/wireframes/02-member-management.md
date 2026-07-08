# Member Management Wireframes - All States

## Screen States & Wireframes

### 👥 Member Management Dashboard

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║ 👥 Team Members                                           ┏━━━ Invite Members ━━━┓ ║ [text-2xl font-bold] [Button: variant="default"]
║                                                                             ║
║ Acme Corporation • 4 members • $40/month                                   ║ [Badge: variant="secondary" text-sm]
║                                                                             ║
║ ╭─[MEMBERS TABLE: variant="elevated"]────────────────────────────────────╮   ║
║ │ Name               │ Email                │ Role    │ Status  │ Actions │   ║ [Table: w-full]
║ ├─────────────────────────────────────────────────────────────────────────┤   ║ [TableHeader: font-medium]
║ │ John Doe           │ john@acmecorp.com    │ Owner   │ Active  │   •••   │   ║ [TableRow: hover:bg-muted/50]
║ │ Sarah Smith        │ sarah@acmecorp.com   │ Admin   │ Active  │   •••   │   ║ [Badge: variant="outline" size="sm"]
║ │ Mike Johnson       │ mike@acmecorp.com    │ Member  │ Active  │   •••   │   ║ [DropdownMenu: trigger]
║ │ Lisa Chen          │ lisa@acmecorp.com    │ Member  │ Pending │ ┏━Resend━┓ │ ║ [Button: variant="outline" size="sm"]
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                             ║
║ Active Invitations (2)                                     ┏━━━ Manage All ━━━┓ ║ [text-lg font-semibold] [Button: variant="ghost" size="sm"]
║ ╭─[INVITATIONS CARD: variant="elevated"]─────────────────────────────────╮   ║
║ │ tom@acmecorp.com          │ Member  │ Sent 2 days ago    │ ┏━━Resend━━┓  │   ║ [Card: p-4 space-y-3]
║ │ alex@acmecorp.com         │ Admin   │ Sent 5 hours ago   │ ┏━━Cancel━━┓  │   ║ [Button: variant="outline" size="sm"]
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                             ║
║ Role Permissions                                                            ║ [text-lg font-semibold mb-3]
║ ╭─[ROLES CARD: variant="elevated"]───────────────────────────────────────╮   ║
║ │ 👑 Owner: Full workspace control, billing, transfer ownership           │   ║ [Card: p-4 space-y-2]
║ │ 🛡️ Admin: Manage members, documents, limited billing access             │   ║ [text-sm text-muted-foreground]
║ │ 👤 Member: Create and manage own documents, participate in signing       │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                             ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🚫 Free Plan Member Limit Reached

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                      [ ✕ ]  ║ [Button: variant="ghost" h-6 w-6 absolute top-4 right-4]
║                         🚫 Team Members Not Available                         ║ [text-2xl font-bold text-center]
║                                                                               ║
║                      Your free plan is limited to 1 user                    ║ [text-lg text-center text-muted-foreground]
║                                                                               ║
║    ╭─[PLAN LIMITATIONS CARD: variant="elevated"]─────────────────────────╮    ║
║    │                                                                       │    ║ [Card: p-6 space-y-4 bg-orange-50 border-orange-200]
║    │  🆓 Free Plan Limitations:                                            │    ║ [text-lg font-semibold text-orange-800 mb-3]
║    │  • 1 user per workspace (you've reached the limit)                   │    ║ [ul: space-y-2 text-sm text-orange-700]
║    │  • 10 documents per month                                             │    ║ [li: ml-4]
║    │  • No API access                                                      │    ║
║    │                                                                       │    ║
║    │  🚀 Upgrade to Pro for:                                               │    ║ [text-lg font-semibold text-blue-800 mb-2 mt-4]
║    │  • Unlimited team members                                             │    ║ [ul: space-y-2 text-sm text-blue-700]
║    │  • Unlimited documents                                                │    ║ [li: ml-4]
║    │  • Full API access                                                    │    ║
║    │  • Advanced integrations                                              │    ║
║    │                                                                       │    ║
║    ╰─────────────────────────────────────────────────────────────────────────╯    ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━ 🚀 Upgrade to Pro ━━━━━━━━━━━━━━━━━━━━━━┓            ║ [Button: variant="default" w-full py-3 mb-3]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━ View Pricing Details ━━━━━━━━━━━━━━━━━━━━━┓          ║ [Button: variant="outline" w-full py-3 mb-6]
║                                                                               ║
║                              <Cancel>                                        ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 📧 Pro Plan Invite Members Modal

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                      [ ✕ ]  ║ [Button: variant="ghost" h-6 w-6 absolute top-4 right-4]
║                           📧 Invite Team Members                              ║ [text-2xl font-bold text-center]
║                                                                               ║
║                        Invite people to Acme Corporation                     ║ [text-lg text-center text-muted-foreground]
║                                                                               ║
║    Email Addresses (up to 10)                                                ║ [text-lg font-semibold mb-2]
║    ╭─[EMAIL TEXTAREA: variant="outline"]─────────────────────────────────╮  ║
║    │ sarah@company.com                                                     │  ║ [Textarea: p-3 min-h-24 placeholder-gray-400]
║    │ mike@company.com                                                      │  ║ [text-sm font-mono leading-relaxed]
║    │ lisa@company.com                                                      │  ║
║    │                                                                       │  ║
║    │                                                                       │  ║
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║    💡 Enter one email per line or separate with commas                       ║ [text-sm text-blue-600 mt-1]
║                                                                               ║
║    Default Role for New Members                                              ║ [text-lg font-semibold mb-2]
║    ╭─[ROLE SELECT: variant="outline"]──────────────────────────────────╮  ║
║    │ Member ▼                                                              │  ║ [Select: p-3 w-full bg-white]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Personal Message (Optional)                                               ║ [text-lg font-semibold mb-2]
║    ╭─[MESSAGE TEXTAREA: variant="outline"]────────────────────────────────╮  ║
║    │ Hi! I'd like to invite you to join our team workspace on Seal.       │  ║ [Textarea: p-3 min-h-16 placeholder-gray-400]
║    │ We'll be collaborating on document signing and management.           │  ║ [text-sm leading-relaxed]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    💰 Billing Impact: +3 members = $30/month added to next bill              ║ [text-sm text-orange-600 font-medium bg-orange-50 p-2 rounded]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━ Send Invitations ━━━━━━━━━━━━━━━━━━━━━┓                ║ [Button: variant="default" w-full py-3 mb-4]
║                                                                               ║
║                              <Cancel>                                        ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Sending Invitations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                      [ ✕ ]  │
│                         📧 Sending Invitations                              │
│                                                                             │
│                      Sending invitations to 3 team members                 │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [████████████████████░░░░░░░░░] 70%                               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ✅ sarah@company.com sent                          │
│                         ✅ mike@company.com sent                           │
│                         ⏳ lisa@company.com sending...                     │
│                                                                             │
│                      Processing invitation emails...                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ✅ Invitations Sent Successfully

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                      [ ✕ ]  ║ [Button: variant="ghost" h-6 w-6 absolute top-4 right-4]
║                       ✅ Invitations Sent Successfully!                       ║ [text-2xl font-bold text-center text-green-600]
║                                                                               ║
║                   3 invitations were sent to your team members               ║ [text-lg text-center text-muted-foreground]
║                                                                               ║
║    Invitation Summary:                                                        ║ [text-xl font-semibold mb-4]
║    ╭─[SUMMARY CARD: variant="elevated"]───────────────────────────────────╮  ║
║    │                                                                       │  ║ [Card: p-6 space-y-3 bg-green-50 border-green-200]
║    │  ✅ sarah@company.com - Member role                                   │  ║ [text-sm text-green-700 mb-1]
║    │  ✅ mike@company.com - Member role                                    │  ║ [text-sm text-green-700 mb-1]
║    │  ✅ lisa@company.com - Member role                                    │  ║ [text-sm text-green-700 mb-4]
║    │                                                                       │  ║
║    │  📧 Invitation emails sent successfully                               │  ║ [text-sm text-green-700 font-medium mb-1]
║    │  ⏰ Recipients have 7 days to accept                                  │  ║ [text-sm text-blue-600 mb-1]
║    │  🔔 You'll be notified when they join                                 │  ║ [text-sm text-muted-foreground]
║    │                                                                       │  ║
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    What happens next:                                                         ║ [text-lg font-semibold mb-3]
║    • Your teammates will receive invitation emails                           ║ [ul: space-y-1 text-sm text-muted-foreground]
║    • They can accept or decline the invitation                               ║ [li: ml-4]
║    • Billing will update when they join ($10/month per new member)           ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                ║ [Button: variant="default" w-full py-3]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### ⚠️ Partial Invitation Success

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                      [ ✕ ]  │
│                         ⚠️ Some Invitations Failed                          │
│                                                                             │
│                   2 of 3 invitations were sent successfully                │
│                                                                             │
│    Results Summary:                                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  ✅ sarah@company.com - Sent successfully                           │  │
│    │  ✅ mike@company.com - Sent successfully                            │  │
│    │  ❌ invalid-email@bad-domain - Invalid email format                 │  │
│    │                                                                     │  │
│    │  📧 2 invitation emails sent                                        │  │
│    │  ❌ 1 invitation failed                                             │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    Retry Failed Invitation                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Continue                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚙️ Member Actions Menu

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 👥 Team Members                                                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Sarah Smith        │ sarah@acmecorp.com   │ Admin   │ Active  │ ┌─────┐ │ │
│ │                                                           │ │ Edit │ │ │ │
│ │                                                           │ Role │ │ │ │
│ │                                                           ├─────┤ │ │ │
│ │                                                           │Send │ │ │ │
│ │                                                           │Msg  │ │ │ │
│ │                                                           ├─────┤ │ │ │
│ │                                                           │View │ │ │ │
│ │                                                           │Docs │ │ │ │
│ │                                                           ├─────┤ │ │ │
│ │                                                           │Rmv  │ │ │ │
│ │                                                           │User │ │ │ │
│ │                                                           └─────┘ │ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 👑 Role Change Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                      [ ✕ ]  │
│                         👑 Change Member Role                               │
│                                                                             │
│                      Change role for Sarah Smith?                          │
│                                                                             │
│    Current Role: Admin                                                      │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  🛡️ Admin Permissions:                                              │  │
│    │  • Manage team members and invitations                             │  │
│    │  • Access all workspace documents                                  │  │
│    │  • View basic billing information                                  │  │
│    │  • Manage workspace settings                                       │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    New Role                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ (•) Owner   [Transfer ownership - requires confirmation]             │  │
│    │ ( ) Admin   [Keep current role]                                     │  │
│    │ ( ) Member  [Basic document access only]                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ⚠️ Changing to Owner will transfer full workspace control to Sarah      │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Confirm Role Change                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                              <Cancel>                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🚨 Remove Member Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                      [ ✕ ]  │
│                         🚨 Remove Team Member                               │
│                                                                             │
│                      Remove Mike Johnson from workspace?                   │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  👤 Mike Johnson (mike@acmecorp.com)                                │  │
│    │  🏷️ Current Role: Member                                             │  │
│    │  📄 Documents: 3 active, 12 signed                                  │  │
│    │  📅 Member since: January 2024                                      │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    What will happen:                                                        │
│    • Mike will lose access to this workspace immediately                   │
│    • His active document signing links will remain functional              │
│    • Billing will be reduced by $10/month on next cycle                    │
│    • He can be re-invited later if needed                                  │
│                                                                             │
│    ⚠️ This action cannot be undone                                          │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Remove Member                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                              <Cancel>                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Member Management

```
┌─────────────────────────┐
│    [LOGO] Seal      │
├─────────────────────────┤
│                         │
│ 👥 Team Members         │
│                      📧 │
│ Acme Corp • 4 members   │
│ $40/month               │
│                         │
│ ┌─────────────────────┐ │
│ │ John Doe            │ │
│ │ john@acme.com       │ │
│ │ Owner • Active   ••• │ │
│ ├─────────────────────┤ │
│ │ Sarah Smith         │ │
│ │ sarah@acme.com      │ │
│ │ Admin • Active   ••• │ │
│ ├─────────────────────┤ │
│ │ Mike Johnson        │ │
│ │ mike@acme.com       │ │
│ │ Member • Active  ••• │ │
│ ├─────────────────────┤ │
│ │ Lisa Chen           │ │
│ │ lisa@acme.com       │ │
│ │ Member • Pending    │ │
│ │ [Resend]            │ │
│ └─────────────────────┘ │
│                         │
│ Active Invitations (2)  │
│ • tom@acme.com          │
│ • alex@acme.com         │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Invite Members

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│                     [ ✕]│
├─────────────────────────┤
│                         │
│ 📧 Invite Members       │
│                         │
│ Invite to Acme Corp     │
│                         │
│ Email Addresses         │
│ ┌─────────────────────┐ │
│ │ sarah@company.com   │ │
│ │ mike@company.com    │ │
│ │ lisa@company.com    │ │
│ │                     │ │
│ └─────────────────────┘ │
│ 💡 One per line         │
│                         │
│ Default Role            │
│ ┌─────────────────────┐ │
│ │ Member          ▼   │ │
│ └─────────────────────┘ │
│                         │
│ Personal Message        │
│ ┌─────────────────────┐ │
│ │ Hi! Join our team   │ │
│ │ workspace on Seal   │ │
│ └─────────────────────┘ │
│                         │
│ 💰 +3 members = +$30/mo │
│                         │
│ ┌─────────────────────┐ │
│ │ Send Invitations    │ │
│ └─────────────────────┘ │
│                         │
│ <Cancel>                │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Member List Management

- **Real-time Updates**: Member status changes reflect instantly via Convex
- **Role-based Actions**: Different actions available based on current user's role
- **Bulk Operations**: Select multiple members for batch role changes
- **Search and Filter**: Find members quickly in large workspaces

### Invitation System

- **Email Validation**: Real-time email format checking and duplicate detection
- **Batch Processing**: Handle up to 10 invitations simultaneously
- **Rate Limiting**: Respect Resend rate limits for email delivery
- **Error Recovery**: Clear error handling with retry options

### Role Management

- **Permission Preview**: Show what permissions each role includes
- **Transfer Safeguards**: Prevent accidental ownership transfers
- **Last Admin Protection**: Ensure workspace always has at least one admin
- **Audit Trail**: Log all role changes for workspace activity tracking

### Billing Integration

- **Cost Transparency**: Show billing impact of adding/removing members
- **Real-time Updates**: Member count affects billing immediately
- **Prorated Billing**: Handle mid-cycle member additions/removals
- **Trial Considerations**: New members during trial period handling

---

## Technical Integration

### Clerk Integration

- **Roles & Permissions**: Role-based permission management
- **Organizations**: Member invitation and management
- **Permission Checking**: Real-time permission validation
- **Audit Logging**: Complete trail of member and role changes

### Convex Real-time Updates

- **Member Presence**: Live member status and activity
- **Permission Changes**: Instant permission updates across all clients
- **Invitation Status**: Real-time invitation acceptance/decline updates
- **Activity Feeds**: Live workspace activity and member actions

### React Email + Resend Integration

- **Invitation Templates**: Professional email templates for invitations
- **Role Change Notifications**: Automated emails for role updates
- **Batch Email Handling**: Efficient bulk invitation processing
- **Delivery Tracking**: Monitor invitation email delivery status

### retired provider Billing Integration

- **Seat Management**: Automatic billing updates for member changes
- **Prorated Billing**: Handle mid-cycle member additions/removals
- **Cost Calculation**: Real-time billing impact display
- **Payment Processing**: Seamless billing updates with member changes

### Mobile Optimization

- **Touch-Friendly Interface**: Large touch targets for mobile interactions
- **Responsive Tables**: Adaptive member list display for mobile
- **Swipe Actions**: Mobile-native interactions for member management
- **Simplified UI**: Streamlined mobile experience for complex operations

---

## Destructive Action Confirmations

### Delete Workspace Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         🗑️ Delete Workspace                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │        Are you sure you want to permanently delete "Acme Corp"?        │ │
│ │                                                                         │ │
│ │ ⚠️ **This action cannot be undone**                                     │ │
│ │                                                                         │ │
│ │ **What will be permanently deleted:**                                   │ │
│ │ • All 247 documents in this workspace                                  │ │
│ │ • All team member access and roles                                      │ │
│ │ • All signature workflows and templates                                 │ │
│ │ • All billing and subscription data                                     │ │
│ │ • All API keys and integrations                                         │ │
│ │                                                                         │ │
│ │ **Your team members will:**                                             │ │
│ │ • Lose access to all workspace documents                               │ │
│ │ • Be notified about workspace deletion                                  │ │
│ │ • Need to create their own workspaces                                   │ │
│ │                                                                         │ │
│ │ **Alternative:** You can deactivate the workspace instead              │ │
│ │                                                                         │ │
│ │ Type "DELETE ACME CORP" to confirm:                                     │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │                                                                     │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]  [Deactivate Instead]  [🗑️ Permanently Delete Workspace]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
