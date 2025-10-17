# Account Settings Wireframes - All States

## Screen States & Wireframes

### ⚙️ Account Settings

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          Account Settings                                     ║ [text-3xl font-bold text-center]
║                                                                               ║
║    Data & Privacy                                                            ║ [text-xl font-semibold mb-4]
║    ╭─[DATA PRIVACY CARD: variant="elevated"]──────────────────────────────╮  ║
║    │ Export Your Data                                                      │  ║ [Card: p-6 space-y-4 bg-blue-50]
║    │ Request a copy of all your data including documents,                  │  ║ [text-lg font-medium mb-2]
║    │ signatures, and activity history.                                     │  ║ [text-sm text-muted-foreground mb-4]
║    │                                                                       │  ║ [leading-relaxed]
║    │ ┏━━━━━━━━━━━━━━ Request Data Export ━━━━━━━━━━━━━━┓                      │  ║ [Button: variant="outline", w-full, py-3]
║    │                                                                       │  ║
║    ╰───────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Account Management                                                        ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[ACCOUNT MANAGEMENT CARD: variant="elevated"]──────────────────────╮    ║
║    │ Delete Account                                                        │  ║ [Card: p-6 space-y-4 bg-red-50]
║    │ Permanently delete your account and all associated data.              │  ║ [text-lg font-medium mb-2]
║    │                                                                       │  ║ [text-sm text-muted-foreground mb-4]
║    │ ╭─[WARNING ALERT: variant="destructive"]───────────────────────────╮  │  ║ [leading-relaxed]
║    │ │ ⚠️  This action cannot be undone                                  │  │  ║ [Alert: bg-red-100 border-red-200 p-3]
║    │ ╰─────────────────────────────────────────────────────────────────────╯  │  ║ [text-red-800 text-sm font-medium]
║    │                                                                       │  ║
║    │ ┏━━━━━━━━━━━━━━ 🗑️ Delete My Account ━━━━━━━━━━━━━━┓                   │  ║ [Button: variant="destructive", w-full, py-3]
║    │                                                                       │  ║
║    ╰───────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 📥 Data Export Request

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          Data Export Request                                  ║ [text-3xl font-bold text-center]
║                                                                               ║
║    Export Your Data                                                          ║ [text-xl font-semibold mb-4]
║    ╭─[EXPORT DATA CARD: variant="elevated"]─────────────────────────╮     ║
║    │ We'll prepare a download with all your data:                        │     ║ [Card: p-6 space-y-4 bg-green-50]
║    │                                                                       │     ║ [text-sm text-muted-foreground mb-4]
║    │ ✅ Profile information                                                │     ║ [flex items-center gap-2 text-sm]
║    │ ✅ Document metadata and signatures                                   │     ║ [flex items-center gap-2 text-sm]
║    │ ✅ Activity history                                                   │     ║ [flex items-center gap-2 text-sm]
║    │ ✅ Workspace data                                                     │     ║ [flex items-center gap-2 text-sm]
║    │                                                                       │     ║
║    │ ╭─[INFO SECTION]────────────────────────────────────────╮ │     ║ [text-xs text-muted-foreground space-y-1]
║    │ │ Format: ZIP file with JSON data                                  │ │     ║
║    │ │ Delivery: Download link sent to your email                       │ │     ║
║    │ │ Processing time: Usually within 24 hours                         │ │     ║
║    │ ╰──────────────────────────────────────────────────────────────╯ │     ║
║    │                                                                       │     ║
║    │ ┏━━━━━━━━━ Confirm Export Request ━━━━━━━━━┓             │     ║ [Button: variant="default", w-full, py-3]
║    │                                                                       │     ║
║    ╰─────────────────────────────────────────────────────────────────────╯     ║
║                                                                               ║
║    Previous Exports                                                          ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[PREVIOUS EXPORTS CARD: variant="elevated"]──────────────────────╮    ║
║    │ ╭─[EXPORT 1]────────────────────────────────╮ ┏━ Download ZIP ━┓ │    ║ [Card: p-4 bg-gray-50]
║    │ │ January 15, 2024     Ready for download ✅      │ ┃   [Download]   ┃ │    ║ [flex justify-between items-center]
║    │ ╰────────────────────────────────────────╯ ┗━━━━━━━━━━━━━┛ │    ║ [text-sm, Button: size="sm"]
║    │ ╭─[EXPORT 2]────────────────────────────────╮          │    ║
║    │ │ December 8, 2023     Expired                   -                 │          │    ║ [text-sm text-muted-foreground]
║    │ ╰────────────────────────────────────────╯          │    ║
║    ╰─────────────────────────────────────────────────────────────────────╯    ║
║                                                                               ║
║    ┏━━━━━━━━━━━ < Back to Settings ━━━━━━━━━━━┓                      ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🗑️ Delete Account Confirmation

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                      🗑️ Delete Account                                      ║ [text-3xl font-bold text-center text-red-600]
║                                                                               ║
║    ╭─[WARNING CARD: variant="destructive"]──────────────────────────────────╮ ║
║    │ ⚠️  Are you sure you want to delete your account?                      │ ║ [Card: p-6 bg-red-50 border-red-200]
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-center text-red-800 font-medium]
║                                                                               ║
║    ╭─[DELETION IMPACT CARD: variant="elevated"]──────────────────────────────╮ ║
║    │ This will permanently delete:                                           │ ║ [Card: p-6 space-y-3 bg-gray-50]
║    │ • Your profile and all settings                                        │ ║ [text-base font-medium mb-3]
║    │ • 47 documents you've created                                          │ ║ [ul: space-y-2 text-sm text-red-700]
║    │ • 156 signatures you've completed                                      │ ║ [li: flex items-center gap-2]
║    │ • Your membership in 2 workspaces                                      │ ║
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║
║                                                                               ║
║    ╭─[FINAL WARNING ALERT: variant="destructive"]─────────────────────────╮   ║
║    │ ⚠️  This action cannot be undone                                       │   ║ [Alert: bg-red-100 border-red-300 p-4]
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║ [text-red-800 font-semibold text-center]
║                                                                               ║
║    ╭─[CONFIRMATION FORM: space-y-4]─────────────────────────────────────────╮ ║
║    │                                                                         │ ║ [Card: p-6 bg-white border-2 border-red-200]
║    │    Type "DELETE" to confirm:                                           │ ║ [Label: text-sm font-medium]
║    │    ╭─[TEXT INPUT: placeholder="DELETE"]─────────────────────────────╮  │ ║ [Input: w-full p-3 border-red-300 focus:border-red-500]
║    │    │                                                                 │  │ ║ [bg-red-50]
║    │    ╰─────────────────────────────────────────────────────────────────╯  │ ║
║    │                                                                         │ ║
║    │    Enter your password:                                                │ ║ [Label: text-sm font-medium mt-4]
║    │    ╭─[PASSWORD INPUT]──────────────────────────────────────────────╮   │ ║ [Input: type="password", w-full p-3]
║    │    │ ••••••••••••••••                                               │   │ ║ [border-red-300 focus:border-red-500]
║    │    ╰────────────────────────────────────────────────────────────────╯   │ ║
║    │                                                                         │ ║
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━ 🗑️ Yes, Delete My Account ━━━━━━━━━━━━━━┓                   ║ [Button: variant="destructive", w-full, py-4, disabled]
║                                                                               ║ [text-lg font-semibold]
║                          ┏━━━ Cancel ━━━┓                                     ║ [Button: variant="ghost", mx-auto]
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 📱 Mobile - Account Settings

```
╔═════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓   ║ [Logo: h-8 mobile variant]
║                         ║
╠═════════════════════════╣
║                         ║
║    Account Settings     ║ [text-lg font-semibold text-center]
║                         ║
║ Data & Privacy          ║ [text-sm font-semibold mb-2]
║ ╭─[DATA CARD]────────╮  ║ [Card: variant="outline" p-3 bg-blue-50]
║ │ Export Your Data    │  ║ [text-sm font-medium mb-1]
║ │ Get a copy of all   │  ║ [text-xs text-muted-foreground]
║ │ your information    │  ║ [leading-tight mb-3]
║ │                     │  ║
║ │ ┏━ Request Export ━┓ │  ║ [Button: variant="outline" size="sm" w-full]
║ ╰─────────────────────╯  ║
║                         ║
║ Account Management      ║ [text-sm font-semibold mb-2 mt-4]
║ ╭─[DELETE CARD]──────╮   ║ [Card: variant="outline" p-3 bg-red-50]
║ │ Delete Account      │   ║ [text-sm font-medium mb-1]
║ │ Permanently delete  │   ║ [text-xs text-muted-foreground]
║ │ all data            │   ║ [leading-tight mb-2]
║ │                     │   ║
║ │ ⚠️ Cannot be undone  │   ║ [text-xs text-red-600 font-medium mb-3]
║ │                     │   ║
║ │ ┏━🗑️ Delete Account━┓ │   ║ [Button: variant="destructive" size="sm" w-full]
║ ╰─────────────────────╯   ║
║                         ║
╚═════════════════════════╝
```

---

## Interactive Elements

### Data Export
- **Export Request**: Simple one-click export request
- **Download Links**: Secure, time-limited download URLs  
- **Email Notifications**: Status updates via email

### Account Deletion
- **Two-step Confirmation**: Text confirmation + password
- **Impact Summary**: Show what will be deleted
- **Irreversible Warning**: Clear messaging about permanence

---

## State Management

### Export Processing
- **Email Delivery**: Download link sent to user email
- **Expiration**: Downloads expire after 30 days
- **Status Tracking**: Show processing status

### Deletion Process
- **Immediate**: Account deleted immediately on confirmation
- **Cleanup**: All data removed from system
- **Workspace Impact**: User removed from all workspaces

---

## Security Features

### Sensitive Operations
- **Password Required**: Account deletion requires password
- **Confirmation Text**: Must type "DELETE" to confirm
- **Audit Logging**: Log account deletion events

---

## Accessibility Features

- **Clear Warnings**: High contrast warning messages
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: All actions properly announced
- **Focus Management**: Logical tab order through forms