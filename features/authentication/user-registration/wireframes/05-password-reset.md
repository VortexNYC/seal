# Password Reset Wireframes - All States

## Screen States & Wireframes

### 🔵 Initial Reset Request State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         🔐 Reset Your Password                                  ║
║                                                                                 ║
║              Enter your email address and we'll send you                       ║
║                    instructions to reset your password.                        ║
║                                                                                 ║
║ ╔═[FORM FIELD: Email]═════════════════════════════════════════════════════╗ ║
║ ║ Email Address                                                            ║ ║
║ ║ ┌─────────────────────────────────────────────────────────────────────┐ ║ ║
║ ║ │ Enter your email address                                            │ ║ ║
║ ║ └─────────────────────────────────────────────────────────────────────┘ ║ ║
║ ║ type="email" autocomplete="email" border-input bg-background            ║ ║
║ ║ ▓▓▓ Email input for password reset request ▓▓▓                         ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═══════════════════════════════════╗ ║
║ ║ Send Reset Link                      │ 400×48px │ Primary action             ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Main action to request password reset ▓▓▓                              ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINKS]═════════════════════════════════════════════════════╗ ║
║ ║ <Back to Sign In>                                                       ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Return to sign in form ▒▒▒                                            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║ ╔═[ALTERNATE ACTION]═════════════════════════════════════════════════════╗ ║
║ ║ Remember your password? <Sign In>                                       ║ ║
║ ║ text-sm text-muted-foreground + link hover:underline                       ║ ║
║ ║ ▒▒▒ Alternative path for users who remember their password ▒▒▒            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Sending Email State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         🔐 Reset Your Password                                  ║
║                                                                                 ║
║ ╔═[FORM FIELD: Email - DISABLED]══════════════════════════════════════════╗ ║
║ ║ Email Address                                                            ║ ║
║ ║ ┌─────────────────────────────────────────────────────────────────────┐ ║ ║
║ ║ │ john.doe@company.com                     [DISABLED]                 │ ║ ║
║ ║ └─────────────────────────────────────────────────────────────────────┘ ║ ║
║ ║ type="email" disabled bg-muted text-muted-foreground                       ║ ║
║ ║ ▒▒▒ Email field locked during processing ▒▒▒                              ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg" disabled]═════════════════════════════╗ ║
║ ║ ⏳ Sending reset link...               │ 400×48px │ Processing state          ║ ║
║ ║ bg-muted text-muted-foreground cursor-not-allowed                          ║ ║
║ ║ ▓▓▓ Loading state while sending email ▓▓▓                                  ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[STATUS MESSAGE]═════════════════════════════════════════════════════╗ ║
║ ║ ⏳ This may take a moment                                                   ║ ║
║ ║ text-sm text-muted-foreground animate-pulse                                ║ ║
║ ║ ▒▒▒ Processing indication for user ▒▒▒                                    ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟢 Email Sent Confirmation State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       📧 Reset Link Sent!                                   │
│                                                                             │
│              We've sent password reset instructions to:                    │
│                        john.doe@company.com                                │
│                                                                             │
│                Check your email and click the reset link.                  │
│                    The link expires in 1 hour.                             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Open Email App                                    │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              Didn't receive the email? <Resend Reset Link>                 │
│                                                                             │
│                        <Back to Sign In>                                   │
│                                                                             │
│                      💡 Check your spam folder too!                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Email Not Found State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         🔐 Reset Your Password                              │
│                                                                             │
│    Email Address                                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ unknown.user@company.com                            ❌              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│        ❌ No account found with this email address.                        │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Try Again                                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Create Account>                                    │
│                        <Back to Sign In>                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Reset Link Valid (New Password Form)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🔐 Create New Password                               │
│                                                                             │
│                   Enter your new password below.                           │
│                                                                             │
│    New Password                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Create a new strong password                           👁          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    ████████░░ Strong                                                        │
│    ✅ 8+ characters ✅ Uppercase ✅ Lowercase ✅ Numbers                    │
│                                                                             │
│    Confirm New Password                                                     │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Confirm your new password                              ✅          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    ✅ Passwords match                                                       │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Update Password                                   │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Reset Link Expired State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ⏰ Reset Link Expired                                │
│                                                                             │
│              This password reset link has expired for                      │
│                        security reasons.                                   │
│                                                                             │
│               Please request a new reset link to continue.                 │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                 Request New Reset Link                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Back to Sign In>                                   │
│                         <Contact Support>                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Reset Link Already Used State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       🔗 Reset Link Already Used                            │
│                                                                             │
│               This password reset link has already been used                │
│                        and is no longer valid.                             │
│                                                                             │
│               If you still need to reset your password,                    │
│                     please request a new link.                             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                 Request New Reset Link                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Try Signing In>                                    │
│                         <Contact Support>                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Updating Password State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🔐 Create New Password                               │
│                                                                             │
│    New Password                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                        [DISABLED]                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Confirm New Password                                                     │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                        [DISABLED]                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                ⏳ Updating password...                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                       ⏳ Securing your account...                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Password Reset Success State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ✅ Password Updated Successfully!                        │
│                                                                             │
│                Your password has been changed securely.                    │
│                 You can now sign in with your new password.                │
│                                                                             │
│                           john.doe@company.com                             │
│                            🔐 Password Updated                              │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                     Sign In Now                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              🔒 For security, you'll need to sign in again                 │
│                     with your new password.                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Password Update Error State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     ❌ Unable to Update Password                             │
│                                                                             │
│              Something went wrong while updating your password.             │
│                        Please try again in a moment.                       │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      Try Again                                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                 <Request New Reset Link>                                   │
│                  <Contact Support>                                         │
│                                                                             │
│              If the problem persists, please contact support.              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Password Reset Form

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│   🔐 Reset Password     │
│                         │
│ Enter your email to     │
│ receive reset link:     │
│                         │
│ Email Address           │
│ ┌─────────────────────┐ │
│ │ Enter email         │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │  Send Reset Link    │ │
│ └─────────────────────┘ │
│                         │
│  <Back to Sign In>      │
│                         │
│ Remember password?      │
│  <Sign In>              │
│                         │
└─────────────────────────┘
```

### 📱 Mobile New Password Form

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│  🔐 New Password        │
│                         │
│ New Password            │
│ ┌─────────────────────┐ │
│ │ Enter password   👁 │ │
│ └─────────────────────┘ │
│ ████████░░ Strong       │
│ ✅ 8+ chars             │
│ ✅ Upper/lower          │
│ ✅ Numbers              │
│                         │
│ Confirm Password        │
│ ┌─────────────────────┐ │
│ │ Confirm         ✅  │ │
│ └─────────────────────┘ │
│ ✅ Passwords match      │
│                         │
│ ┌─────────────────────┐ │
│ │  Update Password    │ │
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Email Input & Validation
- **Format Validation**: Real-time email format checking
- **Account Lookup**: Check if email exists in system
- **Auto-complete**: Support browser email auto-complete
- **Error Recovery**: Clear path to account creation if not found

### Password Strength & Validation
- **Real-time Strength**: Visual strength meter while typing
- **Requirement Checklist**: Clear visual feedback for each rule
- **Show/Hide Toggle**: Password visibility control
- **Match Validation**: Real-time confirmation matching

### Reset Link Security
- **Single Use**: Links invalidated after successful use
- **Time Limited**: 1-hour expiration for security
- **Secure Tokens**: Cryptographically secure link generation
- **Rate Limiting**: Prevent reset link spam

---

## Technical Integration

### Better Auth Integration
- **Password Reset Flow**: Integrated with Better Auth patterns
- **Email Service**: React Email + Resend for delivery
- **Security Tokens**: Secure token generation and validation
- **Session Management**: Force re-authentication after reset

### Email Templates
- **React Email**: Styled, responsive email templates
- **Personalization**: User name and email in templates
- **Security Messaging**: Clear security context in emails
- **Link Tracking**: Monitor link click rates

### State Management
- **Reset Flow State**: Track user progress through flow
- **Error Handling**: Clear error recovery at each step
- **Success Confirmation**: Positive feedback for completion
- **Security Logging**: Audit trail for password resets

---

## Accessibility Features

- **Screen Reader**: Form labels and status announcements
- **Keyboard Navigation**: Tab order through all interactive elements
- **Focus Management**: Clear visual focus indicators
- **Error Handling**: ARIA live regions for validation messages
- **High Contrast**: Error states clearly distinguishable

---

## Security Considerations

### Reset Link Security
- **Cryptographic Tokens**: High-entropy token generation
- **Time Bounds**: Short expiration window (1 hour)
- **Single Use**: Tokens invalidated after successful reset
- **Rate Limiting**: Prevent abuse and brute force attempts

### Password Security
- **Strength Requirements**: Enforce Better Auth password rules
- **Common Password Detection**: Prevent weak/common passwords
- **Secure Storage**: Proper password hashing on backend
- **Session Invalidation**: Force re-auth with new password