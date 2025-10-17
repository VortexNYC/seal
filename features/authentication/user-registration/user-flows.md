# Authentication User Flows

Complete user flow documentation for Feature #1: User Registration & Authentication, extracted from feature specifications and edge cases.

## 🎯 Flow Overview

### Primary Authentication Paths
1. **Sign Up Flow** (New Users)
2. **Sign In Flow** (Returning Users)
3. **OAuth Flow** (Google, Microsoft, Apple)
4. **Password Reset Flow** (Forgot Password)
5. **Email Verification Flow** (OTP Process)
6. **Account Deletion Flow** (Data Management)

### States Legend
- 🟢 **Happy Path** (normal successful flow)
- 🟡 **Loading/Processing** (waiting states)
- 🔴 **Error State** (something went wrong)
- 🔵 **Empty/First-time** (initial experience)
- ⚪ **Edge Case** (unusual but handled)

---

## 🚀 Sign Up Flow (New Users)

### Happy Path Workflow 🟢

```
Landing Page
    ↓
[Create Account] Button
    ↓
Sign Up Form 🔵
├─ Email field: [_______________]
├─ Password field: [***********]  
├─ Confirm Password: [***********]
└─ [Sign Up] Button
    ↓
Real-time Validation ✅
├─ Email format check
├─ Password strength meter
└─ Password match indicator
    ↓
Form Submission 🟡
├─ Loading spinner
├─ Form disabled
└─ "Creating account..." message
    ↓
Email OTP Verification 📧
├─ Success message: "Check your email!"
├─ Code input: [_ _ _ _ _ _]
├─ Timer: "Code expires in 9:45"
└─ [Verify Code] Button
    ↓
Code Verification Success ✅
    ↓
Account Activated Welcome 🎉
├─ "Welcome to [App Name]!"
├─ Email confirmed indicator
└─ [Continue] Button
    ↓
Plan Selection 💳
├─ Free Plan: 10 docs/month, 1 user, no API
├─ Pro Trial: Unlimited, $10/month per seat after trial
└─ [Choose Plan] Button
    ↓
Workspace Creation 🏢
├─ Workspace name input
├─ "You'll be the owner" note
└─ [Create Workspace] Button
    ↓
Onboarding Flow 📚
├─ Welcome tour (optional)
├─ Sample documents
└─ Getting started guide
    ↓
Dashboard 🏠
```

### Error Paths & Edge Cases 🔴

#### Email Validation Errors
```
Email Input
    ↓
Validation Check
    ├─ Invalid format → "Please enter a valid email address"
    ├─ Already exists → "Account exists. Try signing in instead."
    │                   ↓
    │                [Sign In] Link (email pre-filled)
    ├─ Disposable email → Warning: "Temporary emails may cause issues"
    │                     ├─ [Continue Anyway]
    │                     └─ [Use Different Email]
    └─ Too long (>200) → "Email address too long (max 200 characters)"
```

#### Password Validation Errors  
```
Password Input (Better Auth Rules)
    ↓
Strength Check
    ├─ Too short (<8) → "Password must be at least 8 characters"
    ├─ Too weak → "Password needs uppercase, lowercase, and numbers"
    ├─ Common password → "This password is too common"
    └─ Confirmation mismatch → "Passwords don't match"
        ↓
    Real-time Correction
        ↓
    [Try Again] or [Fix Password]
```

#### OTP Verification Errors
```
OTP Code Entry [_ _ _ _ _ _]
    ↓
Code Validation
    ├─ Valid code → Continue to Account Activated ✅
    ├─ Invalid code → "Invalid code. Check your email and try again"
    │                 ├─ Attempts: 1/5 remaining
    │                 └─ [Try Again]
    ├─ Code expired → "Code expired. Request a new one"
    │                 └─ [Resend Code] Button
    ├─ Too many attempts → "Too many failed attempts"
    │                      └─ [Request New Code] (force new OTP)
    └─ Email delayed → "Didn't receive code?"
                       ├─ [Resend Code]
                       ├─ [Check Spam Folder]
                       └─ [Use Different Email]
```

---

## 🔑 Sign In Flow (Returning Users)

### Happy Path Workflow 🟢

```
Landing Page
    ↓
[Sign In] Button
    ↓
Sign In Form
├─ Email field: [user@example.com]
├─ Password field: [***********]
├─ [x] Remember me
├─ <Forgot password?> Link
├─ [Sign In] Button
└─ OAuth Options:
    ├─ [Continue with Google]
    ├─ [Continue with Microsoft] 
    └─ [Continue with Apple]
    ↓
Better Auth Validation 🟡
    ↓
Authentication Success ✅
    ↓
Role & Workspace Check
├─ Single workspace → Dashboard
├─ Multiple workspaces → Workspace Selector
└─ Admin user → Admin Dashboard
    ↓
Dashboard with Session Active 🏠
```

### Error Paths & Edge Cases 🔴

#### Credential Errors
```
Sign In Attempt
    ↓
Better Auth Validation
    ├─ Invalid email → "No account found with this email"
    │                  └─ [Create Account] Link
    ├─ Wrong password → "Incorrect password"
    │                   ├─ [Try Again]
    │                   └─ <Forgot password?> Link
    ├─ Account locked → "Account temporarily locked"
    │                   ├─ Reason: Too many attempts
    │                   ├─ Timer: "Try again in 15 minutes"
    │                   └─ [Reset Password] Option
    └─ Email not verified → "Please verify your email first"
                            └─ [Resend Verification]
```

#### Rate Limiting (Better Auth)
```
Multiple Failed Attempts
    ↓
Rate Limiting Triggered
    ├─ Warning: "2 attempts remaining"
    ├─ Lockout: "Account locked for 15 minutes"
    ├─ [Reset Password] Option
    └─ Admin Override: (Admin Plugin)
        └─ Platform admin can unlock
```

---

## 🔗 OAuth Flow (Google, Microsoft, Apple)

### Happy Path Workflow 🟢

```
Sign In Form
    ↓
[Continue with Google] Button
    ↓
OAuth Redirect 🟡
├─ "Redirecting to Google..."
├─ Loading spinner
└─ Opens provider auth
    ↓
Provider Authentication
    ↓
OAuth Success ✅
    ↓
Account Check
    ├─ Existing account → Sign In Success → Dashboard
    └─ New account → Account Creation
        ↓
        Workspace Creation
        ↓
        Onboarding Flow
        ↓
        Dashboard
```

### Error Paths & Edge Cases 🔴

```
OAuth Process
    ├─ User cancels → "Sign in cancelled. Try again when ready."
    │                 └─ [Try Again] or [Use Email/Password]
    ├─ Provider error → "Sign in failed. Please try again."
    │                   ├─ [Try Again]
    │                   └─ [Use Email/Password]
    ├─ Email mismatch → "Link accounts or create new?"
    │                   ├─ [Link to Existing Account]
    │                   └─ [Create New Account]
    └─ Network timeout → "Connection timed out"
                         ├─ [Try Again]
                         └─ [Use Email/Password]
```

---

## 🔐 Password Reset Flow

### Happy Path Workflow 🟢

```
Sign In Form
    ↓
<Forgot password?> Link
    ↓
Password Reset Form
├─ Email field: [_______________]
├─ "We'll send reset instructions"
└─ [Send Reset Link]
    ↓
Email Sent Confirmation 📧
├─ "Check your email for reset link"
├─ "Link expires in 1 hour"
└─ [Back to Sign In]
    ↓
Email Link Clicked
    ↓
Reset Password Form
├─ New password: [***********]
├─ Confirm password: [***********]
├─ Password strength meter
└─ [Reset Password]
    ↓
Password Reset Success ✅
├─ "Password updated successfully"
└─ [Sign In Now]
    ↓
Sign In Form (email pre-filled)
```

### Error Paths & Edge Cases 🔴

```
Password Reset Process
    ├─ Email not found → "No account with this email"
    │                    └─ [Create Account] Link
    ├─ Link expired → "Reset link expired"
    │                 └─ [Request New Link]
    ├─ Link already used → "Link already used"
    │                       └─ [Request New Link]
    ├─ Weak password → Better Auth validation errors
    │                  └─ [Try Stronger Password]
    └─ Server error → "Unable to reset password"
                      ├─ [Try Again]
                      └─ [Contact Support]
```

---

## ✅ Email Verification Flow

### OTP Process (6-Digit Code) 🟢

```
Account Created
    ↓
Email Sent 📧
├─ React Email + Resend
├─ Subject: "Verify your email"
└─ 6-digit code: 123456
    ↓
Verification Screen
├─ "We sent a code to user@example.com"
├─ Code input: [_ _ _ _ _ _]
├─ Timer: "Code expires in 9:45"
├─ [Verify Code] Button
└─ "Didn't receive it? [Resend]"
    ↓
Code Entry Success ✅
    ↓
Account Verified
├─ "Email verified successfully!"
└─ Continue to workspace creation
```

### Error Handling 🔴

```
Verification Issues
    ├─ Wrong code → "Invalid code. Check your email."
    │               ├─ Attempts: X/5 remaining
    │               └─ [Try Again]
    ├─ Expired → "Code expired. Request a new one."
    │            └─ [Resend Code]
    ├─ Max attempts → "Too many attempts."
    │                 └─ [Request New Code]
    ├─ Email delayed → "Check spam folder"
    │                  ├─ [Resend Code]
    │                  └─ [Use Different Email]
    └─ Multiple requests → Invalidate previous codes
                           └─ Only latest code works
```

---

## 🗑️ Account Deletion Flow

### Deletion Process (90-Day Grace) 🟢

```
User Settings
    ↓
Account Section
    ↓
[Delete Account] Button
    ↓
Pre-deletion Checks
├─ Active documents? → Warning + Cancel options
├─ Team ownership? → Transfer or delete team first
└─ Active subscription? → Cancel subscription first
    ↓
Deletion Confirmation
├─ "This action cannot be undone"
├─ "90-day grace period applies"
├─ Checkbox: [ ] "I understand my data will be deleted"
├─ Password confirmation: [***********]
└─ [Delete Account] Button
    ↓
Grace Period Started ⏳
├─ Account deactivated
├─ 90-day countdown
└─ Recovery email sent
    ↓
Final Deletion (Day 90)
├─ Personal data removed
├─ Signed documents preserved (compliance)
└─ Audit trails maintained
```

### Edge Cases & Blocks 🔴

```
Deletion Blocked
    ├─ Active documents → "Cancel X active documents first"
    │                     ├─ [View Documents]
    │                     └─ [Cancel All]
    ├─ Team owner → "Transfer ownership first"
    │               ├─ [Transfer to Member]
    │               └─ [Delete Team]
    ├─ Subscription → "Cancel subscription first"
    │                 └─ [Manage Billing]
    └─ Admin override → Platform admin can force deletion
```

---

## 🔐 Session Management Patterns

### Session States
```
User Authentication Status:
├─ Unauthenticated → Landing/Sign In
├─ Authenticated → Dashboard access
├─ Session Expired → Auto-redirect to Sign In
├─ Remember Me → Extended session
└─ Admin Session → Admin Dashboard access
```

### Session Transitions
```
Session Lifecycle:
○ Sign In Success → Active Session
    ↓
□ Periodic Token Refresh (Better Auth)
    ↓
◇ Session Check
    ├─ Valid → Continue
    ├─ Expired → Sign In Required
    └─ Suspicious → Force Re-auth
        ↓
○ Sign Out → Session Terminated
```

---

## 📱 Mobile-Specific Considerations

### Touch Interactions
- **Form fields**: Minimum 44px touch targets
- **OAuth buttons**: Large, thumb-friendly
- **OTP input**: Large digit boxes for easy tapping
- **Password visibility**: Toggle button for password reveal

### Mobile Flows
- **Keyboard handling**: Adjust viewport for input fields
- **App switching**: Handle OAuth redirects gracefully
- **Offline detection**: Show connection status
- **Auto-fill**: Support password managers

---

## 🎯 Success Criteria

### Flow Completion Metrics
- **Sign Up Success**: >90% complete sign-up to workspace creation
- **Sign In Success**: >95% successful logins  
- **Error Recovery**: >85% successful recovery from errors
- **Mobile Performance**: Equal success rates on mobile

### Time Targets
- **Sign Up Flow**: <3 minutes from start to workspace
- **Sign In Flow**: <30 seconds to dashboard
- **Password Reset**: <2 minutes total process
- **OTP Verification**: <1 minute from email to verified

---

## 📄 Cross-Workspace Document Signing Flow

### External Signer Account Creation Flow
```
○ Document Signing Link Received
    ↓
◇ User Has Account?
   ├─ Yes → 🟢 Sign In with Document Context
   │        ↓
   │    ◇ Email Matches?
   │        ├─ Yes → 🟢 Proceed to Document Signing
   │        └─ No → 🔴 Email Mismatch Error
   │
   └─ No → 🟢 Create Account with Document Context
            ↓
        □ Fill Sign-Up Form (email pre-filled)
            ↓
        □ Account Created + Personal Workspace Created
            ↓
        ◉ Redirect to Document Signing Interface
```

### Cross-Workspace Signing Authentication
```
External Signer Flow:
○ Authenticated User from Personal Workspace
    ↓
□ Accessing Document from Different Workspace
    ↓
◇ Permission Check
    ├─ Valid Document Access → 🟢 Sign Document
    │                           ↓
    │                       □ Signature Recorded in Origin Workspace
    │                           ↓
    │                       ◉ Return to Personal Dashboard
    │
    └─ Invalid Access → 🔴 Access Denied
                          ↓
                      < Contact Document Sender >
```

### Authentication Context Management
```
Cross-Workspace Context:
○ User Authenticated in Personal Workspace
    ↓
□ Click Document Signing Link
    ↓
◇ Document Workspace Context
    ├─ Same Workspace → 🟢 Direct Access
    │
    └─ Different Workspace → 🟡 Cross-Workspace Mode
                              ↓
                          □ Maintain Personal Auth Session
                              ↓
                          □ Access Document in Foreign Workspace Context
                              ↓
                          □ Sign Document (audit trail includes both workspaces)
                              ↓
                          ◉ Return to Personal Workspace Dashboard
```

### Account Creation During Signing Flow
```
"Create Account to Sign" Flow:
○ Click Document Signing Link (No Account)
    ↓
□ Document Context Sign-Up Page
    ├─ Document Name Displayed: "Employment Agreement.pdf"
    ├─ Email Pre-filled from Document Recipient
    ├─ Required: Full Name + Password
    └─ Button: "Create Account & Continue to Sign"
    ↓
□ Better Auth Account Creation
    ├─ Email Verification Required
    ├─ Personal Workspace Auto-Created
    └─ User Profile Established
    ↓
□ Email Verification
    ├─ Verification Email Sent
    ├─ User Clicks Verification Link
    └─ Account Activated
    ↓
◉ Redirect to Document Signing Interface
    ├─ User Now Authenticated
    ├─ Document Ready for Signing
    └─ Full Audit Trail Established
```

---

This comprehensive authentication flow documentation ensures consistent user experiences across all entry points while maintaining security and compliance requirements for both workspace members and cross-workspace document signing scenarios.