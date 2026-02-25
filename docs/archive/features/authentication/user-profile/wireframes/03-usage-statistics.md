# Usage Statistics Wireframes - All States

## Screen States & Wireframes

### 🟢 Default Usage Statistics State

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        Usage Statistics                                       ║ [text-3xl font-bold text-center]
║                  Acme Corporation Workspace                                    ║ [text-lg text-muted-foreground text-center]
║                                                                               ║
║    This Month (December 2024)                                                ║ [text-xl font-semibold mb-4]
║    ╭─[MONTHLY STATS CARD: variant="elevated"]─────────────────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-blue-50]
║    │  📄 Documents Sent          15                                        │   ║ [flex justify-between text-base]
║    │  ✅ Documents Signed          8                                         │   ║ [flex justify-between text-base text-green-700]
║    │  ⏳ Pending Signatures        7                                         │   ║ [flex justify-between text-base text-orange-600]
║    │  👥 Recipients Contacted     42                                        │   ║ [flex justify-between text-base text-blue-600]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    All Time Statistics                                                       ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[LIFETIME STATS CARD: variant="elevated"]─────────────────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-gray-50]
║    │  📄 Total Documents         127                                       │   ║ [flex justify-between text-base font-medium]
║    │  ✅ Completed Documents     104                                        │   ║ [flex justify-between text-base text-green-700]
║    │  👥 Unique Recipients       89                                        │   ║ [flex justify-between text-base text-blue-600]
║    │  🗓 Member Since            March 2024                                │   ║ [flex justify-between text-base text-muted-foreground]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    API Usage (This Month)                                                    ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[API USAGE CARD: variant="elevated"]─────────────────────────────────╮     ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-purple-50]
║    │  🔑 API Calls Made          2,543                                     │   ║ [flex justify-between text-base]
║    │  📈 Rate Limit Used         25.4%                                     │   ║ [flex justify-between text-base]
║    │  💼 Active API Keys         2                                         │   ║ [flex justify-between text-base]
║    │                                                                       │   ║
║    │                    ┏━━━ Manage API Keys ━━━┓                          │   ║ [Button: variant="outline", className="w-full"]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Multiple Workspaces State

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        Usage Statistics                                       ║ [text-3xl font-bold text-center]
║                                                                               ║
║    Current Workspace: ╭─[WORKSPACE SELECT: variant="outline"]──╮             ║ [Select: w-64 mb-6]
║    ╭─[WORKSPACE DROPDOWN]─────────────────────────────────────────────────╮   ║ [SelectContent: bg-white shadow-md]
║    │ Acme Corporation       (Current)                                    │   ║ [SelectItem: bg-blue-50 text-blue-700]
║    │ Personal Workspace                                                  │   ║ [SelectItem: hover:bg-gray-50]
║    │ Consulting Projects                                                 │   ║ [SelectItem: hover:bg-gray-50]
║    ╰─────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    This Month (December 2024) - Acme Corporation                             ║ [text-xl font-semibold mb-4]
║    ╭─[MONTHLY STATS CARD: variant="elevated"]─────────────────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-blue-50]
║    │  📄 Documents Sent          15                                        │   ║ [flex justify-between text-base]
║    │  ✅ Documents Signed          8                                         │   ║ [flex justify-between text-base text-green-700]
║    │  ⏳ Pending Signatures        7                                         │   ║ [flex justify-between text-base text-orange-600]
║    │  👥 Recipients Contacted     42                                        │   ║ [flex justify-between text-base text-blue-600]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    All Time Statistics - Acme Corporation                                    ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[LIFETIME STATS CARD: variant="elevated"]─────────────────────────────╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-gray-50]
║    │  📄 Total Documents         127                                       │   ║ [flex justify-between text-base font-medium]
║    │  ✅ Completed Documents     104                                        │   ║ [flex justify-between text-base text-green-700]
║    │  👥 Unique Recipients       89                                        │   ║ [flex justify-between text-base text-blue-600]
║    │  🗓 Joined Workspace        March 2024                                │   ║ [flex justify-between text-base text-muted-foreground]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🔵 Empty Statistics State (New User)

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        Usage Statistics                                       ║ [text-3xl font-bold text-center]
║                    Personal Workspace                                         ║ [text-lg text-muted-foreground text-center]
║                                                                               ║
║                      📊 No Activity Yet                                      ║ [text-2xl text-center text-muted-foreground mb-6]
║                                                                               ║
║    ╭─[WELCOME MESSAGE CARD: variant="elevated"]─────────────────────────────╮ ║
║    │                                                                         │ ║ [Card: p-8 bg-gray-50 text-center]
║    │              Welcome to Seal! Your usage statistics                    │ ║ [text-lg font-medium mb-4]
║    │                       will appear here once you:                       │ ║ [text-base text-muted-foreground mb-6]
║    │                                                                         │ ║
║    │    ╭─[CHECKLIST CARD: variant="outline"]──────────────────────────────╮ │ ║
║    │    │                                                                   │ │ ║ [Card: p-4 space-y-3 bg-white]
║    │    │  📄 Send your first document for signing                         │ │ ║ [flex items-center gap-3 text-sm]
║    │    │  ✅ Complete your first signature request                         │ │ ║ [flex items-center gap-3 text-sm]
║    │    │  👥 Invite team members to your workspace                        │ │ ║ [flex items-center gap-3 text-sm]
║    │    │  🔑 Generate API keys for integrations                            │ │ ║ [flex items-center gap-3 text-sm]
║    │    │                                                                   │ │ ║
║    │    ╰───────────────────────────────────────────────────────────────────╯ │ ║
║    │                                                                         │ ║
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━ Get Started ━━━━━━━━━━━━━━━━━━━━┓                       ║ [Button: variant="default", size="lg", w-full, py-4]
║                                                                               ║
║                    <View Getting Started Guide>                              ║ [Link: text-sm text-blue-600 hover:underline]
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Loading Statistics State

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        Usage Statistics                                       ║ [text-3xl font-bold text-center]
║                  Acme Corporation Workspace                                   ║ [text-lg text-muted-foreground text-center]
║                                                                               ║
║    This Month (December 2024)                                                ║ [text-xl font-semibold mb-4]
║    ╭─[MONTHLY STATS CARD: variant="elevated", className="animate-pulse"]──╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-blue-50]
║    │  📄 Documents Sent          ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  ✅ Documents Signed         ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  ⏳ Pending Signatures       ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  👥 Recipients Contacted     ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    All Time Statistics                                                       ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[LIFETIME STATS CARD: variant="elevated", className="animate-pulse"]─╮   ║
║    │                                                                       │   ║ [Card: p-6 space-y-4 bg-gray-50]
║    │  📄 Total Documents         ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  ✅ Completed Documents     ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  👥 Unique Recipients       ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │  🗓 Member Since            ⏳ Loading...                           │   ║ [flex justify-between text-base text-muted-foreground]
║    │                                                                       │   ║
║    ╰───────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🟢 API Usage Detail State

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          API Usage                                           ║ [text-3xl font-bold text-center]
║                  Acme Corporation Workspace                                   ║ [text-lg text-muted-foreground text-center]
║                                                                               ║
║    Current Month Usage                                                       ║ [text-xl font-semibold mb-4]
║    ╭─[API USAGE CARD: variant="elevated"]──────────────────────────────────╮  ║
║    │                                                                        │  ║ [Card: p-6 space-y-4 bg-purple-50]
║    │  📊 Total API Calls         2,543 / 10,000 limit                     │  ║ [flex justify-between text-base font-medium]
║    │  ████████░░ 25.4% used                                                │  ║ [Progress: value=25.4, className="w-full h-2"]
║    │                                                                        │  ║ [bg-purple-200 fill-purple-600]
║    │  🔑 Active API Keys         2                                         │  ║ [flex justify-between text-base]
║    │  📅 Resets on               January 1, 2025                          │  ║ [flex justify-between text-base text-muted-foreground]
║    │                                                                        │  ║
║    ╰────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    API Keys                                                                  ║ [text-xl font-semibold mb-4 mt-8]
║    ╭─[API KEYS CARD: variant="elevated"]────────────────────────────────────╮  ║
║    │                                                                        │  ║ [Card: p-6 space-y-6 bg-gray-50]
║    │  ╭─[PRODUCTION API KEY]─────────────────────────────╮ ┏━━ Manage ━━┓  │  ║ [flex justify-between items-start]
║    │  │ Production API              1,847 calls          │ ┃  [Manage]  ┃  │  ║ [div: space-y-1, Button: size="sm"]
║    │  │ Created: Oct 15, 2024       Last used: 2 hours ago │              │  ║ [text-sm text-muted-foreground]
║    │  ╰───────────────────────────────────────────────────╯              │  ║
║    │                                                                        │  ║
║    │  ╭─[DEVELOPMENT API KEY]─────────────────────────────╮ ┏━━ Manage ━━┓  │  ║ [flex justify-between items-start]
║    │  │ Development API             696 calls              │ ┃  [Manage]  ┃  │  ║ [div: space-y-1, Button: size="sm"]
║    │  │ Created: Dec 1, 2024        Last used: 15 min ago  │              │  ║ [text-sm text-muted-foreground]
║    │  ╰───────────────────────────────────────────────────╯              │  ║
║    │                                                                        │  ║
║    ╰────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━ Create New API Key ━━━━━━━━━━━━━━━━━┓                     ║ [Button: variant="default", w-full, py-3]
║                                                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Responsive States

### 📱 Mobile Usage Statistics

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
║                           ║
╠═══════════════════════════╣
║                           ║
║   Usage Statistics        ║ [text-lg font-bold text-center]
║   Acme Corporation        ║ [text-sm text-muted-foreground text-center]
║                           ║
║ This Month                ║ [text-sm font-semibold mb-2]
║  ╭─[MONTHLY CARD]─────╮   ║ [Card: variant="outline", p-3]
║  │ 📄 Sent        15   │   ║ [flex justify-between text-xs]
║  │ ✅ Signed       8   │   ║ [flex justify-between text-xs text-green-600]
║  │ ⏳ Pending      7   │   ║ [flex justify-between text-xs text-orange-600]
║  │ 👥 Recipients  42   │   ║ [flex justify-between text-xs text-blue-600]
║  ╰─────────────────────╯   ║
║                           ║
║ All Time                  ║ [text-sm font-semibold mb-2 mt-4]
║  ╭─[LIFETIME CARD]────╮   ║ [Card: variant="outline", p-3]
║  │ 📄 Total      127   │   ║ [flex justify-between text-xs font-medium]
║  │ ✅ Complete   104   │   ║ [flex justify-between text-xs text-green-600]
║  │ 👥 Recipients  89   │   ║ [flex justify-between text-xs text-blue-600]
║  │ 🗓 Since   Mar '24  │   ║ [flex justify-between text-xs text-muted-foreground]
║  ╰─────────────────────╯   ║
║                           ║
║ API Usage                 ║ [text-sm font-semibold mb-2 mt-4]
║  ╭─[API CARD]─────────╮   ║ [Card: variant="outline", p-3]
║  │ 🔑 Calls    2,543   │   ║ [flex justify-between text-xs]
║  │ 📈 Used     25.4%   │   ║ [flex justify-between text-xs]
║  │ 💼 Keys         2   │   ║ [flex justify-between text-xs]
║  │ ┏━ Manage Keys ━┓   │   ║ [Button: variant="outline", size="xs", w-full]
║  ╰─────────────────────╯   ║
║                           ║
╚═══════════════════════════╝
```

---

## Interaction Specifications

### Workspace Switching

- **Dropdown Selection**: Change active workspace context
- **Real-time Updates**: Statistics update immediately on switch
- **Preserved Context**: Remember last viewed workspace

### API Key Management

- **Quick Actions**: View usage, manage permissions, delete keys
- **Usage Monitoring**: Real-time usage percentage updates
- **Rate Limit Warnings**: Visual indicators when approaching limits

### Time Period Navigation

- **Period Selection**: Current month, last month, all time
- **Data Refresh**: Automatic updates for current period
- **Export Options**: Download statistics as CSV (future)

---

## Accessibility Features

- **Screen Reader**: Statistics clearly announced with context
- **Keyboard Navigation**: Full keyboard access to all data
- **Data Tables**: Proper table structure for screen readers
- **Focus Management**: Clear focus indicators on interactive elements
- **High Contrast**: Clear distinction between different statistics

---

## Performance Considerations

- **Fast Loading**: <500ms to load current workspace statistics
- **Caching**: Cache frequently accessed statistics
- **Real-time Updates**: Live updates for current month data
- **Lazy Loading**: Load detailed API data only when requested
- **Batch Queries**: Efficient database queries for statistics
