# Feature #2: Organization Management (Workspaces)

## Feature Requirements (from MVP Core Features)

### Organization Management ⭐ **Critical**
- [ ] **Create organizations** (teams/companies)
- [ ] **Invite team members** via email
- [ ] **Role-based permissions** (Owner, Admin, Member)
- [ ] **Organization switching** for users in multiple orgs
- [ ] **Basic billing per organization** (via Stripe)

## Technology Stack Integration
- **Clerk Organizations**: Workspace creation and member management
- **Clerk Roles & Permissions**: Role-based permissions (Owner, Admin, Member)
- **Stripe**: Billing integration with per-organization subscription management
- **React Email + Resend**: Email invitations and notifications
- **Convex**: Real-time organization data and member presence

## Business Requirements
- Multi-organization support for users
- Clear role-based access control
- Seamless organization switching interface
- Integrated billing per workspace

---

## Edge Cases (from Feature Edge Cases Breakdown)

### Clerk Organizations Integration
- **Workspace Creation**: Clerk's organization system handles workspace creation
- **Member Management**: Built-in invitation system with email verification
- **Role Assignment**: RBAC plugin provides Owner/Admin/Member roles
- **Multi-workspace Support**: Users can belong to multiple workspaces
- **Billing Association**: Each workspace has separate Stripe subscription

### Workspace Creation States & Edge Cases

#### Happy Path Workflow (Simplified - All Users)
1. **User Signs Up**: Any email type (gmail, corporate, etc.)
2. **Workspace Creation**: Required for all users
3. **Plan Selection**: Choose Free or Pro Trial plan
4. **Workspace Naming**: User chooses workspace name
5. **Owner Role Assignment**: Creator becomes workspace owner
6. **Billing Setup**: Based on selected plan (Free = no payment, Pro Trial = payment info required)
7. **Optional Member Invitations**: "Want to invite teammates?" (Limited for Free plan)
8. **Workspace Dashboard**: User's primary workspace

#### Workspace Creation Edge Cases
- [ ] **Standard Workspace Creation**: Any email type creates workspace
  - Success: Workspace created, user is owner
  - Clerk: Uses organization creation API
- [ ] **Duplicate Workspace Name**: User's chosen name already exists
  - Resolution: Auto-append number "My Workspace (2)"
  - Fallback: Allow user to choose different name
- [ ] **Empty Workspace Name**: User submits blank name
  - Default: Use "Your Workspace" or email-based naming
- [ ] **Very Long Workspace Name**: > 50 characters
  - Action: Truncate and allow editing
- [ ] **Special Characters**: Unicode, emoji in workspace names
  - Behavior: Allow most characters, sanitize for URLs
- [ ] **Workspace Creation Failure**: Database/API error during creation
  - Error: "Failed to create workspace. Please try again."
  - Recovery: Retry mechanism, preserve user input

#### Future Enhancement: Domain Matching (Option 1)
- [ ] **Same Domain Detection**: user@acmecorp.com joins existing acmecorp.com workspace
  - Flow: "Found existing workspace for your company. Join instead?"
  - Process: Send join request to workspace owner for approval
  - Note: Not implemented in MVP, manual invites only

### Member Invitation & Management Edge Cases

#### Invitation Flow (Clerk + React Email + Resend)
- [ ] **Single Member Invitation**: Owner invites one person
  - Process: Clerk invitation creation → React Email template → Resend delivery
- [ ] **Batch Email Invitations**: Owner invites up to 10 people at once
  - UI: Textarea with comma/newline separated emails
  - Validation: Email format check, duplicate detection within batch
  - Processing: Send invitations individually, show batch results
- [ ] **Invalid Email in Batch**: user@invalid-domain mixed with valid emails
  - Behavior: Skip invalid emails, continue with valid ones
  - Report: Show summary "8 invitations sent, 2 failed"

#### Invitation Delivery Edge Cases
- [ ] **Email Delivered Successfully**: Standard invitation flow via Resend
- [ ] **Email Bounced**: Invalid recipient email address
  - Status: Mark invitation as "bounced" in Clerk
  - Action: Notify sender, provide retry option
- [ ] **Resend Rate Limiting**: Too many invitations sent quickly
  - Behavior: Queue emails, respect Resend rate limits
  - User feedback: "Invitations queued for delivery"

#### Invitation Response Edge Cases
- [ ] **Invitation Accepted**: New member joins workspace
  - State: Update Clerk organization membership
  - Convex: Real-time update to all workspace members
- [ ] **Invitation Declined**: Recipient explicitly declines
  - State: Mark invitation as declined, notify sender
- [ ] **Invitation Expired**: > 7 days old (Clerk default)
  - State: Auto-expire invitation, require new invitation
- [ ] **User Already Member**: Invited user is already in workspace
  - Info: "You're already a member of this workspace"
- [ ] **Invitation to Self**: Owner tries to invite their own email
  - Error: "You can't invite yourself to the workspace"

### Role Management Edge Cases (Clerk Roles & Permissions)

#### Role Assignment States (Following Clerk Patterns)
- [ ] **Owner Role**: Full permissions, cannot be removed by others
  - Permissions: All workspace settings, billing, member management
- [ ] **Admin Role**: Most permissions, cannot modify owner
  - Permissions: Member management, document management, limited billing
- [ ] **Member Role**: Basic permissions, document access only
  - Permissions: Create/view own documents, participate in signing flows

#### Role Change Edge Cases
- [ ] **Promote Member to Admin**: Owner promotes existing member
  - Process: Clerk role update
  - Notification: Email notification via React Email + Resend
- [ ] **Owner Transfer**: Current owner wants to transfer ownership
  - Requirement: Must have another admin to transfer to
  - Process: Two-step confirmation (current owner + new owner)
- [ ] **Last Admin Removal**: Trying to remove only admin (besides owner)
  - Error: "Workspace must have at least one admin"

### Multi-Workspace Support Edge Cases

#### Workspace Context Management
- [ ] **Single Workspace**: User belongs to one workspace only
  - UI: No workspace switcher needed
  - Context: All actions scoped to single workspace
- [ ] **Multiple Workspaces**: User belongs to 2+ workspaces
  - UI: Workspace switcher in header/sidebar
  - State: Current workspace context in URL/state management
- [ ] **Workspace Switch**: User changes active workspace
  - Process: Update Convex subscription context
  - Effect: Dashboard updates, document list changes, permissions refresh
- [ ] **Invalid Workspace**: User tries to access workspace they're not in
  - Error: "Access denied. You're not a member of this workspace"

#### Context Persistence Edge Cases
- [ ] **Last Accessed Workspace**: Remember user's preferred workspace
  - Storage: Browser localStorage + user preferences in database
- [ ] **Workspace Deleted**: User's active workspace gets deleted
  - Detection: Convex subscription error on invalid workspace
  - Recovery: Switch to user's remaining workspace
- [ ] **User Removed from Active Workspace**: Admin removes user while active
  - Detection: Real-time permission update via Convex
  - Action: Immediate context switch, show notification

### Billing Integration Edge Cases (Stripe)

#### Simplified Billing Model
- [ ] **New Workspace Created**: Plan-based requirements
  - Free Plan: No payment required, 10 docs/month limit
  - Pro Trial: Payment info required, 2-week trial then $10/month per seat
  - Billing: Independent subscription per workspace
- [ ] **Billing Setup Success**: Stripe subscription active
  - State: Workspace enabled, full feature access
- [ ] **Pro Trial Billing Setup Failure**: Payment info declined, Stripe API error
  - State: Fallback to Free plan with limitations
  - Action: Fix payment method to activate Pro features
- [ ] **Trial Expiration**: 2-week trial ends without payment
  - Effect: Workspace suspended, read-only mode
  - Recovery: Add payment method restores full access

#### Multi-Workspace Billing Edge Cases
- [ ] **User in Multiple Paid Workspaces**: Each workspace pays for user's seat independently
  - Behavior: Each workspace has independent Stripe subscription and pays for their own seats
  - UI: Clear billing context when switching workspaces, user sees features based on current workspace plan
- [ ] **Payment Method Update**: Payment info expires or changes
  - Notification: Email all workspace admins via React Email + Resend
  - Grace Period: 30 days to update payment before downgrade to Free
- [ ] **Failed Payment Mid-Month**: Subscription payment fails during billing cycle
  - **Active Documents Continue**: All signature requests remain functional for recipients
  - **Dashboard Access Maintained**: Workspace owner keeps full dashboard access
  - **Recipients Can Still Sign**: Signing links continue working normally
  - **30-Day Grace Period**: Full functionality for 30 days before any restrictions
  - **Feature Toggle System**: Ability to disable specific features if needed for downgrades
  - Recovery: Update payment method restores normal billing cycle
- [ ] **Plan Downgrade Scenarios**: Handle workspace plan downgrades
  - **Dynamic Feature Control**: Feature toggle system to enable/disable features per plan
  - **Graceful Degradation**: Disable advanced features without breaking core functionality
  - **Data Preservation**: Keep all data intact during plan changes
  - **Upgrade Path**: Easy re-enablement when plan upgraded

### Admin Plugin Controls (Hosted Platform)

#### Platform Admin Override Capabilities
- [ ] **Workspace Management**: Platform admin can access any workspace
  - Permission: Super admin role in Clerk dashboard
  - Audit: All admin actions logged for compliance
- [ ] **Force User Removal**: Remove problematic users from workspaces
  - Process: Admin plugin user management interface
- [ ] **Billing Override**: Admin can modify billing without Stripe
  - Use case: Customer service, refunds, special arrangements
  - Audit: Financial override actions logged

#### Multi-Tenant Security (Admin Plugin)
- [ ] **Workspace Data Isolation**: Each workspace's data completely separate
  - Technical: Clerk ensures proper data scoping
- [ ] **Admin Access Logging**: All platform admin actions tracked
  - Storage: Immutable audit log for compliance
- [ ] **Emergency Access**: Platform issues require immediate access
  - Process: Multi-factor admin authentication
  - Approval: Multiple admin approval for sensitive actions

#### Final Billing Model Decision: Freemium + Workspace-Pays-Per-Seat
- **Free Tier**: 10 docs/month, 1 user, no API access - no payment required
- **Pro Tier**: $10/month per seat (member) in their workspace - unlimited everything
- **Example**: User in 3 workspaces = 3 workspaces each pay for their own seats independently
- **User Experience**: John joins Acme Corp workspace → Acme Corp pays for John's seat, John gets Pro features
- **Rationale**: Freemium drives adoption, workspace owners control billing for Pro features
- **Implementation**: Each workspace has independent Stripe subscription or Free tier, users inherit workspace plan features