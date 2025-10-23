# OTP Verification Screen Wireframes - All States

## Screen States & Wireframes

### 🟡 Initial State (Code Sent)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         📧 Verify Your Email                                    ║
║                                                                                 ║
║                   We sent a 6-digit code to:                                   ║
║                      john.doe@company.com                                      ║
║                                                                                 ║
║              Enter the verification code to complete setup:                    ║
║                                                                                 ║
║ ╔═[OTP INPUT GRID]════════════════════════════════════════════════════════════╗ ║
║ ║ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮              ║ ║
║ ║ │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │              ║ ║
║ ║ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯              ║ ║
║ ║ 48×48px each │ border-input bg-background text-foreground             ║ ║
║ ║ ▓▓▓ 6-digit OTP input with auto-focus and advance ▓▓▓                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[COUNTDOWN TIMER]═══════════════════════════════════════════════════════════╗ ║
║ ║ Code expires in: 9:45                                                       ║ ║
║ ║ text-sm text-orange-600 font-mono                                           ║ ║
║ ║ ▒▒▒ Real-time countdown with color transitions ▒▒▒                         ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg" disabled]═══════════════════════════════╗ ║
║ ║ Verify Code                         │ 400×48px │ DISABLED                 ║ ║
║ ║ bg-muted text-muted-foreground cursor-not-allowed                          ║ ║
║ ║ ▒▒▒ Disabled until all 6 digits entered ▒▒▒                               ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINKS]═══════════════════════════════════════════════════════════╗ ║
║ ║ Didn't receive the code? <Resend Code>                                      ║ ║
║ ║ text-sm text-muted-foreground + link hover:underline                       ║ ║
║ ║ ▒▒▒ Code resend option with rate limiting ▒▒▒                               ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[ALTERNATE ACTION]════════════════════════════════════════════════════════╗ ║
║ ║ <Use Different Email>                                                       ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Email change option for incorrect addresses ▒▒▒                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Typing State (Partial Entry)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         📧 Verify Your Email                                    ║
║                                                                                 ║
║                   We sent a 6-digit code to:                                   ║
║                      john.doe@company.com                                      ║
║                                                                                 ║
║              Enter the verification code to complete setup:                    ║
║                                                                                 ║
║ ╔═[OTP INPUT GRID - PARTIAL ENTRY]═══════════════════════════════════════════╗ ║
║ ║ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮              ║ ║
║ ║ │  1  │ │  2  │ │  3  │ │  4  │ │ |   │ │     │              ║ ║
║ ║ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯              ║ ║
║ ║ 48×48px each │ border-input bg-background │ 5th field focused           ║ ║
║ ║ ▓▓▓ Active cursor in 5th field, auto-advancing input ▓▓▓                 ║ ║
║ ║                          ↑ Active Focus                                    ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[COUNTDOWN TIMER]═══════════════════════════════════════════════════════════╗ ║
║ ║ Code expires in: 9:15                                                       ║ ║
║ ║ text-sm text-orange-600 font-mono                                           ║ ║
║ ║ ▒▒▒ Active countdown while user enters code ▒▒▒                           ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═══════════════════════════════════════╗ ║
║ ║ Verify Code                         │ 400×48px │ Auto-trigger ready       ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Will activate automatically when 6th digit entered ▓▓▓                 ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINKS]═══════════════════════════════════════════════════════════╗ ║
║ ║ Didn't receive the code? <Resend Code>                                      ║ ║
║ ║ text-sm text-muted-foreground + link hover:underline                       ║ ║
║ ║ ▒▒▒ Alternative recovery option during input ▒▒▒                           ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Complete Entry (Auto-Verify)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         📧 Verify Your Email                                    ║
║                                                                                 ║
║                   We sent a 6-digit code to:                                   ║
║                      john.doe@company.com                                      ║
║                                                                                 ║
║              Enter the verification code to complete setup:                    ║
║                                                                                 ║
║ ╔═[OTP INPUT GRID - COMPLETE]═══════════════════════════════════════════════════╗ ║
║ ║ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮              ║ ║
║ ║ │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │              ║ ║
║ ║ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯              ║ ║
║ ║ 48×48px each │ border-primary bg-primary/10 text-foreground            ║ ║
║ ║ ▓▓▓ All fields filled, auto-verification triggered ▓▓▓                    ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[VERIFICATION STATUS]═════════════════════════════════════════════════════════╗ ║
║ ║ ⏳ Verifying code...                                                         ║ ║
║ ║ text-sm text-primary font-medium                                            ║ ║
║ ║ ▓▓▓ Auto-verification in progress indicator ▓▓▓                             ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg" disabled]═══════════════════════════════╗ ║
║ ║ ⏳ Verifying Code...                │ 400×48px │ Processing state          ║ ║
║ ║ bg-muted text-muted-foreground cursor-wait                                  ║ ║
║ ║ ▒▒▒ Disabled during verification process ▒▒▒                               ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[LOADING INDICATOR]═══════════════════════════════════════════════════════════╗ ║
║ ║ [████████░░] Verifying with server...                                     ║ ║
║ ║ animate-pulse bg-primary/20 h-2 rounded-full                               ║ ║
║ ║ ▒▒▒ Visual progress indicator during verification ▒▒▒                      ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Invalid Code State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         📧 Verify Your Email                                    ║
║                                                                                 ║
║                   We sent a 6-digit code to:                                   ║
║                      john.doe@company.com                                      ║
║                                                                                 ║
║              Enter the verification code to complete setup:                    ║
║                                                                                 ║
║ ╔═[OTP INPUT GRID - ERROR STATE]════════════════════════════════════════════════════╗ ║
║ ║ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮              ║ ║
║ ║ │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  7  │  ❌          ║ ║
║ ║ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯              ║ ║
║ ║ 48×48px each │ border-destructive bg-background text-foreground        ║ ║
║ ║ ▓▓▓ Error state with red borders and validation indicator ▓▓▓             ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[ERROR MESSAGE]═══════════════════════════════════════════════════════════╗ ║
║ ║ ❌ Invalid code. Check your email and try again.                        ║ ║
║ ║ text-sm text-destructive                                                   ║ ║
║ ║ ▓▓▓ Clear error message with guidance for recovery ▓▓▓                   ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║ ╔═[ATTEMPT COUNTER]══════════════════════════════════════════════════════════╗ ║
║ ║ Attempts remaining: 4/5                                                    ║ ║
║ ║ text-sm text-orange-600                                                    ║ ║
║ ║ ▒▒▒ Progressive warning of remaining attempts ▒▒▒                         ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[COUNTDOWN TIMER]═══════════════════════════════════════════════════════════╗ ║
║ ║ Code expires in: 8:32                                                       ║ ║
║ ║ text-sm text-red-600 font-mono                                              ║ ║
║ ║ ▒▒▒ Urgent countdown with red coloring for low time ▒▒▒                  ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═════════════════════════════════════╗ ║
║ ║ Try Again                           │ 400×48px │ Retry action             ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Clear retry action for invalid code entry ▓▓▓                          ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINK]═══════════════════════════════════════════════════════════╗ ║
║ ║ Didn't receive the code? <Resend Code>                                      ║ ║
║ ║ text-sm text-muted-foreground + link hover:underline                       ║ ║
║ ║ ▒▒▒ Alternative recovery option ▒▒▒                                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Code Expired State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         ⏰ Verification Code Expired                            ║
║                                                                                 ║
║                   Your verification code has expired.                          ║
║                  We'll send you a fresh code to continue.                      ║
║                                                                                 ║
║                       Sending to:                                              ║
║                      john.doe@company.com                                      ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═════════════════════════════════════╗ ║
║ ║ Send New Code                       │ 400×48px │ Primary action             ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Request fresh verification code ▓▓▓                                     ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINKS]═══════════════════════════════════════════════════════════╗ ║
║ ║ <Use Different Email>                                                       ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Email change option for recovery ▒▒▒                                   ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║ ╔═[ALTERNATE ACTION]════════════════════════════════════════════════════════╗ ║
║ ║ <Back to Sign Up>                                                           ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Return to registration flow ▒▒▒                                        ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Too Many Attempts State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         🛑 Too Many Failed Attempts                             ║
║                                                                                 ║
║              You've exceeded the maximum number of attempts                     ║
║                       for this verification code.                              ║
║                                                                                 ║
║                We'll need to send you a fresh code to                          ║
║                            continue safely.                                    ║
║                                                                                 ║
║ ╔═[SECURITY MESSAGE]══════════════════════════════════════════════════════════╗ ║
║ ║ 🔒 Account protection: Maximum attempts exceeded                            ║ ║
║ ║ text-sm text-orange-600 bg-orange-50 border border-orange-200              ║ ║
║ ║ ▓▓▓ Security context for lockout state ▓▓▓                                 ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═════════════════════════════════════╗ ║
║ ║ Request New Code                     │ 400×48px │ Recovery action            ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Fresh code request after lockout ▓▓▓                                   ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[NAVIGATION LINKS]═══════════════════════════════════════════════════════════╗ ║
║ ║ <Use Different Email>                                                       ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Email change option ▒▒▒                                                ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║ ╔═[SUPPORT LINK]═══════════════════════════════════════════════════════════════╗ ║
║ ║ <Contact Support>                                                           ║ ║
║ ║ text-sm text-muted-foreground hover:text-foreground                        ║ ║
║ ║ ▒▒▒ Support escalation for persistent issues ▒▒▒                           ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Resending Code State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                         📧 Sending New Code                                     ║
║                                                                                 ║
║                      ⏳ Sending verification code to:                           ║
║                        john.doe@company.com                                    ║
║                                                                                 ║
║                      This should take just a moment...                         ║
║                                                                                 ║
║ ╔═[PROGRESS BAR]══════════════════════════════════════════════════════════════╗ ║
║ ║ [████████░░] 80% - Sending email...                                  ║ ║
║ ║ w-full h-2 bg-secondary rounded-full overflow-hidden                       ║ ║
║ ║ ▓▓▓ Animated progress indicator during send ▓▓▓                          ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[STATUS MESSAGE]═══════════════════════════════════════════════════════════╗ ║
║ ║ ⏳ Preparing your new verification code...                                  ║ ║
║ ║ text-sm text-primary animate-pulse                                          ║ ║
║ ║ ▒▒▒ Processing status during code generation ▒▒▒                           ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[LOADING ANIMATION]══════════════════════════════════════════════════════════╗ ║
║ ║ ●○○ Contacting email service...                                              ║ ║
║ ║ animate-spin text-primary                                                   ║ ║
║ ║ ▒▒▒ Visual feedback for ongoing process ▒▒▒                               ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟢 Verification Success State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            [LOGO] Seal Alternative                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║                       ✅ Email Verified Successfully!                           ║
║                                                                                 ║
║                     Your email has been confirmed.                             ║
║                      Welcome to Seal!                                          ║
║                                                                                 ║
║ ╔═[SUCCESS CONFIRMATION]═════════════════════════════════════════════════════════╗ ║
║ ║                           john.doe@company.com                             ║ ║
║ ║                               ✅ Verified                                   ║ ║
║ ║ text-center bg-success/10 border border-success/20 rounded-lg p-4          ║ ║
║ ║ ▓▓▓ Success state with verified email display ▓▓▓                           ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[BUTTON: variant="default" size="lg"]═════════════════════════════════════╗ ║
║ ║ Continue to Workspace Setup          │ 400×48px │ Next step action          ║ ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                     ║ ║
║ ║ ▓▓▓ Proceed to next onboarding phase ▓▓▓                                   ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
║ ╔═[CELEBRATION MESSAGE]════════════════════════════════════════════════════════╗ ║
║ ║ 🎉 Let's get you started!                                                 ║ ║
║ ║ text-lg font-medium text-primary                                            ║ ║
║ ║ ▒▒▒ Encouraging message to continue onboarding ▒▒▒                          ║ ║
║ ╚═════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Responsive States

### 📱 Mobile OTP Verification

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃    [LOGO] Seal          ┃
┃      Alternative        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                         ┃
┃   📧 Verify Email       ┃
┃                         ┃
┃  We sent a code to:     ┃
┃ john.doe@company.com    ┃
┃                         ┃
┃ Enter 6-digit code:     ┃
┃                         ┃
┃ ╭───╮╭───╮╭───╮         ┃
┃ │ 1 ││ 2 ││ 3 │         ┃
┃ ╰───╯╰───╯╰───╯         ┃
┃ ╭───╮╭───╮╭───╮         ┃
┃ │ 4 ││ 5 ││ 6 │         ┃
┃ ╰───╯╰───╯╰───╯         ┃
┃ 32×32px inputs          ┃
┃                         ┃
┃ Expires: 9:45           ┃
┃ ▓▓▓ timer countdown     ┃
┃                         ┃
┃ ┏━[VERIFY BUTTON]━━━━┓ ┃
┃ ┃   Verify Code       ┃ ┃
┃ ┗━━━━━━━━━━━━━━━━━━━━━┛ ┃
┃ w-full variant=default  ┃
┃                         ┃
┃ ┏━[NAVIGATION]━━━━━━┓ ┃
┃ ┃ <Resend Code>       ┃ ┃
┃ ┃ <Different Email>   ┃ ┃
┃ ┗━━━━━━━━━━━━━━━━━━━━━┛ ┃
┃ ▒▒▒ mobile link styles  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Interaction Specifications

### Code Input Behavior
- **Auto-Focus**: Automatically focus first input on load
- **Auto-Advance**: Move to next field after digit entry
- **Auto-Submit**: Verify code when all 6 digits entered
- **Backspace Handling**: Clear current field, move to previous
- **Paste Support**: Accept 6-digit paste across all fields

### Countdown Timer
- **Real-time Updates**: Update every second
- **Visual Feedback**: Change color as expiration approaches
- **Auto-Expire**: Redirect to expired state at 00:00
- **Grace Period**: Allow 30-second buffer for network delays

### Rate Limiting
- **Attempt Tracking**: Count invalid attempts (max 5)
- **Progressive Warnings**: Show remaining attempts
- **Lockout Handling**: Force new code after max attempts
- **Resend Limiting**: Limit resend requests to prevent abuse

---

## Technical Integration

### OTP Generation & Validation
- **Code Format**: 6-digit numeric code
- **Expiration**: 10 minutes from generation
- **Security**: Cryptographically secure random generation
- **Single Use**: Invalidate code after successful verification

### Email Integration
- **React Email**: Styled email templates
- **Resend Service**: Reliable email delivery
- **Template Variables**: Dynamic code and user info
- **Delivery Tracking**: Monitor delivery status

### State Management
- **Verification Status**: Track verification state
- **Error Handling**: Clear error recovery flows
- **Session Management**: Maintain auth state during verification
- **Progress Tracking**: Guide user through process

---

## Accessibility Features

- **Screen Reader**: Announce code fields and timer
- **Keyboard Navigation**: Support arrow keys between fields
- **Focus Management**: Clear visual focus indicators
- **Error Announcements**: ARIA live regions for validation
- **High Contrast**: Clear distinction between states
- **Large Touch Targets**: 44px minimum for mobile inputs

---

## Security Considerations

### Code Security
- **Entropy**: High-entropy random generation
- **Validation**: Server-side verification only
- **Rate Limiting**: Prevent brute force attempts
- **Invalidation**: Clear codes after use or expiration

### Email Security
- **No Code Display**: Never show code in email subject
- **Link Alternative**: Consider magic link as backup
- **Spam Prevention**: Monitor delivery rates
- **Privacy**: Minimal personal info in templates