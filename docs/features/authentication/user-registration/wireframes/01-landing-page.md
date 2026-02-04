# Landing Page Wireframes - Authentication Entry Point

## Screen States & Wireframes

### 🟢 Default State (Unauthenticated Users)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║                   Sign Documents Electronically, Fast & Secure                ║
║                             h1.text-4xl.font-bold                            ║
║                                                                               ║
║ ╔═[PRIMARY BUTTON: variant="default" size="lg"]═══════════════════════════╗   ║
║ ║ ███ Get Started ███ │ 400×48px │ Primary CTA                            ║   ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                 ║   ║
║ ║ ▓▓▓ Shadow: 0 4px 8px rgba(0,0,0,0.12) ▓▓▓                            ║   ║
║ ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║                         ░░░ OR ░░░                                            ║
║                   text-sm.text-muted-foreground                               ║
║                                                                               ║
║ ┏━[OAUTH BUTTON: variant="outline" size="lg"]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║ ┃ 🔗 Continue with Google │ 195×48px │ OAuth Provider                      ┃   ║
║ ┃ border border-input bg-background hover:bg-accent                       ┃   ║
║ ┃ ▒▒▒ Icon: Google logo 20×20px with mr-2 spacing ▒▒▒                    ┃   ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║ ┏━[OAUTH BUTTON: variant="outline" size="lg"]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║ ┃ 🔗 Continue with Microsoft │ 195×48px │ OAuth Provider                  ┃   ║
║ ┃ border border-input bg-background hover:bg-accent                       ┃   ║
║ ┃ ▒▒▒ Icon: Microsoft logo 20×20px with mr-2 spacing ▒▒▒                 ┃   ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                      Already have an account?                                ║
║ ╭─[LINK BUTTON: variant="link"]────────────────────────────────────────────╮   ║
║ │ Sign In │ text-primary underline-offset-4 hover:underline               │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░ FEATURE HIGHLIGHTS ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║   ✓ Document Signing Made Simple │ text-muted-foreground                     ║
║   ✓ Bank-Grade Security & Compliance                                          ║
║   ✓ Secure Account-Based Signing                                              ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Loading State (OAuth Redirect)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║ ╭─[LOADING SPINNER: Loader2 with animation]───────────────────────────────╮   ║
║ │ ⟳ Loading... │ animate-spin h-8 w-8 mx-auto                             │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║                         Redirecting to Google...                             ║
║                     text-lg.text-muted-foreground                            ║
║                                                                               ║
║ ╔═[PROGRESS BAR: shadcn Progress component]═══════════════════════════════╗   ║
║ ║ ████████████████████████░░░░░░░░░░░░ 40% Complete                      ║   ║
║ ║ w-full max-w-md h-2 │ value={40} max={100}                            ║   ║
║ ║ ▒▒▒ Animated progress with transition-all duration-300 ▒▒▒              ║   ║
║ ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║ ┌─[GHOST BUTTON: variant="ghost"]─────────────────────────────────────────┐   ║
║ │ Cancel │ 100×36px │ hover:bg-accent hover:text-accent-foreground        │   ║
║ └───────────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 OAuth Error State

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║ ╭─[ERROR ICON: AlertCircle with destructive color]───────────────────────╮   ║
║ │ ❌ Sign In Failed │ text-destructive h-12 w-12 mx-auto                  │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║                       h2.text-2xl.font-semibold.text-destructive             ║
║                                                                               ║
║ ░░░░░░░░░░░░░░░░░░░░░░░ ERROR MESSAGE ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║   The sign-in process was interrupted.                                       ║
║   Please try again or use email/password instead.                           ║
║   text-muted-foreground.text-center                                          ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║                                                                               ║
║ ╔═[PRIMARY BUTTON: variant="default" size="lg"]═══════════════════════════╗   ║
║ ║ ███ Try Again ███ │ 200×44px │ Retry OAuth                             ║   ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                 ║   ║
║ ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║ ╭─[LINK BUTTON: variant="link"]────────────────────────────────────────────╮   ║
║ │ Use Email/Password Instead │ text-primary underline-offset-4            │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 🔵 Returning User State (Post-Success)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                            🏠 [LOGO] Seal                                        ║
║                         Brand Identity Header                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                                                               ║
║ ╭─[SUCCESS ICON: CheckCircle with success color]─────────────────────────╮   ║
║ │ ✅ Welcome back, John Smith! │ text-green-600 h-8 w-8 mx-auto           │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║                       h2.text-2xl.font-semibold                              ║
║                                                                               ║
║                           Last seen: 2 hours ago                             ║
║                         text-sm.text-muted-foreground                        ║
║                                                                               ║
║ ╔═[PRIMARY BUTTON: variant="default" size="lg"]═══════════════════════════╗   ║
║ ║ ███ Continue to Dashboard ███ │ 300×44px                               ║   ║
║ ║ bg-primary text-primary-foreground hover:bg-primary/90                 ║   ║
║ ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║ ╭─[LINK BUTTON: variant="link"]────────────────────────────────────────────╮   ║
║ │ Switch to Different Account │ text-primary underline-offset-4           │   ║
║ ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║ ░░░░░░░░░░░░░░░░░░░░░░░ RECENT ACTIVITY ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║              Recent Activity: 3 documents awaiting signature                 ║
║                        text-sm.text-muted-foreground                         ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Responsive States

### 📱 Mobile Default State

```
╔═════════════════════════════════════════╗
║           🏠 [LOGO] Seal                ║
║         Brand Identity                  ║
╠═════════════════════════════════════════╣
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║                                         ║
║          Sign Documents                 ║
║         Electronically                  ║
║      text-2xl.font-bold                 ║
║                                         ║
║ ╔═[PRIMARY: size="lg"]════════════════╗ ║
║ ║ ███ Get Started ███                ║ ║
║ ║ w-full bg-primary                  ║ ║
║ ╚════════════════════════════════════╝ ║
║                                         ║
║              OR                         ║
║        text-muted-foreground            ║
║                                         ║
║ ┏━[OAUTH: variant="outline"]━━━━━━━━━━┓ ║
║ ┃ 🔗 Google │ w-full               ┃ ║
║ ┃ border border-input              ┃ ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║                                         ║
║ ┏━[OAUTH: variant="outline"]━━━━━━━━━━┓ ║
║ ┃ 🔗 Microsoft │ w-full            ┃ ║
║ ┃ border border-input              ┃ ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║                                         ║
║ ╭─[LINK: variant="link"]─────────────╮ ║
║ │ Sign In │ text-primary            │ ║
║ ╰─────────────────────────────────────╯ ║
║                                         ║
║ ░░░░░░░░ FEATURES ░░░░░░░░              ║
║ ✓ Simple Document Signing              ║
║ ✓ Bank-Grade Security                  ║
║ ✓ Secure Account-Based Signing         ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║                                         ║
╚═════════════════════════════════════════╝
```

---

## Interaction Specifications

### Call-to-Action Buttons

- **Primary Button**: "Sign Up"
  - Target: `/signup`
  - Color: High contrast (follows design system)
  - Size: Minimum 44px touch target
  - State: Hover effect on desktop

### OAuth Buttons

- **Google OAuth**: "Continue with Google"
  - Target: Clerk Google provider
  - Icon: Google logo
  - Branded colors per Google guidelines
- **Microsoft OAuth**: "Continue with Microsoft"
  - Target: Clerk Microsoft provider
  - Icon: Microsoft logo
  - Branded colors per Microsoft guidelines

### Secondary Actions

- **Sign In Link**: Text link to `/signin`
- **Learn More**: Scroll to feature highlights
- **Pricing**: Link to pricing information

---

## Navigation Flow

```
Landing Page Entry Points:
├─ Direct URL visit → Default State
├─ OAuth redirect return → Loading State → Success/Error
├─ Sign out redirect → Default State
├─ Session expired → Default State
└─ New user referral → Default State with attribution
```

---

## Accessibility Notes

- **Screen Reader**: Clear heading hierarchy (H1 for main title)
- **Keyboard Navigation**: Tab order: Logo → Primary CTA → OAuth buttons → Sign In link
- **Color Contrast**: All text meets WCAG 2.1 AA standards
- **Focus Indicators**: Visible focus rings on all interactive elements
- **Alt Text**: Meaningful descriptions for all images and icons

---

## Performance Considerations

- **Critical CSS**: Above-fold content loads immediately
- **Image Optimization**: Logo and icons optimized for fast loading
- **JavaScript**: Minimal JS for landing page functionality
- **Prefetching**: Preload signup and signin pages on user hover
