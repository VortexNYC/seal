# External API Integration - API Integration Interface Wireframe

## API Request/Response Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔗 API INTEGRATION FLOW                      │
│                                                                 │
│ ┌─ EXTERNAL SYSTEM ─────────────┐    ┌─ SEAL API ─────────────┐ │
│ │                               │    │                         │ │
│ │ 📤 HTTP Request               │───▶│ 🔍 Authentication       │ │
│ │ POST /sendDocument            │    │ Bearer API_KEY          │ │
│ │                               │    │                         │ │
│ │ {                             │    │ ✅ Authorization        │ │
│ │   "documentUrl": "...",       │    │ Workspace: acme-corp    │ │
│ │   "recipients": [             │    │ User: admin@acme.com    │ │
│ │     {"email": "user@co.com"}  │    │                         │ │
│ │   ]                           │    │ 🔄 Processing           │ │
│ │ }                             │    │ • Validate request      │ │
│ │                               │    │ • Create document       │ │
│ │ 📥 HTTP Response              │◀───│ • Send for signature    │ │
│ │ 200 OK                        │    │                         │ │
│ │                               │    │ 📤 Response             │ │
│ │ {                             │    │ {                       │ │
│ │   "documentId": "doc_123",    │    │   "documentId": "...",  │ │
│ │   "status": "sent",           │    │   "status": "sent"      │ │
│ │   "signingUrls": [...]        │    │ }                       │ │
│ │ }                             │    │                         │ │
│ └───────────────────────────────┘    └─────────────────────────┘ │
│                                                                 │
│                              🔄                                │
│                        WEBHOOK FLOW                             │
│                                                                 │
│ ┌─ SEAL SYSTEM ─────────────────┐    ┌─ EXTERNAL WEBHOOK ─────┐ │
│ │                               │    │                         │ │
│ │ 📋 Document Signed Event      │───▶│ 📥 Webhook Received     │ │
│ │                               │    │ POST /webhook           │ │
│ │ 📤 Webhook Delivery           │    │                         │ │
│ │ POST https://app.com/webhook  │    │ {                       │ │
│ │                               │    │   "event": "signed",    │ │
│ │ {                             │    │   "documentId": "...",  │ │
│ │   "event": "document.signed", │    │   "recipient": "..."    │ │
│ │   "documentId": "doc_123",    │    │ }                       │ │
│ │   "recipient": "user@co.com", │    │                         │ │
│ │   "signedAt": "2024-01-15"    │    │ ⚡ Business Logic       │ │
│ │ }                             │    │ • Update internal state │ │
│ │                               │    │ • Notify stakeholders   │ │
│ │ 📥 Webhook Response           │◀───│ • Trigger workflows     │ │
│ │ 200 OK                        │    │                         │ │
│ └───────────────────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoint Documentation Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                        🔗 API REFERENCE                         │
│                                                                 │
│ ┌─ ENDPOINTS SIDEBAR ────────────┐ ┌─ ENDPOINT DETAILS ─────────┐ │
│ │                                │ │                            │ │
│ │ 📄 Documents                   │ │ POST /sendDocument         │ │
│ │ ► 📤 Send Document             │ │                            │ │
│ │ ► 📊 Get Status                │ │ Send a document to         │ │
│ │ ► 📋 List Documents            │ │ recipients for signature.  │ │
│ │ ► ⬇️ Download Document         │ │                            │ │
│ │                                │ │ ## Authentication          │ │
│ │ 🎣 Webhooks                    │ │ Bearer YOUR_API_KEY        │ │
│ │ ► 🔗 Register Webhook          │ │                            │ │
│ │ ► 📋 List Webhooks             │ │ ## Rate Limiting           │ │
│ │ ► 🗑️ Delete Webhook           │ │ 1000 requests/hour         │ │
│ │                                │ │                            │ │
│ │ ⚙️ Configuration               │ │ ## Request                 │ │
│ │ ► 🔑 API Keys                  │ │ ```json                    │ │
│ │ ► 📊 Usage Analytics           │ │ {                          │ │
│ │ ► ⚠️ Error Codes               │ │   "documentUrl": "https:..",│ │
│ │                                │ │   "title": "Contract",     │ │
│ │ 💡 Examples                    │ │   "recipients": [          │ │
│ │ ► 🚀 Quick Start               │ │     {                      │ │
│ │ ► 🧪 Code Samples              │ │       "email": "user@..",  │ │
│ │ ► 🔄 Workflows                 │ │       "name": "John Doe"   │ │
│ │                                │ │     }                      │ │
│ └────────────────────────────────┘ │   ]                        │ │
│                                    │ }                          │ │
│                                    │ ```                        │ │
│                                    │ [📋 Copy] [🧪 Try]        │ │
│                                    │                            │ │
│                                    │ ## Response                │ │
│                                    │ ```json                    │ │
│                                    │ {                          │ │
│                                    │   "documentId": "doc_abc", │ │
│                                    │   "status": "sent",        │ │
│                                    │   "signingUrls": [         │ │
│                                    │     {                      │ │
│                                    │       "email": "user@..",  │ │
│                                    │       "url": "https://..." │ │
│                                    │     }                      │ │
│                                    │   ],                       │ │
│                                    │   "expires": "2024-02-15"  │ │
│                                    │ }                          │ │
│                                    │ ```                        │ │
│                                    │                            │ │
│                                    │ ## Code Examples           │ │
│                                    │ [cURL] [JavaScript] [Python]│ │
│                                    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Webhook Configuration Interface

```
┌─────────────────────────────────────────────────────────────────┐
│                      🎣 WEBHOOK CONFIGURATION                   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                   ADD NEW WEBHOOK                           │ │
│ │                                                             │ │
│ │ Webhook URL *                                               │ │
│ │ [https://your-app.com/webhook/seal                        ] │ │
│ │ ✅ URL must be HTTPS and publicly accessible               │ │
│ │                                                             │ │
│ │ Events to Subscribe *                                       │ │
│ │ ☑️ document.sent - Document sent to recipients             │ │
│ │ ☑️ document.viewed - Recipient viewed document             │ │
│ │ ☑️ document.signed - Recipient signed document             │ │
│ │ ☑️ document.completed - All signatures collected           │ │
│ │ ☑️ document.expired - Document expired without completion  │ │
│ │ ☐ document.declined - Recipient declined to sign           │ │
│ │                                                             │ │
│ │ Secret (Optional)                                           │ │
│ │ [Generate Secret] or [Enter Custom Secret]                 │ │
│ │ 💡 Used to verify webhook authenticity                     │ │
│ │                                                             │ │
│ │ [🎣 Create Webhook] [🧪 Test Connection]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    ACTIVE WEBHOOKS                          │ │
│ │                                                             │ │
│ │ ┌─ Production App Webhook ──────────────────────────────┐   │ │
│ │ │ 🎣 https://app.acme.com/webhook/seal                  │   │ │
│ │ │ Events: document.sent, document.completed             │   │ │
│ │ │ Status: 🟢 Active • Last delivery: 2 hours ago        │   │ │
│ │ │ Success rate: 99.2% (1,847/1,862 delivered)          │   │ │
│ │ │ [📊 View Logs] [✏️ Edit] [🗑️ Delete]                 │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ │ ┌─ Development Webhook ─────────────────────────────────┐   │ │
│ │ │ 🎣 https://ngrok.io/abc123/webhook                    │   │ │
│ │ │ Events: All events                                    │   │ │
│ │ │ Status: 🟡 Issues • Last delivery: Failed            │   │ │
│ │ │ Success rate: 45.2% (issues with connection)         │   │ │
│ │ │ [📊 View Logs] [✏️ Edit] [🗑️ Delete]                 │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Rate Limiting Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                      ⚡ RATE LIMITING STATUS                    │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                   CURRENT USAGE                             │ │
│ │                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │ │
│ │ │⚡ REQUESTS   │ │📊 LIMIT     │ │⏰ RESETS    │           │ │
│ │ │  THIS HOUR  │ │             │ │     IN      │           │ │
│ │ │             │ │             │ │             │           │ │
│ │ │    247      │ │   1,000     │ │  23 mins    │           │ │
│ │ │    /hour    │ │   /hour     │ │             │           │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘           │ │
│ │                                                             │ │
│ │ Usage: ████████▒▒▒▒▒▒▒▒▒▒▒▒ 24.7% of limit                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │ 📊 USAGE HISTORY     │  │     ⚠️ RATE LIMIT INFO           │ │
│ │                      │  │                                   │ │
│ │     ┌─┐              │  │ Current Plan: Pro                 │ │
│ │ 400─┤ ┌─┐            │  │ Rate Limit: 1,000 req/hour        │ │
│ │ 300─┤ │ │            │  │                                   │ │
│ │ 200─┤ │ │   ┌─┐      │  │ When limit exceeded:              │ │
│ │ 100─┤ │ │   │ │ ┌─┐  │  │ • HTTP 429 status returned       │ │
│ │   0─└─┴─┴───┴─┴─┴─┘  │  │ • X-RateLimit headers included   │ │
│ │   6h 5h 4h 3h 2h 1h  │  │ • Retry after window provided    │ │
│ │                      │  │                                   │ │
│ │ Peak usage: 387/hour │  │ Need higher limits?               │ │
│ │ Average: 156/hour    │  │ [💬 Contact Sales]                │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                  📋 RECENT RATE LIMIT EVENTS                │ │
│ │                                                             │ │
│ │ ⏰ Jan 15, 2:30 PM - Approaching limit (850/1000 requests)  │ │
│ │ ⚠️ Jan 14, 3:45 PM - Rate limit exceeded for 15 minutes    │ │
│ │ ✅ Jan 14, 4:00 PM - Rate limit window reset, normal ops   │ │
│ │                                                             │ │
│ │ [📊 View Full History] [⚙️ Configure Alerts]              │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Error Handling Interface

```
┌─────────────────────────────────────────────────────────────────┐
│                       ❌ API ERROR RESPONSE                     │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                     ERROR DETAILS                           │ │
│ │                                                             │ │
│ │ Status Code: 400 Bad Request                                │ │
│ │ Request ID: req_abc123def456                                │ │
│ │ Timestamp: 2024-01-15T10:30:00Z                            │ │
│ │                                                             │ │
│ │ Error Response:                                             │ │
│ │ ```json                                                     │ │
│ │ {                                                           │ │
│ │   "error": {                                                │ │
│ │     "code": "VALIDATION_ERROR",                             │ │
│ │     "message": "Request validation failed",                 │ │
│ │     "details": [                                            │ │
│ │       {                                                     │ │
│ │         "field": "recipients[0].email",                     │ │
│ │         "message": "Invalid email format",                  │ │
│ │         "received": "invalid-email"                         │ │
│ │       },                                                    │ │
│ │       {                                                     │ │
│ │         "field": "documentUrl",                             │ │
│ │         "message": "Document URL is required"               │ │
│ │       }                                                     │ │
│ │     ],                                                      │ │
│ │     "documentation": "https://docs.seal.com/errors#400"    │ │
│ │   }                                                         │ │
│ │ }                                                           │ │
│ │ ```                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    TROUBLESHOOTING                          │ │
│ │                                                             │ │
│ │ 🔧 How to fix this error:                                   │ │
│ │                                                             │ │
│ │ 1. ✅ Fix the email format:                                 │ │
│ │    Change "invalid-email" to "user@example.com"            │ │
│ │                                                             │ │
│ │ 2. ✅ Add the missing documentUrl:                          │ │
│ │    Include a valid HTTPS URL to your PDF document          │ │
│ │                                                             │ │
│ │ 3. 🧪 Test your fix:                                        │ │
│ │    Use the API playground to validate your request         │ │
│ │                                                             │ │
│ │ [📖 View Documentation] [🧪 Try in Playground]             │ │
│ │ [💬 Contact Support] [📋 Copy Error Details]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Security and Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                     🔒 API SECURITY STATUS                      │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                  AUTHENTICATION STATUS                      │ │
│ │                                                             │ │
│ │ API Key: seal_live_sk_abc123...                             │ │
│ │ Status: ✅ Valid and Active                                  │ │
│ │ Workspace: acme-corp                                        │ │
│ │ User: admin@acme.com                                        │ │
│ │ Permissions: Full API access                                │ │
│ │                                                             │ │
│ │ Last authenticated: 5 minutes ago                           │ │
│ │ Last used from: 192.168.1.100 (Your Office)               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │ 🛡️ SECURITY FEATURES │  │     ⚠️ SECURITY BEST PRACTICES   │ │
│ │                      │  │                                   │ │
│ │ ✅ HTTPS Required    │  │ 🔑 Store API keys securely       │ │
│ │ ✅ API Key Hashing   │  │    • Use environment variables   │ │
│ │ ✅ Request Signing   │  │    • Never commit to git         │ │
│ │ ✅ Rate Limiting     │  │                                   │ │
│ │ ✅ Workspace Scoping │  │ 🔄 Rotate keys regularly         │ │
│ │ ✅ RBAC Permissions  │  │    • Generate new keys monthly   │ │
│ │ ✅ Audit Logging     │  │    • Revoke unused keys          │ │
│ │                      │  │                                   │ │
│ │ [📊 Security Logs]   │  │ 📡 Monitor API usage              │ │
│ │ [🔍 Audit Trail]     │  │    • Watch for unusual patterns  │ │
│ │                      │  │    • Set up usage alerts         │ │
│ └──────────────────────┘  │                                   │ │
│                          │ [📖 Security Guide]               │ │
│                          └───────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    🚨 SECURITY ALERTS                       │ │
│ │                                                             │ │
│ │ ✅ No security issues detected                               │ │
│ │                                                             │ │
│ │ Recent activity:                                            │ │
│ │ • API key used from new IP: 203.0.113.45 (2 hours ago)    │ │
│ │ • High API usage detected (800+ requests in 1 hour)       │ │
│ │                                                             │ │
│ │ [⚙️ Configure Security Alerts] [📧 Email Notifications]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Mobile Responsive API Integration

```
┌─────────────────────┐
│ ☰ 🔗 API Integration│
└─────────────────────┘

┌─────────────────────┐
│   📊 API STATUS     │
│                     │
│ Requests: 247/1000  │
│ Success: 99.2%      │
│ Avg Response: 145ms │
│                     │
│ [📊 View Details]   │
└─────────────────────┘

┌─────────────────────┐
│   🎣 WEBHOOKS       │
│                     │
│ Production App      │
│ 🟢 Active           │
│ Success: 99.2%      │
│                     │
│ Development         │
│ 🟡 Issues           │
│ Success: 45.2%      │
│                     │
│ [➕ Add Webhook]    │
└─────────────────────┘

┌─────────────────────┐
│   📖 API DOCS       │
│                     │
│ • Send Document     │
│ • Get Status        │
│ • List Documents    │
│ • Webhooks          │
│                     │
│ [📖 Browse All]     │
└─────────────────────┘

┌─────────────────────┐
│   🧪 API PLAYGROUND │
│                     │
│ Test API calls      │
│ directly in browser │
│                     │
│ [🧪 Launch]         │
└─────────────────────┘
```