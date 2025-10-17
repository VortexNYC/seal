# Organization Management - User Flows

## Primary User Flows

### Workspace Creation Flow (Required for All Users)
```
○ User Completes Registration
    ↓
□ Workspace Creation Required
    ├─ All users must create a workspace
    ├─ No exceptions - required for account setup
    └─ Uses Better Auth Organization plugin
    ↓
□ Workspace Naming
    ├─ User enters workspace name
    ├─ Default suggestion: "[Name]'s Workspace"
    ├─ Validation: 3-50 characters
    └─ Handle duplicates: auto-append number
    ↓
□ Owner Role Assignment (Automatic)
    ├─ Creator automatically becomes workspace owner
    ├─ Full permissions granted via Better Auth RBAC
    └─ Cannot be removed by others
    ↓
○ Billing Setup (Plan-Based)
    ├─ Free Plan: No payment required
    ├─ Pro Trial: Payment info required, 2-week trial starts immediately
    └─ $10/month per seat after trial (Pro only)
    ↓
□ Workspace Creation Success
    ├─ Better Auth organization created
    ├─ Polar subscription initialized
    ├─ User granted owner permissions
    └─ Redirect to workspace dashboard
```

### Multi-Workspace Context Management
```
○ User Belongs to Multiple Workspaces
    ↓
□ Workspace Switcher Display
    ├─ Show workspace switcher in header
    ├─ List all workspaces user belongs to
    ├─ Indicate current active workspace
    └─ Show user's role in each workspace
    ↓
○ User Switches Workspace
    ↓
□ Context Switch Process (Convex Handles All Updates)
    ├─ Update current workspace context
    ├─ User permissions automatically refresh
    ├─ Dashboard data updates automatically
    └─ Workspace preference persisted
    ↓
□ URL and State Update
    ├─ Update URL to reflect new workspace
    ├─ Convex subscriptions update automatically
    └─ All workspace-scoped data refreshes
```

### Team Member Invitation Flow
```
○ Workspace Owner/Admin Invites Members
    ↓
□ Member Invitation Interface
    ├─ Single email invitation option
    ├─ Bulk invitation (up to 10 emails)
    ├─ Email format validation
    └─ Duplicate detection within batch
    ↓
○ Invitation Processing
    ├─ Better Auth invitation creation
    ├─ React Email template generation
    └─ Resend email delivery
    ↓
□ Batch Processing Results
    ├─ Process each email individually
    ├─ Handle invalid emails gracefully
    ├─ Show success/failure summary
    └─ Rate limiting compliance
    ↓
○ Invitation Delivery Status
    ├─ [Success] → Email delivered, pending response
    ├─ [Bounced] → Invalid email, notify sender
    ├─ [Rate Limited] → Queued for delivery
    └─ [Failed] → System error, retry option
```

### Invitation Response Flow
```
○ Recipient Receives Invitation Email
    ↓
□ Invitation Email (React Email + Resend)
    ├─ Clear workspace and sender information
    ├─ Secure invitation link with token
    ├─ Expiration date (7 days default)
    └─ Accept/Decline options
    ↓
○ Recipient Response Options
    ├─ [Accept] → Join workspace flow
    ├─ [Decline] → Decline with optional message
    ├─ [Ignore] → Auto-expire after 7 days
    └─ [Already Member] → Show membership status
    ↓
[If Accept Selected]
    ↓
□ New Member Onboarding
    ├─ Account creation (if new user)
    ├─ Better Auth organization membership
    ├─ Role assignment (Member by default)
    └─ Welcome to workspace experience
    ↓
□ Workspace Updates (Convex Real-time)
    ├─ All workspace members see new member instantly
    ├─ Member lists update automatically
    └─ Workspace analytics update automatically
```

### Role Management Flow
```
○ Owner/Admin Manages Member Roles
    ↓
□ Member Management Interface
    ├─ List all workspace members
    ├─ Show current role for each member
    ├─ Role change options based on permissions
    └─ Bulk role management options
    ↓
○ Role Change Process
    ├─ [Owner] → Can change any role except own
    ├─ [Admin] → Can manage Members only
    └─ [Member] → No role management permissions
    ↓
□ Role Update Process
    ├─ Better Auth RBAC role update
    ├─ Convex updates all clients immediately
    ├─ Email notification to affected user
    └─ Workspace activity log entry
    ↓
○ Special Role Scenarios
    ├─ Owner Transfer (requires admin recipient)
    ├─ Last Admin Protection (must have ≥1 admin)
    └─ Self-role restrictions (can't demote self)
```

---

## Advanced Management Flows

### Workspace Ownership Transfer
```
○ Current Owner Initiates Transfer
    ↓
□ Transfer Prerequisites Check
    ├─ Recipient must be current Admin
    ├─ Recipient must accept transfer
    ├─ Current owner confirms understanding
    └─ Billing implications explained
    ↓
○ Two-Step Transfer Process
    ├─ Step 1: Current owner initiates
    ├─ Step 2: New owner accepts
    └─ Both confirmations required
    ↓
□ Transfer Execution
    ├─ Better Auth role updates (atomic)
    ├─ Polar billing ownership transfer
    ├─ Convex updates all workspace data instantly
    └─ Comprehensive audit log entry
    ↓
□ Post-Transfer Notifications
    ├─ Email all workspace members
    ├─ Workspace settings access updates automatically
    └─ Former owner becomes Admin
```

### Billing-Driven Workspace Management
```
○ Workspace Billing Event Occurs
    ↓
□ Billing Status Assessment
    ├─ [Trial Active] → Full feature access
    ├─ [Paid Current] → Full feature access
    ├─ [Payment Failed] → Grace period mode
    └─ [Suspended] → Read-only mode
    ↓
○ Payment Failure Handling
    ├─ 30-day grace period begins
    ├─ Email notifications to all admins
    ├─ Convex updates workspace status for all users
    └─ Feature access unchanged initially
    ↓
□ Grace Period Management
    ├─ Daily reminder emails
    ├─ Dashboard countdown display
    ├─ Payment method update prompts
    └─ Escalating warning severity
    ↓
○ Suspension Activation
    ├─ Read-only mode for workspace
    ├─ Document signing continues (recipients)
    ├─ New document creation blocked
    └─ Recovery payment process available
```

### Multi-Workspace Billing Scenarios
```
○ User Active in Multiple Workspaces
    ↓
□ Independent Billing Model
    ├─ Each workspace pays for user's seat
    ├─ User gets features from current workspace
    ├─ No cross-workspace billing conflicts
    └─ Clear billing context per workspace
    ↓
○ Workspace-Specific Feature Access
    ├─ Features based on current workspace plan
    ├─ Switching workspaces changes available features
    ├─ No feature "bleed" between workspaces
    └─ Clear feature access indicators
    ↓
□ Billing Failure Impact Scope
    ├─ Payment failure affects only that workspace
    ├─ Other workspaces remain unaffected
    ├─ User can switch to paid workspaces
    └─ Independent recovery processes
```

---

## Error Handling & Edge Case Flows

### Workspace Creation Failures
```
○ Workspace Creation Attempt Fails
    ↓
□ Failure Type Detection
    ├─ [Duplicate Name] → Auto-increment suggestion
    ├─ [Network Error] → Retry mechanism
    ├─ [Billing Failure] → Payment retry flow
    └─ [System Error] → Fallback options
    ↓
○ Recovery Strategy
    ├─ Preserve user input data
    ├─ Clear error messaging
    ├─ Alternative action suggestions
    └─ Support contact option
    ↓
□ Graceful Degradation
    ├─ Allow workspace creation without billing
    ├─ Limited trial functionality
    ├─ Forced billing resolution later
    └─ Data preservation throughout
```

### Member Management Conflicts
```
○ Member Management Conflict Detected
    ↓
□ Conflict Type Resolution
    ├─ [Duplicate Invitation] → Show existing status
    ├─ [Self Invitation] → Clear error message
    ├─ [Invalid Email] → Skip and continue batch
    └─ [Permission Denied] → Explain limitations
    ↓
○ Conflict Resolution Process
    ├─ Immediate user feedback
    ├─ Partial success handling
    ├─ Clear next steps provided
    └─ Audit trail maintained
```

### Context Switching Failures
```
○ Workspace Switch Attempt Fails
    ↓
□ Failure Scenario Handling
    ├─ [Workspace Deleted] → Switch to remaining workspace
    ├─ [Access Revoked] → Show removal notification
    ├─ [Network Error] → Retry mechanism
    └─ [Invalid State] → Convex handles state recovery
    ↓
○ Context Recovery
    ├─ Fallback to last valid workspace
    ├─ Convex clears invalid state automatically
    ├─ User notification of changes
    └─ Seamless experience restoration
```

### Member Removal During Active Session
```
○ User Gets Removed From Workspace While Active
    ↓
□ Real-Time Detection (Convex)
    ├─ Permission change detected instantly
    ├─ User interface updates immediately
    ├─ Access denied for workspace resources
    └─ Graceful context switch initiated
    ↓
○ Automatic Context Switch
    ├─ Switch to user's remaining workspace
    ├─ Show removal notification
    ├─ Preserve any unsaved work if possible
    └─ Clear workspace-specific data
```

---

## Integration Touch Points

### Better Auth Organization Plugin
- **Workspace Creation**: Seamless organization creation with proper setup
- **Member Management**: Built-in invitation system with token management
- **Role Assignment**: RBAC integration for Owner/Admin/Member permissions
- **Multi-workspace Support**: Handle users across multiple organizations

### Better Auth RBAC Plugin
- **Permission Enforcement**: Real-time permission checking and updates
- **Role Hierarchies**: Clear Owner > Admin > Member permission structure
- **Context Switching**: Permission refresh when changing workspaces
- **Audit Integration**: All role changes logged for compliance

### Polar Billing Integration
- **Per-Workspace Billing**: Independent subscriptions for each workspace
- **Seat-Based Pricing**: $10/month per member seat model
- **Trial Management**: 14-day free trial with automatic conversion
- **Payment Failure Handling**: Grace periods and recovery processes

### Convex Real-Time Data Management
- **Member Presence**: Live member status and activity tracking
- **Permission Changes**: Instant permission updates across all clients
- **Billing Status**: Real-time billing status and feature access updates
- **Workspace Data**: Live workspace information and member lists
- **State Consistency**: Automatic data synchronization across all devices
- **Context Switching**: Seamless workspace context updates

### React Email + Resend
- **Invitation Emails**: Professional invitation email templates
- **Role Change Notifications**: Member role update communications
- **Billing Alerts**: Payment failure and trial expiration notifications
- **Audit Communications**: Important workspace change notifications