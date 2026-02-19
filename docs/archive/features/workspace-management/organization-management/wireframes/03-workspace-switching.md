# Workspace Switching Wireframes - All States

## Screen States & Wireframes

### 🏢 Single Workspace (No Switcher)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║    ▓▓▓ SEAL LOGO ▓▓▓                      Acme Corporation                   👤   ║ [Header: h-16 px-6 flex items-center justify-between]
╠═══════════════════════════════════════════════════════════════════════════════╣ [Avatar: h-8 w-8 rounded-full]
║                                                                               ║ [text-lg font-semibold] [Button: variant="ghost"]
║ 📊 Dashboard                          🏢 Your Workspace                       ║ [Container: p-6 space-y-6]
║                                                                               ║ [text-2xl font-bold] [text-lg text-muted-foreground]
║ Welcome back, John! You have 3 active documents awaiting signatures.         ║ [text-base leading-relaxed mb-6]
║                                                                               ║
║ Recent Documents                                                              ║ [text-xl font-semibold mb-4]
║ ╭─[DOCUMENTS TABLE: variant="elevated"]─────────────────────────────────────────────────╮ ║
║ │ Employment_Agreement.pdf     │ Pending    │ 2 of 3 signed  │ 2 days ago │ ║ [Table: w-full bg-white rounded-lg]
║ │ NDA_Contract.pdf             │ Completed  │ 1 of 1 signed  │ 5 days ago │ ║ [TableRow: hover:bg-gray-50 p-3]
║ │ Service_Agreement.pdf        │ Draft      │ Not sent       │ 1 week ago │ ║ [TableCell: text-sm space-x-4]
║ ╰───────────────────────────────────────────────────────────────────────────╯ ║ [Badge: variant based on status]
║                                                                               ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔄 Multiple Workspaces with Switcher

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║    ▓▓▓ SEAL LOGO ▓▓▓        Acme Corporation ▼                             👤   ║ [Header: h-16 px-6 flex items-center justify-between]
╠═══════════════════════════════════════════════════════════════════════════════╣ [Button: variant="ghost" hover:bg-gray-100 p-2 rounded-md]
║                                                                               ║ [DropdownTrigger: text-lg font-semibold flex items-center]
║ 📊 Dashboard                          🏢 Current Workspace                    ║ [Container: p-6 space-y-6] [Avatar: h-8 w-8 rounded-full]
║                                                                               ║ [text-2xl font-bold] [text-lg text-muted-foreground]
║ Welcome back, John! You have 3 active documents awaiting signatures.         ║ [text-base leading-relaxed mb-6]
║                                                                               ║
║ Recent Documents                                                              ║ [text-xl font-semibold mb-4]
║ ╭─[DOCUMENTS TABLE: variant="elevated"]─────────────────────────────────────────────────╮ ║
║ │ Employment_Agreement.pdf     │ Pending    │ 2 of 3 signed  │ 2 days ago │ ║ [Table: w-full bg-white rounded-lg]
║ │ NDA_Contract.pdf             │ Completed  │ 1 of 1 signed  │ 5 days ago │ ║ [TableRow: hover:bg-gray-50 p-3]
║ │ Service_Agreement.pdf        │ Draft      │ Not sent       │ 1 week ago │ ║ [TableCell: text-sm space-x-4]
║ ╰───────────────────────────────────────────────────────────────────────────╯ ║ [Badge: variant based on status]
║                                                                               ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔽 Workspace Switcher Dropdown (Open)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║    ▓▓▓ SEAL LOGO ▓▓▓        ╭─[WORKSPACE DROPDOWN: variant="elevated"]─────╮         👤   ║ [Header with overlay]
║                               │ 🏢 Workspaces                       │               ║ [DropdownMenu: absolute top-16 right-0 z-50 min-w-80]
╠═══════════════════════╡│                                     │╠═══════════════╣ [p-4 space-y-2 bg-white rounded-md shadow-lg]
║                               │                                     │               ║ [text-lg font-semibold text-center mb-3]
║ 📊 Dashboard                  │ ✅ Acme Corporation                 │               ║ [Container: p-6 space-y-6 blurred]
║                               │    Owner • 4 members • Active      │               ║ [DropdownMenuItem: p-3 hover:bg-gray-50 rounded-md cursor-pointer]
║                               │                                     │               ║ [text-sm font-medium mb-1] [text-xs text-muted-foreground]
║ Welcome back, John! Y         │ 🏢 Freelance Projects               │               ║ [Badge: variant="success" text-xs] [Checkmark: active workspace indicator]
║                               │    Member • 3 members • Active     │               ║
║                               │                                     │               ║
║ Recent Documents              │ 👤 Personal Workspace               │               ║
║ ╭──────────────────────╮ │    Owner • Just you • Trial       │ ╭──────────────╮ ║ [Badge: variant="secondary" text-xs]
║ │ Employment_Agreement...     │                                     │ │ 2 days ago │ ║ [Table: blurred background content]
║ │ NDA_Contract.pdf            │ ────────────────────────────────── │ │ 5 days ago │ ║ [Divider: border-t my-2]
║ │ Service_Agreement.p         │                                     │ │ 1 week ago │ ║
║ ╰──────────────────────╯ │ ➕ Create New Workspace            │ ╰──────────────╯ ║ [Button: variant="ghost" p-3 w-full text-left hover:bg-gray-50]
║                               │                                     │               ║ [text-sm text-blue-600 font-medium flex items-center]
║                               ╰─────────────────────────────────────╯               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### ⏳ Workspace Switching Loading

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║    ▓▓▓ SEAL LOGO ▓▓▓        Freelance Projects                             👤   ║ [Header: h-16 px-6 flex items-center justify-between]
╠═══════════════════════════════════════════════════════════════════════════════╣ [text-lg font-semibold] [Avatar: h-8 w-8 rounded-full]
║                                                                               ║
║                         ⏳ Switching to Freelance Projects                    ║ [text-2xl font-bold text-center text-blue-600]
║                                                                               ║
║                              Loading workspace data...                       ║ [text-lg text-center text-muted-foreground mb-6]
║                                                                               ║
║    ╭─[PROGRESS BAR: variant="default"]───────────────────────────────────────────╮  ║
║    │  [█████████████████████████████░░░░░] 85%                            │  ║ [Progress: h-4 bg-gray-200 rounded-full]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║ [ProgressIndicator: bg-blue-600 h-4 rounded-full transition-all]
║                                                                               ║ [text-sm text-blue-600 font-medium]
║                         • Updating permissions                               ║ [Container: p-6 flex flex-col items-center space-y-4]
║                         • Loading documents                                  ║ [ul: space-y-2 text-sm text-muted-foreground text-center]
║                         • Refreshing team data                               ║ [li: animate-pulse]
║                                                                               ║
║                            Please wait a moment...                           ║ [text-sm text-muted-foreground italic text-center]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### ✅ Workspace Switch Complete

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║    ▓▓▓ SEAL LOGO ▓▓▓        Freelance Projects ▼                           👤   ║ [Header: h-16 px-6 flex items-center justify-between]
╠═══════════════════════════════════════════════════════════════════════════════╣ [Button: variant="ghost" hover:bg-gray-100 p-2 rounded-md]
║                                                                               ║ [DropdownTrigger: text-lg font-semibold flex items-center]
║ 📊 Dashboard                          🏢 Current Workspace                    ║ [Container: p-6 space-y-6] [Avatar: h-8 w-8 rounded-full]
║                                                                               ║ [text-2xl font-bold] [text-lg text-muted-foreground]
║ Welcome to Freelance Projects! You have 2 active documents.                  ║ [text-base leading-relaxed mb-6]
║                                                                               ║
║ Recent Documents                                                              ║ [text-xl font-semibold mb-4]
║ ╭─[DOCUMENTS TABLE: variant="elevated"]────────────────────────────────────╮ ║
║ │ Client_Contract_ABC.pdf      │ Pending    │ 1 of 2 signed  │ 1 day ago  │ ║ [Table: w-full bg-white rounded-lg]
║ │ Project_Proposal_XYZ.pdf     │ Completed  │ 2 of 2 signed  │ 3 days ago │ ║ [TableRow: hover:bg-gray-50 p-3]
║ ╰─────────────────────────────────────────────────────────────────────────╯ ║ [TableCell: text-sm space-x-4]
║                                                                               ║ [Badge: variant based on status]
║ 🎯 You're now in Member role (limited permissions)                           ║ [Alert: variant="default" p-3 bg-blue-50 border-blue-200]
║                                                                               ║ [text-sm text-blue-700 font-medium]
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### ❌ Workspace Access Denied

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        ❌ Access Denied                                       ║ [text-3xl font-bold text-center text-red-600]
║                                                                               ║
║              You no longer have access to "Acme Corporation"                 ║ [text-lg text-center text-muted-foreground mb-6]
║                                                                               ║
║    ╭─[ACCESS DENIED CARD: variant="elevated"]────────────────────────────╮  ║
║    │                                                                       │  ║ [Card: p-6 space-y-4 bg-red-50 border-red-200]
║    │  You were removed from this workspace while you were active.         │  ║ [text-base text-red-700 mb-4]
║    │                                                                       │  ║
║    │  This can happen when:                                                │  ║ [text-sm font-medium text-red-800 mb-2]
║    │  • A workspace admin removed you                                      │  ║ [ul: space-y-1 text-sm text-red-700]
║    │  • The workspace was deleted                                          │  ║ [li: ml-4]
│    │  • Your access was revoked                                          │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Available Workspaces:                                                    │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                🏢 Freelance Projects                                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                👤 Personal Workspace                                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Create New Workspace>                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ➕ Create New Workspace from Switcher

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                      [ ✕ ]  │
│                         ➕ Create New Workspace                             │
│                                                                             │
│                    Create another workspace for your team                  │
│                                                                             │
│    Workspace Name                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Enter workspace name                                                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Workspace Type                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ (•) Business Team                                                   │  │
│    │ ( ) Personal Projects                                               │  │
│    │ ( ) Client Work                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    💳 Billing Setup Required                                               │
│    • 2-week free trial                                                     │
│    • $10/month per member after trial                                      │
│    • Independent billing from your other workspaces                        │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Create Workspace & Setup Billing                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                              <Cancel>                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔔 Workspace Notification Banner

```
┌─────────────────────────────────────────────────────────────────────────────┐
│    [LOGO] Seal        Acme Corporation ▼                             👤   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Payment Required • Your trial expires in 3 days • Update billing   [ ✕ ] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📊 Dashboard                          🏢 Current Workspace                  │
│                                                                             │
│ Welcome back, John! You have 3 active documents awaiting signatures.       │
│                                                                             │
│ Recent Documents                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Employment_Agreement.pdf     │ Pending    │ 2 of 3 signed  │ 2 days ago │ │
│ │ NDA_Contract.pdf             │ Completed  │ 1 of 1 signed  │ 5 days ago │ │
│ │ Service_Agreement.pdf        │ Draft      │ Not sent       │ 1 week ago │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🚨 Workspace Suspended State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│    [LOGO] Seal        Acme Corporation (Suspended) ▼                 👤   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🚨 Workspace Suspended • Payment failed • Update payment to restore    [💳] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📊 Dashboard (Read-Only Mode)             🏢 Current Workspace              │
│                                                                             │
│ Your workspace is in read-only mode. Existing signatures still work.       │
│                                                                             │
│ Recent Documents                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Employment_Agreement.pdf     │ Pending    │ 2 of 3 signed  │ 2 days ago │ │
│ │ NDA_Contract.pdf             │ Completed  │ 1 of 1 signed  │ 5 days ago │ │
│ │ Service_Agreement.pdf        │ Draft      │ Not sent       │ 1 week ago │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ⚠️ New document creation disabled until payment is updated                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Single Workspace

```
┌─────────────────────────┐
│ [LOGO] Seal        👤   │
│                         │
│ Acme Corporation        │
├─────────────────────────┤
│                         │
│ 📊 Dashboard            │
│                         │
│ Welcome back, John!     │
│ 3 active documents      │
│                         │
│ Recent Documents        │
│ ┌─────────────────────┐ │
│ │ Employment_Agmt.pdf │ │
│ │ Pending • 2 days    │ │
│ ├─────────────────────┤ │
│ │ NDA_Contract.pdf    │ │
│ │ Complete • 5 days   │ │
│ ├─────────────────────┤ │
│ │ Service_Agmt.pdf    │ │
│ │ Draft • 1 week      │ │
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Workspace Switcher

```
┌─────────────────────────┐
│ [LOGO] Seal        👤   │
│                         │
│ Acme Corporation    ▼   │
├─────────────────────────┤
│ 🏢 Workspaces           │
│                         │
│ ✅ Acme Corporation     │
│   Owner • 4 members     │
│   Active                │
│                         │
│ 🏢 Freelance Projects   │
│   Member • 3 members    │
│   Active                │
│                         │
│ 👤 Personal Workspace   │
│   Owner • Just you      │
│   Trial                 │
│                         │
│ ─────────────────────   │
│                         │
│ ➕ Create New Workspace │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Access Denied

```
┌─────────────────────────┐
│ [LOGO] Seal        👤   │
├─────────────────────────┤
│                         │
│ ❌ Access Denied        │
│                         │
│ No access to            │
│ "Acme Corporation"      │
│                         │
│ You were removed from   │
│ this workspace.         │
│                         │
│ Available Workspaces:   │
│                         │
│ ┌─────────────────────┐ │
│ │ 🏢 Freelance        │ │
│ │    Projects         │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 Personal         │ │
│ │    Workspace        │ │
│ └─────────────────────┘ │
│                         │
│ <Create New Workspace>  │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Workspace Switcher Behavior

- **Dropdown Toggle**: Click to open/close workspace list
- **Keyboard Navigation**: Arrow keys to navigate, Enter to select
- **Visual Indicators**: Show current workspace, user role, and status
- **Quick Access**: Recent workspaces appear at top of list

### Context Switching Process

- **Seamless Transition**: Smooth loading state during switch
- **Data Persistence**: Preserve unsaved work when possible
- **Permission Updates**: Immediate permission refresh via Convex
- **URL Management**: Update browser URL to reflect current workspace

### Workspace Status Indicators

- **Billing Status**: Clear visual indicators for trial, active, suspended
- **Member Count**: Show current member count and billing impact
- **Role Display**: User's role in each workspace clearly shown
- **Activity Indicators**: Show recent activity or updates

### Error Handling

- **Access Denied**: Clear explanation and recovery options
- **Network Issues**: Retry mechanisms with user feedback
- **Invalid Workspace**: Automatic fallback to valid workspace
- **State Consistency**: Handle real-time access revocation gracefully

---

## Technical Integration

### Convex Real-time Updates

- **Context Switching**: Seamless workspace data updates
- **Permission Changes**: Instant permission refresh across all clients
- **Member Updates**: Real-time workspace member list updates
- **State Persistence**: Automatic workspace preference saving

### Clerk Integration

- **Multi-Organization Support**: Handle users across multiple workspaces
- **Permission Context**: Dynamic permission checking per workspace
- **Role-Based Features**: Different UI based on user role in workspace
- **Session Management**: Maintain authentication across workspace switches

### URL and State Management

- **Workspace Routing**: Clean URL structure with workspace context
- **Browser History**: Proper back/forward navigation support
- **Deep Linking**: Direct links to specific workspace contexts
- **State Persistence**: Remember last active workspace preference

### Stripe Billing Integration

- **Per-Workspace Billing**: Independent billing status per workspace
- **Feature Access**: Features based on current workspace subscription
- **Trial Management**: Clear trial status and expiration warnings
- **Payment Recovery**: Easy payment update flows for suspended workspaces

### Mobile Optimization

- **Touch-Friendly Switcher**: Large touch targets for mobile
- **Responsive Layout**: Adaptive workspace information display
- **Swipe Navigation**: Consider swipe gestures for workspace switching
- **Offline Handling**: Graceful degradation when network unavailable
