# Sign In Form Wireframes - All States

## Screen States & Wireframes

### 🟢 Document Signing Context State (Existing User)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                       📄 You've been invited to sign                            ║
║                        "Employment Agreement.pdf"                               ║
║                                                                                 ║
║                        Sign in to view and sign                                 ║
║                                                                                 ║
║ ╔═[INPUT: type="email" prefilled state]══════════════════════════════════════╗ ║
║ ║ sarah@example.com                       │ 400×44px │ PREFILLED             ║ ║
║ ║ border-input bg-background text-foreground                                  ║ ║
║ ║ ▒▒▒ Prefilled email from document invitation context ▒▒▒                   ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[INPUT: type="password" placeholder state]═══════════════════════════════════╗ ║
║ ║ Enter your password          👁         │ 400×44px │ PASSWORD              ║ ║
║ ║ border-input bg-background text-muted-foreground                            ║ ║
║ ║ ▒▒▒ Password field with toggle visibility ▒▒▒                              ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[CHECKBOX & LINK]═══════════════════════════════════════════════════════════╗ ║
║ ║ [x] Remember me                     <Forgot password?>                      ║ ║
║ ║ checkbox + text-sm + link hover:underline                                   ║ ║
║ ║ ▒▒▒ Session persistence and password recovery options ▒▒▒                  ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]════════════════════════════════════════╗ ║
║ ║ Sign In & Continue to Sign          │ 400×48px │ Primary action            ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Context-aware CTA for document signing flow ▓▓▓                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║                               OR                                                ║
║                                                                                 ║
║ ╔═[OAUTH BUTTONS]═════════════════════════════════════════════════════════════╗ ║
║ ║ 🔗 Continue with Google  │  🔗 Continue with Microsoft                      ║ ║
║ ║ variant="outline" size="default" │ 190×40px each                          ║ ║
║ ║ ▒▒▒ Side-by-side OAuth provider buttons ▒▒▒                                ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINK]═══════════════════════════════════════════════════════════╗ ║
║ ║ Don't have an account? <Create Account>                                     ║ ║
║ ║ text-sm text-muted-foreground + link                                        ║ ║
║ ║ ▒▒▒ Account creation path for new users ▒▒▒                                ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[INFO ALERT]════════════════════════════════════════════════════════════════╗ ║
║ ║ ℹ️  You'll be directed to sign the document after signing in                ║ ║
║ ║ bg-blue/10 text-blue border-blue/20                                        ║ ║
║ ║ ▒▒▒ Context guidance for document signing workflow ▒▒▒                     ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔵 Initial State (Empty Form)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                            Welcome Back                                         ║
║                                                                                 ║
║ ╔═[INPUT: type="email" placeholder state]══════════════════════════════════════╗ ║
║ ║ Enter your email address                │ 400×44px │ PLACEHOLDER           ║ ║
║ ║ border-input bg-background text-muted-foreground                            ║ ║
║ ║ ▒▒▒ Empty email field with placeholder text ▒▒▒                            ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[INPUT: type="password" placeholder state]═══════════════════════════════════╗ ║
║ ║ Enter your password          👁         │ 400×44px │ PASSWORD              ║ ║
║ ║ border-input bg-background text-muted-foreground                            ║ ║
║ ║ ▒▒▒ Empty password field with toggle visibility ▒▒▒                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[CHECKBOX & LINK]═══════════════════════════════════════════════════════════╗ ║
║ ║ [x] Remember me                     <Forgot password?>                      ║ ║
║ ║ checkbox + text-sm + link hover:underline                                   ║ ║
║ ║ ▒▒▒ Session persistence and password recovery options ▒▒▒                  ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg" disabled]═══════════════════════════════╗ ║
║ ║ Sign In                             │ 400×48px │ DISABLED                  ║ ║
║ ║ bg-muted text-muted-foreground cursor-not-allowed                          ║ ║
║ ║ ▒▒▒ Disabled until form validation passes ▒▒▒                              ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║                               OR                                                ║
║                                                                                 ║
║ ╔═[OAUTH BUTTONS ROW 1]═══════════════════════════════════════════════════════╗ ║
║ ║ 🔗 Continue with Google  │  🔗 Continue with Microsoft                      ║ ║
║ ║ variant="outline" size="default" │ 190×40px each                          ║ ║
║ ║ ▒▒▒ Side-by-side OAuth provider buttons ▒▒▒                                ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║ ╔═[OAUTH BUTTONS ROW 2]═══════════════════════════════════════════════════════╗ ║
║ ║ 🔗 Continue with Apple              │ 400×40px │ Apple OAuth               ║ ║
║ ║ variant="outline" size="default"                                           ║ ║
║ ║ ▒▒▒ Full-width Apple OAuth button ▒▒▒                                      ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINK]═══════════════════════════════════════════════════════════╗ ║
║ ║ Don't have an account? <Create Account>                                     ║ ║
║ ║ text-sm text-muted-foreground + link                                        ║ ║
║ ║ ▒▒▒ Account creation path for new users ▒▒▒                                ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Editing State (Valid Input)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            Welcome Back                                     │
│                                                                             │
│    Email Address                                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ john.doe@company.com                                    ✅          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Password                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                                       👁          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    [x] Remember me                          <Forgot password?>             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Sign In                                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                               OR                                            │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  🔗 Continue with Google  │  🔗 Continue with Microsoft           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Authentication Error State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            Welcome Back                                     │
│                                                                             │
│    Email Address                                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ john.doe@company.com                                    ❌          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Password                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                                       ❌          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ❌ Incorrect email or password. Please try again.                       │
│                                                                             │
│    [x] Remember me                          <Forgot password?>             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Sign In                                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Account Locked State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🔒 Account Temporarily Locked                        │
│                                                                             │
│              Your account has been locked due to multiple                  │
│                       failed sign-in attempts.                             │
│                                                                             │
│                    Try again in 15 minutes, or reset                       │
│                           your password below.                             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                     Reset Password                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                          <Back to Sign In>                                 │
│                         <Contact Support>                                  │
│                                                                             │
│                        Time remaining: 14:32                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Signing In State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            Welcome Back                                     │
│                                                                             │
│    Email Address                                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ john.doe@company.com                     [DISABLED]                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Password                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                         [DISABLED]                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    ⏳ Signing you in...                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ⏳ Please wait a moment                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚪ Email Not Verified State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                      📧 Email Verification Required                         │
│                                                                             │
│              Please verify your email address before signing in.           │
│                                                                             │
│                We sent a verification link to:                             │
│                        john.doe@company.com                                │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                  Resend Verification Email                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Use Different Email>                              │
│                          <Contact Support>                                 │
│                                                                             │
│              Didn't receive the email? Check your spam folder.             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Multiple Workspaces State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        👋 Welcome back, John!                               │
│                                                                             │
│                      Choose your workspace:                                │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  🏢 Acme Corporation                          Owner • Team Plan     │  │
│    │     3 active documents • 12 team members                           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  👤 Personal Workspace                        Owner • Free Plan     │  │
│    │     1 active document • Just you                                   │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  🤝 Freelance Projects                        Member • Pro Plan     │  │
│    │     5 active documents • 4 team members                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Create New Workspace>                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Sign In Form

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│     Welcome Back        │
│                         │
│ Email Address           │
│ ┌─────────────────────┐ │
│ │ Enter email         │ │
│ └─────────────────────┘ │
│                         │
│ Password                │
│ ┌─────────────────────┐ │
│ │ Enter password   👁 │ │
│ └─────────────────────┘ │
│                         │
│ [x] Remember me         │
│ <Forgot password?>      │
│                         │
│ ┌─────────────────────┐ │
│ │      Sign In        │ │
│ └─────────────────────┘ │
│                         │
│        OR               │
│                         │
│ ┌─────────────────────┐ │
│ │ 🔗 Google          │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔗 Microsoft       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔗 Apple           │ │
│ └─────────────────────┘ │
│                         │
│  <Create Account>       │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Form Field Behaviors
- **Email Field**: 
  - Format validation on blur
  - Auto-complete support
  - Remember last used email

- **Password Field**: 
  - Show/hide toggle
  - Auto-complete support for password managers
  - Clear on multiple failed attempts

- **Remember Me**: 
  - Extends session duration (Better Auth configuration)
  - Persists workspace selection
  - Clear visual indication when checked

### Authentication Flow
- **Rate Limiting**: Better Auth handles attempt limiting
- **Session Management**: JWT tokens via Better Auth + Convex
- **Multi-Workspace**: Show workspace selector after successful auth
- **Plan Context**: User inherits features from the selected workspace's subscription plan

### OAuth Integration
- **Provider Support**: Google, Microsoft, Apple via Better Auth
- **Error Handling**: Clear fallback to email/password
- **Account Linking**: Handle existing account scenarios

---

## Security Features

### Failed Attempt Handling
- Progressive warnings (2 attempts remaining, etc.)
- Temporary lockout after 5 failed attempts
- Clear recovery path via password reset
- Rate limiting display with countdown timer

### Session Security
- Secure cookie handling
- Session timeout management
- Device fingerprinting (future enhancement)
- Suspicious activity detection

---

## Accessibility Features

- **Screen Reader**: Form labels and error announcements
- **Keyboard Navigation**: Tab order through form and OAuth options
- **Focus Management**: Clear focus indicators
- **Error Handling**: ARIA live regions for authentication errors
- **High Contrast**: Error states clearly visible

---

## Technical Integration

### Better Auth Integration
- Email/password authentication
- OAuth provider configuration (Google, Microsoft, Apple)
- Session management and refresh tokens
- Rate limiting and security features

### State Management
- Form state via TanStack Form
- Authentication state via Better Auth
- Loading states and error handling
- Workspace selection persistence