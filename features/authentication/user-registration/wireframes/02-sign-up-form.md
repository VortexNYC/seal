# Sign Up Form Wireframes - All States

## Screen States & Wireframes

### 🟢 Document Signing Context State (New Entry Point)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║ ╭─[DOCUMENT CONTEXT: FileText icon with blue accent]─────────────────────╮   ║
║ │ 📄 You've been invited to sign                                          │   ║
║ │ "Employment Agreement.pdf" │ text-lg.font-medium                       │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║                     Create your account to view and sign                     ║
║                         text-muted-foreground                                ║
║                                                                               ║
║ ╔═[FORM CONTAINER: Card with proper spacing]═════════════════════════════╗   ║
║ ║                                                                         ║   ║
║ ║ Email Address │ FormLabel                                               ║   ║
║ ║ ╔═[INPUT: type="email" prefilled disabled]═════════════════════════╗   ║   ║
║ ║ ║ sarah@example.com │ 400×44px │ [PREFILLED]                       ║   ║   ║
║ ║ ║ border-input bg-muted text-muted-foreground                      ║   ║   ║
║ ║ ║ ▒▒▒ Pre-populated from invitation ▒▒▒                            ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ Full Name │ FormLabel                                                   ║   ║
║ ║ ╔═[INPUT: type="text" placeholder]══════════════════════════════════╗   ║   ║
║ ║ ║ Enter your full name │ 400×44px                                   ║   ║   ║
║ ║ ║ border-input bg-background focus-visible:ring-2                   ║   ║   ║
║ ║ ║ ░░░ placeholder:text-muted-foreground ░░░                         ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ Password │ FormLabel                                                    ║   ║
║ ║ ╔═[INPUT: type="password" with eye toggle]═════════════════════════╗   ║   ║
║ ║ ║ Create a strong password │ 400×44px │ 👁 Toggle                  ║   ║   ║
║ ║ ║ border-input bg-background pr-10                                  ║   ║   ║
║ ║ ║ ▒▒▒ Eye icon absolute right-3 top-3 ▒▒▒                          ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╔═[PRIMARY BUTTON: variant="default" size="lg"]════════════════════╗   ║   ║
║ ║ ║ ███ Create Account & Continue to Sign ███ │ 400×48px             ║   ║   ║
║ ║ ║ bg-primary text-primary-foreground hover:bg-primary/90           ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ╚═════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║                         ░░░ OR ░░░                                            ║
║                   text-sm.text-muted-foreground                               ║
║                                                                               ║
║ ┏━[OAUTH BUTTONS: side by side layout]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║ ┃ ╔═[GOOGLE: variant="outline"]════╗ ╔═[MICROSOFT: variant="outline"]═╗ ┃   ║
║ ┃ ║ 🔗 Continue with Google      ║ ║ 🔗 Continue with Microsoft   ║ ┃   ║
║ ┃ ║ 195×44px                     ║ ║ 195×44px                     ║ ┃   ║
║ ┃ ║ border border-input          ║ ║ border border-input          ║ ┃   ║
║ ┃ ╚══════════════════════════════╝ ╚══════════════════════════════╝ ┃   ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                      Already have an account?                                ║
║ ╭─[LINK BUTTON: variant="link"]────────────────────────────────────────────╮   ║
║ │ Sign In │ text-primary underline-offset-4 hover:underline               │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░ INFO MESSAGE ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║ ℹ️  Your account will be created and you'll be directed                      ║
║     to sign the document immediately                                          ║
║     text-sm.text-muted-foreground.text-center                                ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🔵 Initial State (Empty Form)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║                          Create Your Account                                 ║
║                         h1.text-2xl.font-bold                               ║
║                                                                               ║
║ ╔═[FORM CONTAINER: Card with FormFields]═════════════════════════════════╗   ║
║ ║                                                                         ║   ║
║ ║ Email Address │ FormLabel                                               ║   ║
║ ║ ╔═[INPUT: type="email" pristine state]═════════════════════════════╗   ║   ║
║ ║ ║ Enter your email address │ 400×44px                              ║   ║   ║
║ ║ ║ border-input bg-background placeholder:text-muted-foreground     ║   ║   ║
║ ║ ║ ░░░ Empty state with placeholder text ░░░                        ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ Password │ FormLabel                                                    ║   ║
║ ║ ╔═[INPUT: type="password" with toggle]═════════════════════════════╗   ║   ║
║ ║ ║ Create a strong password │ 400×44px │ 👁 Toggle                  ║   ║   ║
║ ║ ║ border-input bg-background pr-10                                  ║   ║   ║
║ ║ ║ ▒▒▒ Eye icon for password visibility ▒▒▒                         ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ Confirm Password │ FormLabel                                            ║   ║
║ ║ ╔═[INPUT: type="password" confirmation]════════════════════════════╗   ║   ║
║ ║ ║ Confirm your password │ 400×44px                                  ║   ║   ║
║ ║ ║ border-input bg-background                                        ║   ║   ║
║ ║ ║ ░░░ Password confirmation field ░░░                               ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╔═[PRIMARY BUTTON: variant="default" size="lg" disabled]═══════════╗   ║   ║
║ ║ ║ ▒▒▒ Create Account ▒▒▒ │ 400×48px │ DISABLED                    ║   ║   ║
║ ║ ║ bg-muted text-muted-foreground cursor-not-allowed                ║   ║   ║
║ ║ ║ ░░░ Disabled until form validation passes ░░░                    ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ╚═════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║                         ░░░ OR ░░░                                            ║
║                   text-sm.text-muted-foreground                               ║
║                                                                               ║
║ ┏━[OAUTH BUTTONS: side by side layout]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║ ┃ ╔═[GOOGLE: variant="outline"]════╗ ╔═[MICROSOFT: variant="outline"]═╗ ┃   ║
║ ┃ ║ 🔗 Continue with Google      ║ ║ 🔗 Continue with Microsoft   ║ ┃   ║
║ ┃ ║ 195×44px                     ║ ║ 195×44px                     ║ ┃   ║
║ ┃ ║ border border-input          ║ ║ border border-input          ║ ┃   ║
║ ┃ ╚══════════════════════════════╝ ╚══════════════════════════════╝ ┃   ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                      Already have an account?                                ║
║ ╭─[LINK BUTTON: variant="link"]────────────────────────────────────────────╮   ║
║ │ Sign In │ text-primary underline-offset-4 hover:underline               │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Editing State (Real-time Validation)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║                          Create Your Account                                 ║
║                         h1.text-2xl.font-bold                               ║
║                                                                               ║
║ ╔═[FORM CONTAINER: Real-time validation active]══════════════════════════╗   ║
║ ║                                                                         ║   ║
║ ║ Email Address │ FormLabel                                               ║   ║
║ ║ ╔═[INPUT: type="email" valid state]════════════════════════════════╗   ║   ║
║ ║ ║ john.doe@company.com │ 400×44px │ ✅ VALID                       ║   ║   ║
║ ║ ║ border-green-500 bg-background text-foreground                    ║   ║   ║
║ ║ ║ ▓▓▓ Success state with green border ▓▓▓                           ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ Password │ FormLabel                                                    ║   ║
║ ║ ╔═[INPUT: type="password" strong validation]═══════════════════════╗   ║   ║
║ ║ ║ ••••••••••••••••••••• │ 400×44px │ 👁 Toggle                      ║   ║   ║
║ ║ ║ border-green-500 bg-background pr-10                              ║   ║   ║
║ ║ ║ ▒▒▒ Strong password indicators below ▒▒▒                          ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╭─[PASSWORD STRENGTH: Progress indicator]────────────────────────╮   ║   ║
║ ║ │ ████████████████████████░░ Strong │ text-green-600             │   ║   ║
║ ║ │ ✅ 8+ characters ✅ Uppercase ✅ Lowercase ✅ Numbers           │   ║   ║
║ ║ │ text-sm.text-green-600.space-x-4                               │   ║   ║
║ ║ ╰─────────────────────────────────────────────────────────────────╯   ║   ║
║ ║                                                                         ║   ║
║ ║ Confirm Password │ FormLabel                                            ║   ║
║ ║ ╔═[INPUT: type="password" match validation]════════════════════════╗   ║   ║
║ ║ ║ ••••••••••••••••••••• │ 400×44px │ ✅ MATCH                      ║   ║   ║
║ ║ ║ border-green-500 bg-background                                    ║   ║   ║
║ ║ ║ ▓▓▓ Passwords match confirmation ▓▓▓                              ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╭─[SUCCESS MESSAGE: FormMessage]─────────────────────────────────╮   ║   ║
║ ║ │ ✅ Passwords match │ text-sm.text-green-600                     │   ║   ║
║ ║ ╰─────────────────────────────────────────────────────────────────╯   ║   ║
║ ║                                                                         ║   ║
║ ║ ╔═[PRIMARY BUTTON: variant="default" size="lg" enabled]════════════╗   ║   ║
║ ║ ║ ███ Create Account ███ │ 400×48px │ ENABLED                     ║   ║   ║
║ ║ ║ bg-primary text-primary-foreground hover:bg-primary/90           ║   ║   ║
║ ║ ║ ▓▓▓ Ready for submission ▓▓▓                                     ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ╚═════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Validation Error State

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║                          Create Your Account                                 ║
║                         h1.text-2xl.font-bold                               ║
║                                                                               ║
║ ╔═[FORM CONTAINER: Multiple validation errors]═══════════════════════════╗   ║
║ ║                                                                         ║   ║
║ ║ Email Address │ FormLabel                                               ║   ║
║ ║ ╔═[INPUT: type="email" error state]════════════════════════════════╗   ║   ║
║ ║ ║ existing.user@company.com │ 400×44px │ ❌ ERROR                   ║   ║   ║
║ ║ ║ border-destructive bg-background text-foreground                   ║   ║   ║
║ ║ ║ ▒▒▒ Error state with red border ▒▒▒                               ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╭─[ERROR MESSAGE: FormMessage destructive]───────────────────────╮   ║   ║
║ ║ │ ❌ Account already exists with this email.                       │   ║   ║
║ ║ │ ╭─[LINK: Try signing in]───────────────────────────────────╮   │   ║   ║
║ ║ │ │ Try signing in │ text-primary underline hover:no-underline │   │   ║   ║
║ ║ │ ╰───────────────────────────────────────────────────────────╯   │   ║   ║
║ ║ │ text-sm.text-destructive                                         │   ║   ║
║ ║ ╰─────────────────────────────────────────────────────────────────╯   ║   ║
║ ║                                                                         ║   ║
║ ║ Password │ FormLabel                                                    ║   ║
║ ║ ╔═[INPUT: type="password" weak validation]═════════════════════════╗   ║   ║
║ ║ ║ password123 │ 400×44px │ ❌ WEAK                                  ║   ║   ║
║ ║ ║ border-destructive bg-background                                   ║   ║   ║
║ ║ ║ ▒▒▒ Visible weak password for demo ▒▒▒                            ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╭─[PASSWORD STRENGTH: Progress indicator weak]───────────────────╮   ║   ║
║ ║ │ ████░░░░░░░░░░░░░░░░░░░░ Weak │ text-destructive                 │   ║   ║
║ ║ │ ❌ This password is too common. Try something more unique.      │   ║   ║
║ ║ │ text-sm.text-destructive                                        │   ║   ║
║ ║ ╰─────────────────────────────────────────────────────────────────╯   ║   ║
║ ║                                                                         ║   ║
║ ║ Confirm Password │ FormLabel                                            ║   ║
║ ║ ╔═[INPUT: type="password" mismatch error]══════════════════════════╗   ║   ║
║ ║ ║ password124 │ 400×44px │ ❌ MISMATCH                             ║   ║   ║
║ ║ ║ border-destructive bg-background                                   ║   ║   ║
║ ║ ║ ▒▒▒ Different password entered ▒▒▒                                ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ║                                                                         ║   ║
║ ║ ╭─[ERROR MESSAGE: FormMessage destructive]───────────────────────╮   ║   ║
║ ║ │ ❌ Passwords don't match │ text-sm.text-destructive              │   ║   ║
║ ║ ╰─────────────────────────────────────────────────────────────────╯   ║   ║
║ ║                                                                         ║   ║
║ ║ ╔═[PRIMARY BUTTON: variant="default" size="lg" disabled]═══════════╗   ║   ║
║ ║ ║ ▒▒▒ Create Account ▒▒▒ │ 400×48px │ DISABLED                    ║   ║   ║
║ ║ ║ bg-muted text-muted-foreground cursor-not-allowed                ║   ║   ║
║ ║ ║ ░░░ Disabled due to validation errors ░░░                        ║   ║   ║
║ ║ ╚═══════════════════════════════════════════════════════════════════╝   ║   ║
║ ╚═════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Submitting State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          Create Your Account                                │
│                                                                             │
│    Email Address                                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ john.doe@company.com                         [DISABLED]             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Password                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                          [DISABLED]             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Confirm Password                                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ••••••••••••••••                          [DISABLED]             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                 ⏳ Creating account...                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                      ⏳ This may take a moment                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Server Error State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ❌ Account Creation Failed                                │
│                                                                             │
│              Something went wrong while creating your account.              │
│                        Please try again in a moment.                       │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Try Again                                    │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Contact Support>                                  │
│                           <Go Back>                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Sign Up Form

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│    Create Account       │
│                         │
│ Email Address           │
│ ┌─────────────────────┐ │
│ │ Enter email         │ │
│ └─────────────────────┘ │
│                         │
│ Password                │
│ ┌─────────────────────┐ │
│ │ Create password  👁 │ │
│ └─────────────────────┘ │
│ ██████░░░░ Strong       │
│                         │
│ Confirm Password        │
│ ┌─────────────────────┐ │
│ │ Confirm password    │ │
│ └─────────────────────┘ │
│ ✅ Match               │
│                         │
│ ┌─────────────────────┐ │
│ │   Create Account    │ │
│ └─────────────────────┘ │
│                         │
│        OR               │
│                         │
│ ┌─────────────────────┐ │
│ │ 🔗 Google          │ │
│ └─────────────────────┘ │
│                         │
│  <Sign In>              │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Form Field Behaviors
- **Email Field**: 
  - Real-time format validation
  - Server check for existing accounts on blur
  - Clear error recovery with sign-in suggestion

- **Password Field**: 
  - Real-time strength indicator
  - Show/hide toggle
  - Strength criteria checklist
  - Common password detection

- **Confirm Password**:
  - Real-time match validation
  - Only validate after user starts typing

### Form Submission
- **Button State**: Disabled until all fields valid
- **Loading State**: Form disabled, button shows spinner
- **Error Handling**: Clear error messages with recovery options

### OAuth Integration
- **Google/Microsoft**: Clerk provider integration
- **Loading States**: Show redirect progress
- **Error Recovery**: Fall back to email/password

---

## Accessibility Features

- **Screen Reader**: Form labels and error announcements
- **Keyboard Navigation**: Logical tab order through form
- **Focus Management**: Clear focus indicators
- **Error Handling**: ARIA live regions for validation messages
- **Password Visibility**: Screen reader compatible toggle

---

## Technical Integration

### Clerk Integration
- Real-time validation using Clerk patterns
- Password strength requirements from Clerk config
- OAuth provider configuration
- Session creation on successful signup

### Form State Management
- TanStack Form integration
- Zod schema validation
- Optimistic UI updates
- Error boundary handling