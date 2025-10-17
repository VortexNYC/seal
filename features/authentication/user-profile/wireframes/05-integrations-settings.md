# Integrations Settings Wireframes - All States

## Screen States & Wireframes

### 🔌 Integrations & API Access

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          Integrations & API                                   ║ [text-3xl font-bold text-center]
║                                                                               ║
║    API Access                                                                 ║ [text-xl font-semibold mb-4]
║    ╭─[API CARD: variant="elevated"]───────────────────────────────────────╮   ║
║    │ 🔑 API Keys                                      🚀 Pro Feature        │   ║ [Card: p-6 space-y-4]
║    │                                                                         │   ║ [flex justify-between items-center mb-4]
║    │ Use API keys to integrate Seal with your applications                  │   ║ [text-sm text-muted-foreground mb-4]
║    │                                                                         │   ║ [leading-relaxed]
║    │ Your API Keys                                                           │   ║ [text-base font-medium mb-3]
║    │ ╭─[API KEY 1]────────────────────────────────────────────────────────╮ │   ║
║    │ │ Production API     sk_live_abc123...   ┏━Regenerate━┓ ┏━Delete━┓   │ │   ║ [Card: p-4 bg-gray-50 flex justify-between items-center]
║    │ │ Created: Jan 15, 2024 • Last used: 2 hours ago                     │ │   ║ [text-sm text-muted-foreground mt-1]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │   ║ [Button: variant="outline" size="sm"]
║    │                                                                         │   ║
║    │ ╭─[API KEY 2]────────────────────────────────────────────────────────╮ │   ║
║    │ │ Development API    sk_test_def456...   ┏━Regenerate━┓ ┏━Delete━┓   │ │   ║ [Card: p-4 bg-gray-50 flex justify-between items-center]
║    │ │ Created: Jan 10, 2024 • Last used: Never                           │ │   ║ [text-sm text-muted-foreground mt-1]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │   ║ [Button: variant="outline" size="sm"]
║    │                                                                         │   ║
║    │ ┏━━━━━━━━━━━━━━━━━━ Create New API Key ━━━━━━━━━━━━━━━━━━┓                │   ║ [Button: variant="outline" w-full py-3]
║    │                                                                         │   ║
║    ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    Webhooks                                                                   ║ [text-xl font-semibold mb-4 mt-6]
║    ╭─[WEBHOOKS CARD: variant="elevated"]───────────────────────────────────╮   ║
║    │ 📡 Webhook Endpoints                             🚀 Pro Feature        │   ║ [Card: p-6 space-y-4]
║    │                                                                         │   ║ [flex justify-between items-center mb-4]
║    │ Get real-time notifications when documents are signed                  │   ║ [text-sm text-muted-foreground mb-4]
║    │                                                                         │   ║ [leading-relaxed]
║    │ Your Webhook Endpoints                                                  │   ║ [text-base font-medium mb-3]
║    │ ╭─[WEBHOOK 1]────────────────────────────────────────────────────────╮ │   ║
║    │ │ https://api.myapp.com/webhooks/seal          ┏━Edit━┓ ┏━Delete━┓   │ │   ║ [Card: p-4 bg-gray-50 flex justify-between items-center]
║    │ │ Events: document.signed, document.completed                         │ │   ║ [text-sm text-muted-foreground]
║    │ │ Status: Active ✅ • Last delivery: 1 hour ago                       │ │   ║ [text-sm text-green-600 mt-1]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │   ║ [Button: variant="outline" size="sm"]
║    │                                                                         │   ║
║    │ ┏━━━━━━━━━━━━━━━━━ Add Webhook Endpoint ━━━━━━━━━━━━━━━━━┓                │   ║ [Button: variant="outline" w-full py-3]
║    │                                                                         │   ║
║    ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    📚 Need help? Check our ┏━API Documentation━┓ and ┏━Integration Guide━┓   ║ [text-sm text-muted-foreground text-center]
║                                                                               ║ [Button: variant="link" size="sm"]
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔑 Create New API Key

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          Create New API Key                                   ║ [text-3xl font-bold text-center]
║                                                                               ║
║    API Key Configuration                                                      ║ [text-xl font-semibold mb-4]
║    ╭─[API CONFIG FORM: variant="elevated"]───────────────────────────────────╮ ║
║    │ Name (for your reference)                                               │ ║ [Card: p-6 space-y-4]
║    │ ╭─[NAME INPUT]───────────────────────────────────────────────────────╮ │ ║ [Label: text-sm font-medium mb-2]
║    │ │ Production Integration                                              │ │ ║ [Input: w-full p-3 border-gray-300]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │ ║ [focus:border-blue-500]
║    │                                                                         │ ║
║    │ Environment                                                             │ ║ [Label: text-sm font-medium mb-2 mt-4]
║    │ ●●● Production    ○○○ Development                                        │ ║ [RadioGroup: flex gap-4]
║    │                                                                         │ ║ [RadioGroupItem: size="default"]
║    │                                                                         │ ║
║    │ Permissions                                                             │ ║ [Label: text-sm font-medium mb-3 mt-4]
║    │ ☑️  Read documents                                                       │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☑️  Create documents                                                     │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☑️  Send for signature                                                   │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☐  Delete documents                                                     │ ║ [Checkbox: unchecked, mr-2 mb-2]
║    │ ☐  Manage workspace settings                                            │ ║ [Checkbox: unchecked, mr-2 mb-2]
║    │                                                                         │ ║ [text-sm space-y-2]
║    │                                                                         │ ║
║    │ ┏━━━━━━━━━━━━━━━━━━ Create API Key ━━━━━━━━━━━━━━━━━━┓                    │ ║ [Button: variant="default" w-full py-3]
║    │                                                                         │ ║
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━ Cancel ━━━━━━━━━━━━━━━━━━━━━━━┓                     ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔐 API Key Created

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          ✅ API Key Created                                   ║ [text-3xl font-bold text-center text-green-600]
║                                                                               ║
║    Your new API key has been created                                         ║ [text-lg font-medium mb-4 text-center]
║                                                                               ║
║    ╭─[WARNING ALERT: variant="destructive"]──────────────────────────────────╮     ║
║    │ ⚠️  Copy this key now - you won't be able to see it again                │     ║ [Alert: bg-yellow-50 border-yellow-200 p-4]
║    ╰──────────────────────────────────────────────────────────────────────╯     ║ [text-yellow-800 text-center font-medium]
║                                                                               ║
║    API Key                                                                    ║ [text-base font-semibold mb-2]
║    ╭─[API KEY DISPLAY]───────────────────────────────────────────────────────╮ ║
║    │ sk_live_1234567890abcdef1234567890abcdef1234567890abc  ┏━Copy━┓ │ ║ [Card: p-4 bg-gray-100 font-mono text-sm]
║    ╰─────────────────────────────────────────────────────────────────────╯ ║ [Button: variant="outline" size="sm"]
║                                                                               ║
║    Key Details                                                                ║ [text-base font-semibold mb-2 mt-4]
║    • Name: Production Integration                                            ║ [ul: space-y-1 text-sm]
║    • Environment: Production                                                 ║ [li: text-muted-foreground]
║    • Permissions: Read, Create, Send documents                              ║
║    • Created: Just now                                                       ║
║                                                                               ║
║    Next Steps                                                                 ║ [text-base font-semibold mb-2 mt-4]
║    1. Store this key securely in your application                           ║ [ol: space-y-1 text-sm]
║    2. Use it in your API requests: Authorization: Bearer sk_live_...         ║ [li: text-muted-foreground]
║    3. Check our ┏━API Documentation━┓ for integration examples                   ║ [Button: variant="link"]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━ I've Saved My API Key ━━━━━━━━━━━━━━━━━━━━┓        ║ [Button: variant="default" w-full py-3]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 📡 Add Webhook Endpoint

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          Add Webhook Endpoint                                 ║ [text-3xl font-bold text-center]
║                                                                               ║
║    Webhook Configuration                                                      ║ [text-xl font-semibold mb-4]
║    ╭─[WEBHOOK FORM: variant="elevated"]────────────────────────────────────────╮ ║
║    │ Endpoint URL                                                            │ ║ [Card: p-6 space-y-4]
║    │ ╭─[URL INPUT]──────────────────────────────────────────────────────────╮ │ ║ [Label: text-sm font-medium mb-2]
║    │ │ https://api.myapp.com/webhooks/seal                                 │ │ ║ [Input: type="url" w-full p-3]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │ ║ [border-gray-300 focus:border-blue-500]
║    │                                                                         │ ║
║    │ Events to send                                                          │ ║ [Label: text-sm font-medium mb-3 mt-4]
║    │ ☑️  document.created         Document uploaded and created              │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☑️  document.sent           Document sent for signature               │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☑️  document.signed         Document signed by recipient               │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☑️  document.completed      All signatures completed                   │ ║ [Checkbox: checked, mr-2 mb-2]
║    │ ☐  document.declined       Document declined by recipient              │ ║ [Checkbox: unchecked, mr-2 mb-2]
║    │ ☐  document.expired        Document signing expired                    │ ║ [Checkbox: unchecked, mr-2 mb-2]
║    │                                                                         │ ║ [text-sm space-y-2]
║    │                                                                         │ ║
║    │ Secret (optional)                                                       │ ║ [Label: text-sm font-medium mb-2 mt-4]
║    │ ╭─[SECRET INPUT]────────────────────────────────────────────────────╮ │ ║
║    │ │ webhook_secret_12345                                                │ │ ║ [Input: type="password" w-full p-3]
║    │ ╰─────────────────────────────────────────────────────────────────────╯ │ ║ [border-gray-300 focus:border-blue-500]
║    │ Used to verify webhook authenticity                                    │ ║ [text-xs text-muted-foreground mt-1]
║    │                                                                         │ ║
║    │                                                                         │ ║
║    │ ┏━━━━━━━━━━━━━━━━━━━━ Create Webhook ━━━━━━━━━━━━━━━━━━━━┓                  │ ║ [Button: variant="default" w-full py-3]
║    │                                                                         │ ║
║    ╰─────────────────────────────────────────────────────────────────────────╯ ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━ Cancel ━━━━━━━━━━━━━━━━━━━━━━━┓                     ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🆓 Free Plan - Upgrade Required

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               [LOGO] Seal                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Integrations & API                             │
│                                                                             │
│    API Access                                                               │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ 🔑 API Keys                              🚀 Pro Feature Required     │  │
│    │                                                                     │  │
│    │ Integrate Seal with your applications using our REST API           │  │
│    │                                                                     │  │
│    │ 🚫 API access is only available on Pro plans                       │  │
│    │                                                                     │  │
│    │ Pro features include:                                               │  │
│    │ • Full REST API access                                              │  │
│    │ • Webhook notifications                                             │  │
│    │ • Unlimited API requests                                            │  │
│    │ • Priority support                                                  │  │
│    │                                                                     │  │
│    │ ┌─────────────────────────────────────────────────────────────────┐ │  │
│    │ │                    🚀 Upgrade to Pro                            │ │  │
│    │ └─────────────────────────────────────────────────────────────────┘ │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Webhooks                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ 📡 Webhook Endpoints                     🚀 Pro Feature Required     │  │
│    │                                                                     │  │
│    │ Get real-time notifications when documents are signed              │  │
│    │                                                                     │  │
│    │ 🚫 Webhook access is only available on Pro plans                   │  │
│    │                                                                     │  │
│    │ ┌─────────────────────────────────────────────────────────────────┐ │  │
│    │ │                    🚀 Upgrade to Pro                            │ │  │
│    │ └─────────────────────────────────────────────────────────────────┘ │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    📚 Want to learn more? Check our [API Documentation]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📱 Mobile - Integrations

```
╔═════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓   ║ [Logo: h-8 mobile variant]
║                         ║
╠═════════════════════════╣
║                         ║
║    Integrations         ║ [text-lg font-semibold text-center]
║                         ║
║ API Access 🚀           ║ [text-sm font-semibold mb-2]
║ ╭─[API MOBILE CARD]───╮  ║ [Card: variant="outline" p-3 bg-gray-50]
║ │ 🔑 API Keys         │  ║ [text-sm font-medium mb-1]
║ │                     │  ║
║ │ Production API      │  ║ [text-xs text-muted-foreground]
║ │ sk_live_abc123...   │  ║ [text-xs font-mono truncate]
║ │ ┏━Edit━┓ ┏━Delete━┓  │  ║ [Button: variant="outline" size="xs"]
║ │                     │  ║
║ │ ┏━ Create New Key ━┓ │  ║ [Button: variant="outline" size="sm" w-full]
║ ╰─────────────────────╯  ║
║                         ║
║ Webhooks 🚀             ║ [text-sm font-semibold mb-2 mt-4]
║ ╭─[WEBHOOK MOBILE]────╮  ║ [Card: variant="outline" p-3 bg-gray-50]
║ │ 📡 Endpoints        │  ║ [text-sm font-medium mb-1]
║ │                     │  ║
║ │ api.myapp.com       │  ║ [text-xs text-muted-foreground truncate]
║ │ Active ✅           │  ║ [text-xs text-green-600 font-medium]
║ │ ┏━Edit━┓ ┏━Delete━┓  │  ║ [Button: variant="outline" size="xs"]
║ │                     │  ║
║ │ ┏━ Add Endpoint ━━┓  │  ║ [Button: variant="outline" size="sm" w-full]
║ ╰─────────────────────╯  ║
║                         ║
║ ┏━ API Documentation ━┓  ║ [Button: variant="link" size="sm" w-full]
║                         ║
╚═════════════════════════╝
```

---

## Interactive Elements

### API Key Management
- **Create/Delete**: Full CRUD operations for API keys
- **Copy to Clipboard**: One-click copy for new keys
- **Usage Tracking**: Show last used timestamps
- **Permission Scopes**: Granular permission control

### Webhook Management
- **Endpoint Testing**: Test webhook delivery
- **Event Selection**: Choose which events to receive
- **Delivery Status**: Show successful/failed deliveries
- **Secret Management**: Optional webhook signing secrets

### Free Plan Restrictions
- **Upgrade Prompts**: Clear calls-to-action for Pro upgrade
- **Feature Previews**: Show what's available with Pro
- **Documentation Access**: Free users can still view docs

---

## State Management

### API Key Security
- **One-time Display**: Keys shown only once after creation
- **Secure Storage**: Keys stored encrypted in database
- **Regeneration**: Replace compromised keys
- **Audit Logging**: Track all API key operations

### Webhook Reliability
- **Retry Logic**: Automatic retry for failed deliveries
- **Status Monitoring**: Track webhook health
- **Event Queuing**: Queue events during endpoint downtime

---

## Pro Feature Gating

### Access Control
- **Plan Check**: Verify Pro subscription before showing features
- **Graceful Degradation**: Show upgrade prompts for Free users
- **Feature Flags**: Toggle features based on subscription status

---

## Accessibility Features

- **API Key Safety**: Screen readers announce security warnings
- **Keyboard Navigation**: Full keyboard access to all functions
- **Error Handling**: Clear error messages for webhook failures
- **Documentation Links**: Accessible help resources

---

## Confirmation Dialogs

### Remove API Key Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          🗑️ Remove API Key                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │        Are you sure you want to remove this API key?                   │ │
│ │                                                                         │ │
│ │ **API Key:** seal_sk_dev_•••••••••••••••••••••••••••1234               │ │
│ │ **Name:** Development Key                                               │ │
│ │ **Created:** January 15, 2024                                          │ │
│ │ **Last used:** 3 hours ago                                             │ │
│ │                                                                         │ │
│ │ ⚠️ **Warning:** This action cannot be undone                           │ │
│ │                                                                         │ │
│ │ **What will happen:**                                                   │ │
│ │ • All API calls using this key will immediately fail                   │ │
│ │ • Any integrations using this key will stop working                    │ │
│ │ • You'll need to update your applications with a new key               │ │
│ │                                                                         │ │
│ │ **Usage this month:** 2,847 API calls                                  │ │
│ │                                                                         │ │
│ │ **Recommendation:** Create a new API key before removing this one      │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]  [+ Create New Key First]  [🗑️ Remove API Key]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Remove Webhook Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal          Workspace: Acme Corp ▼                    👤 John Doe ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        🗑️ Remove Webhook                                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │        Are you sure you want to remove this webhook?                   │ │
│ │                                                                         │ │
│ │ **Endpoint:** https://api.yourapp.com/webhooks/seal                     │ │
│ │ **Events:** document.completed, document.signed                        │ │
│ │ **Status:** Active                                                      │ │
│ │ **Created:** February 3, 2024                                          │ │
│ │ **Last delivery:** 1 hour ago (successful)                             │ │
│ │                                                                         │ │
│ │ **What will happen:**                                                   │ │
│ │ • Your application will stop receiving webhook notifications            │ │
│ │ • No more events will be sent to this endpoint                         │ │
│ │ • Any pending deliveries will be cancelled                             │ │
│ │                                                                         │ │
│ │ **Recent activity:** 156 successful deliveries this month              │ │
│ │                                                                         │ │
│ │ You can recreate this webhook later if needed                          │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]                                    [🗑️ Remove Webhook]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```