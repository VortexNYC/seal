# Notification Preferences Wireframes - Simplified

## Screen States & Wireframes

### 🟢 Default Notification Settings State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                    Notification Preferences                                   ║ [text-2xl font-semibold text-center]
║                                                                               ║
║    Email Notifications                                                        ║ [text-lg font-semibold mb-4]
║    ╭─[NOTIFICATION CARD: variant="elevated"]─────────────────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4]
║    │    Receive email notifications                                        │   ║ [Label: text-sm font-medium]
║    │    ●●● Enabled    ○○○ Disabled                                      │   ║ [RadioGroup: className="flex gap-4"]
║    │                                                                       │   ║ [RadioGroupItem: size="default"]
║    │    📧 Get notified about document updates, invitations,              │   ║ [text-sm text-muted-foreground]
║    │       and important account activities via email                     │   ║ [leading-relaxed mt-2]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    Email Frequency                                                            ║ [text-lg font-semibold mb-4 mt-6]
║    ╭─[FREQUENCY CARD: variant="elevated"]───────────────────────────────╮     ║
║    │                                                                       │   ║ [Card: p-6 space-y-4]
║    │    Email delivery frequency                                           │   ║ [Label: text-sm font-medium]
║    │    ●●● Immediate    ○○○ Daily digest                                │   ║ [RadioGroup: className="flex gap-6"]
║    │                                                                       │   ║ [RadioGroupItem: size="default"]
║    │    ⚡ Choose immediate emails or daily summary                        │   ║ [text-sm text-muted-foreground]
║    │       for document updates and activities                             │   ║ [leading-relaxed mt-2]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━ Send Test Email ━━━━━━━━━━━━━━━━━━━━┓                  ║ [Button: variant="outline", w-full, py-3]
║                                                                               ║
║                    ✅ Preferences are saved automatically                     ║ [text-sm text-green-600 font-medium text-center]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟢 Test Email Sent State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                    📧 Test Email Sent!                                      ║ [text-2xl font-semibold text-center text-green-600]
║                                                                               ║
║    ╭─[SUCCESS MESSAGE CARD: variant="elevated"]────────────────────────────╮        ║
║    │                                                                       │        ║ [Card: p-8 bg-green-50 border-green-200]
║    │               We've sent a test notification to:                     │        ║ [text-center text-sm text-muted-foreground]
║    │                        john.doe@company.com                            │        ║ [text-center font-mono text-sm bg-gray-100 px-3 py-1 rounded]
║    │                                                                       │        ║
║    │                   Check your inbox to confirm delivery               │        ║ [text-center text-sm text-green-700 font-medium]
║    │                                                                       │        ║
║    ╰───────────────────────────────────────────────────────────────────────╯        ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━ Back to Notifications ━━━━━━━━━━━━━━━━┓                ║ [Button: variant="default", w-full, py-3]
║                                                                               ║
║                 Didn't receive it? Check your spam folder                    ║ [text-sm text-muted-foreground text-center mt-4]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Save Error State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                    Notification Preferences                                   ║ [text-2xl font-semibold text-center]
║                                                                               ║
║    ╭─[ERROR ALERT: variant="destructive"]──────────────────────────────────╮       ║
║    │   ❌ Failed to save preferences. Please try again.              │       ║ [Alert: bg-red-50 border-red-200 p-4]
║    ╰────────────────────────────────────────────────────────────────╯       ║ [text-sm text-red-700]
║                                                                               ║
║    Email Notifications                                                        ║ [text-lg font-semibold mb-4]
║    ╭─[EMAIL CARD: variant="elevated", className="border-red-200"]────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 border-error]
║    │    Receive email notifications                                        │   ║ [Label: text-sm font-medium]
║    │    ●●● Enabled    ○○○ Disabled                                      │   ║ [RadioGroup: className="flex gap-4"]
║    │                                                                       │   ║ [RadioGroupItem: size="default", disabled]
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    In-App Notifications                                                       ║ [text-lg font-semibold mb-4 mt-6]
║    ╭─[IN-APP CARD: variant="elevated", className="border-red-200"]────────────╮       ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 border-error]
║    │    Show in-app notifications                                         │   ║ [Label: text-sm font-medium]
║    │    ●●● Enabled    ○○○ Disabled                                      │   ║ [RadioGroup: className="flex gap-4"]
║    │                                                                       │   ║ [RadioGroupItem: size="default", disabled]
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━ Try Again ━━━━━━━━━━━━━━━━━━━━━━┓                     ║ [Button: variant="destructive", w-full, py-3]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Responsive States

### 📱 Mobile Notification Settings

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
║                           ║
╠═══════════════════════════╣
║                           ║
║  Notification Settings    ║ [text-lg font-semibold text-center]
║                           ║
║ Email Notifications       ║ [text-sm font-semibold mb-2]
║  ╭─[EMAIL CARD]────╮  ║ [Card: variant="outline", p-3]
║  │ Receive emails    │  ║ [text-xs label]
║  │     ●●● ○○○     │  ║ [RadioGroup: size="sm", flex gap-3]
║  │                   │  ║
║  │ 📧 Document updates│  ║ [text-xs text-muted-foreground]
║  │    via email      │  ║ [leading-tight]
║  ╰───────────────────╯  ║
║                           ║
║ In-App Notifications      ║ [text-sm font-semibold mb-2 mt-4]
║  ╭─[IN-APP CARD]───╮    ║ [Card: variant="outline", p-3]
║  │ Show in-app alerts│    ║ [text-xs label]
║  │     ●●● ○○○     │    ║ [RadioGroup: size="sm", flex gap-3]
║  │                   │    ║
║  │ 🔔 Toast messages │    ║ [text-xs text-muted-foreground]
║  │    while using app│    ║ [leading-tight]
║  ╰───────────────────╯    ║
║                           ║
║ ┏━━ Send Test Email ━━┓ ║ [Button: variant="outline", size="sm", w-full]
║                           ║
║ ✅ Auto-saved             ║ [text-xs text-green-600 text-center]
║                           ║
╚═══════════════════════════╝
```

---

## Interaction Specifications

### Toggle Controls

- **Radio Buttons**: Simple Enabled/Disabled for each notification type
- **Auto-save**: Changes saved immediately on toggle
- **Visual Feedback**: Immediate UI updates on selection

### Test Functionality

- **Test Email**: Sends sample notification to user's email
- **Delivery Confirmation**: Shows success/failure status
- **Troubleshooting**: Help text for delivery issues

### Simplified Design

- **Two Settings Only**: Email notifications, In-app notifications
- **Clear Descriptions**: Explain what each notification type does
- **No Complexity**: No frequency settings, no granular controls

---

## Accessibility Features

- **Screen Reader**: All toggles properly labeled with descriptions
- **Keyboard Navigation**: Full keyboard control of both settings
- **Focus Management**: Clear focus indicators
- **Status Announcements**: Live regions for save confirmations
- **High Contrast**: Clear visual distinction between enabled/disabled

---

## Performance Considerations

- **Auto-save**: Changes saved immediately on toggle
- **Real-time Sync**: Preference changes sync across sessions
- **Fast Loading**: <200ms to load current preferences
- **Minimal UI**: Simple interface loads instantly
