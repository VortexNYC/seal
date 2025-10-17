# Authentication Permission Requirements - Better Auth RBAC Integration

## Permission Matrix Overview

This document maps all authentication-related permissions using Better Auth's RBAC plugin structure. All permissions are scoped to workspaces (organizations) with role-based access control.

---

## User Authentication States

### Unauthenticated User Access

#### **Public Routes (No Authentication Required)**
- **Landing Page**: `/`
  - View marketing content
  - Access sign-up and sign-in forms
  - Use OAuth providers (Google, Microsoft, Apple)
  - View public documentation/help

- **Authentication Forms**: `/signup`, `/signin`, `/reset-password`
  - Submit authentication credentials
  - Complete OTP verification
  - Reset password via email link
  - View authentication error states

- **Document Signing (Recipients)**: `/sign/{token}`
  - Access documents via secure signing link
  - Sign documents without creating account
  - View document content in signing ceremony
  - Complete signature and input fields

#### **Restricted Actions**
- Cannot access dashboard or workspace features
- Cannot create or manage documents
- Cannot invite team members
- Cannot access API keys or billing

---

## Authenticated User Permissions

### Base Authenticated User (No Workspace)
- **Profile Management**: 
  - Update personal profile information
  - Change password and security settings
  - Manage notification preferences
  - View authentication history

- **Workspace Actions**:
  - Create new workspace (becomes owner)
  - Accept workspace invitations
  - View pending invitations
  - Decline invitations

#### **Restricted Actions**
- Cannot access any workspace features until assigned to workspace
- Cannot create documents or templates
- Cannot access billing or organization settings

---

## Workspace Role-Based Permissions

### Workspace Owner Role (`owner`)

#### **Full Access Permissions**
- **Authentication & Security**:
  - Manage workspace security settings
  - Configure SSO/SAML integration (future)
  - View organization-wide authentication logs
  - Force password resets for members
  - Configure password policies (future)

- **Member Management**:
  - Invite new members with any role
  - Change member roles (promote/demote)
  - Remove members from workspace
  - Transfer ownership to another member
  - View all member activity and login history

- **Workspace Administration**:
  - Update workspace name and settings
  - Delete entire workspace
  - Configure billing and subscription
  - Generate and manage API keys
  - Access audit trails and compliance reports

- **Document Management**:
  - Full CRUD access to all documents
  - Manage shared templates
  - Configure document retention policies
  - Export/import workspace data

### Workspace Admin Role (`admin`)

#### **Administrative Permissions**
- **Member Management** (Limited):
  - Invite new members as `member` role only
  - View member list and basic activity
  - Cannot change member roles
  - Cannot remove other admins or owners

- **Document Management**:
  - Full CRUD access to workspace documents
  - Create and manage shared templates
  - Configure document workflows
  - Assign document permissions

- **Security**:
  - View security logs
  - Configure 2FA requirements (future)
  - Manage API key usage
  - Access basic compliance reports

#### **Restricted Actions**
- Cannot manage workspace billing/subscription
- Cannot delete workspace
- Cannot change other admin/owner permissions
- Cannot transfer workspace ownership

### Workspace Member Role (`member`)

#### **Standard Access Permissions**
- **Document Management**:
  - Create and manage own documents
  - Use shared templates (read-only)
  - Send documents for signature
  - Access document signing URLs
  - View own document history

- **Collaboration**:
  - Share documents with other workspace members
  - Comment on documents (if enabled)
  - Receive notifications about shared documents
  - Access team directory

- **Personal Settings**:
  - Update personal profile within workspace
  - Configure notification preferences
  - Manage personal API keys (if enabled)
  - View own activity history

#### **Restricted Actions**
- Cannot invite new members
- Cannot access billing information
- Cannot modify workspace settings
- Cannot manage other users' documents (unless shared)
- Cannot delete workspace or change roles

---

## API Key Permissions

### API Key Generation Access
- **Workspace Owner**: Can generate organization-wide API keys with full permissions
- **Workspace Admin**: Can generate limited API keys with document management permissions
- **Workspace Member**: Can generate personal API keys (if enabled in workspace settings)

### API Key Permission Scopes
- **Document Management**: CRUD operations on documents within workspace
- **Template Access**: Read access to shared templates
- **Signature Workflows**: Create and manage signature requests
- **Webhook Management**: Configure and manage webhook endpoints
- **Member Read Access**: Read workspace member information
- **Audit Access**: Read audit logs and compliance data (admin+ only)

---

## Email Verification Requirements

### New User Registration
- **Email Verification Mandatory**: All new accounts must verify email before workspace access
- **Workspace Invitation**: Invited users can complete workspace onboarding after email verification
- **Cross-Workspace Signing**: Document signers must have verified accounts to sign documents from other workspaces

### Existing User Email Changes
- **Re-verification Required**: Changing email address requires new verification
- **Workspace Notifications**: All workspace members notified of email changes for security
- **Session Management**: Force re-authentication after email change

---

## Session Management & Security

### Session Duration by Role
- **Workspace Owner**: Extended sessions (30 days with "Remember Me")
- **Admin/Member**: Standard sessions (7 days with "Remember Me")
- **Cross-Workspace Signers**: Standard user sessions when signing documents from other workspaces

### Multi-Workspace Access
- **Workspace Switching**: Users can switch between workspaces they belong to
- **Permission Context**: Permissions change based on current workspace context
- **Plan Context**: Feature access determined by current workspace's subscription plan
- **Role Inheritance**: User may have different roles in different workspaces
- **Billing Context**: Each workspace has independent billing/subscription

### Security Escalation
- **Sensitive Actions**: Require recent authentication (password/2FA within last hour)
  - Changing workspace ownership
  - Deleting workspace
  - Managing billing information
  - Generating API keys with elevated permissions

---

## Better Auth Plugin Integration

### Organization Plugin Configuration
```javascript
organizations: {
  allowUserToCreateOrganization: true,
  organizationLimit: 5, // Max workspaces per user
  invitationExpiresIn: 7 * 24 * 60 * 60, // 7 days
  roles: [
    { name: "owner", description: "Workspace Owner - Full Access" },
    { name: "admin", description: "Workspace Admin - Management Access" },
    { name: "member", description: "Workspace Member - Standard Access" }
  ]
}
```

### RBAC Plugin Permissions
```javascript
rbac: {
  roles: {
    owner: ["*"], // Full access to all resources
    admin: [
      "document:*",
      "template:*", 
      "member:read",
      "member:invite",
      "api-key:create:limited",
      "audit:read:basic"
    ],
    member: [
      "document:create",
      "document:read:own",
      "document:update:own",
      "document:delete:own",
      "template:read:shared",
      "profile:update:own"
    ]
  }
}
```

### Admin Plugin Configuration
```javascript
admin: {
  allowedRoles: ["owner"],
  adminPath: "/admin",
  permissions: [
    "workspace:manage",
    "user:impersonate", 
    "billing:manage",
    "analytics:view:all"
  ]
}
```

---

## Permission Validation Patterns

### Frontend Permission Checks
- **Route Guards**: Verify authentication and workspace membership
- **Component Rendering**: Conditionally show features based on role permissions
- **Action Buttons**: Disable actions user cannot perform
- **Navigation Menus**: Hide inaccessible sections

### Backend Permission Enforcement
- **API Endpoints**: Validate permissions before processing requests
- **Database Queries**: Scope data access by workspace and role
- **Webhook Events**: Include permission context in event payloads
- **Audit Logging**: Log all permission checks and access attempts

---

## Edge Cases & Special Permissions

### Workspace Deletion Scenarios
- **Owner Leaves**: Must transfer ownership before leaving
- **Last Member**: Workspace enters "abandoned" state with 90-day recovery
- **Billing Lapse**: Workspace features restricted but data preserved

### Cross-Workspace Document Sharing
- **External Recipients**: Must create accounts to sign documents from other workspaces
- **Account-Based Access**: All signers require verified accounts for security and audit trail
- **Template Sharing**: Public templates accessible across workspaces (future)

### Emergency Access
- **Account Recovery**: Platform admins can assist with account recovery
- **Workspace Recovery**: Owner can recover "deleted" workspace within 90 days
- **Legal Compliance**: Authorized personnel can access documents for legal requirements

---

This permission structure ensures secure, role-based access control while maintaining flexibility for different workspace configurations and use cases.