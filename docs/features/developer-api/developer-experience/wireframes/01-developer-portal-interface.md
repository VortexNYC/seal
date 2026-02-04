# Developer Experience - Developer Portal Interface Wireframe

## Developer Portal Landing Page

```
┌─────────────────────────────────────────────────────────────────┐
│ [🏠 Home] [📄 Docs] [🔑 API Keys] [📊 Usage] [🎯 Examples] [🧪 Test]│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    🚀 SEAL DEVELOPER PORTAL                     │
│                                                                 │
│           Send documents for signature in 2 lines of code      │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                     ⚡ QUICK START                          │ │
│ │                                                             │ │
│ │ curl -X POST https://api.seal.sh/documents/send \           │ │
│ │   -H "Authorization: Bearer YOUR_API_KEY" \                 │ │
│ │   -H "Content-Type: application/json" \                    │ │
│ │   -d '{                                                     │ │
│ │     "document": "https://example.com/contract.pdf",        │ │
│ │     "recipients": [{"email": "client@company.com"}]        │ │
│ │   }'                                                        │ │
│ │                                                             │ │
│ │ [📋 Copy Code] [🚀 Try it Live] [📖 Full Guide]            │ │
│ │                                                             │ │
│ │ Other examples: [JavaScript] [Python] [PHP] [Ruby]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │   🔑 GET API KEY     │  │        📖 DOCUMENTATION          │ │
│ │                      │  │                                   │ │
│ │ Generate your API    │  │ • Send Document API               │ │
│ │ key in one click     │  │ • Check Status API                │ │
│ │                      │  │ • Webhook Integration             │ │
│ │ [🔑 Generate Key]    │  │ • Authentication Guide            │ │
│ │                      │  │                                   │ │
│ │ 🔒 Requires Pro Plan │  │ [📖 Browse All Docs]             │ │
│ │ [⬆️ Upgrade Now]     │  │                                   │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │   🧪 API PLAYGROUND  │  │        💼 USE CASES              │ │
│ │                      │  │                                   │ │
│ │ Test API calls       │  │ • Contract Signing                │ │
│ │ directly in browser  │  │ • Employee Onboarding             │ │
│ │                      │  │ • Vendor Agreements               │ │
│ │ [🧪 Launch Playground] │  │ • Customer Approvals            │ │
│ │                      │  │                                   │ │
│ │ 🎯 No setup required │  │ [💡 See Examples]                │ │
│ │ [📊 View Examples]   │  │                                   │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## HTTP API Onboarding Flow

### Step 1: Get Your API Key

```
┌─────────────────────────────────────────────────────────────────┐
│                   🚀 GET STARTED IN 3 STEPS                    │
│                                                                 │
│ ┌─ STEP 1: GET API KEY ──────────────────────────────────────┐ │
│ │                                                             │ │
│ │ 1. Sign up for a Pro account                               │ │
│ │ 2. Go to Settings → API Keys                               │ │
│ │ 3. Click "Generate API Key"                                 │ │
│ │                                                             │ │
│ │ Your API key will look like:                                │ │
│ │ seal_live_sk_abc123def456ghi789...                          │ │
│ │                                                             │ │
│ │ [🔑 Get API Key] [▶️ Continue to Step 2]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🔒 Keep your API key secure - don't commit it to version control│
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Send Your First Document

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ STEP 2: SEND DOCUMENT ────────────────────────────────────┐ │
│ │                                                             │ │
│ │ Basic HTTP request to send a document:                      │ │
│ │                                                             │ │
│ │ POST https://api.seal.sh/documents/send                     │ │
│ │ Authorization: Bearer YOUR_API_KEY                          │ │
│ │ Content-Type: application/json                              │ │
│ │                                                             │ │
│ │ {                                                           │ │
│ │   "document": "https://example.com/contract.pdf",          │ │
│ │   "recipients": [                                           │ │
│ │     {                                                       │ │
│ │       "email": "client@company.com",                       │ │
│ │       "name": "John Doe"                                    │ │
│ │     }                                                       │ │
│ │   ]                                                         │ │
│ │ }                                                           │ │
│ │                                                             │ │
│ │ [📋 Copy Request] [🧪 Try Live] [▶️ Continue to Step 3]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Handle the Response

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ STEP 3: RESPONSE ─────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ Success response (200 OK):                                  │ │
│ │                                                             │ │
│ │ {                                                           │ │
│ │   "documentId": "doc_abc123",                              │ │
│ │   "status": "sent",                                         │ │
│ │   "signingUrl": "https://seal.sh/sign/abc123",             │ │
│ │   "expiresAt": "2024-02-15T10:30:00Z",                     │ │
│ │   "createdAt": "2024-01-15T10:30:00Z"                      │ │
│ │ }                                                           │ │
│ │                                                             │ │
│ │ The recipient gets an email with the signing URL.          │ │
│ │ Use the documentId to check status later.                  │ │
│ │                                                             │ │
│ │ [📋 Copy Response] [🔍 Check Status API] [✅ Complete]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🎉 That's it! Your document is on its way for signature        │
│ Next: [Check document status] [Set up webhooks] [Error codes]   │
└─────────────────────────────────────────────────────────────────┘
```

### Language Examples

#### JavaScript/Node.js

````
┌─────────────────────────────────────────────────────────────────┐
│                      🟡 JAVASCRIPT EXAMPLE                     │
│                                                                 │
│ ┌─ JAVASCRIPT/NODE.JS ────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ ```javascript                                               │ │
│ │ const response = await fetch('https://api.seal.sh/documents/send', {│
│ │   method: 'POST',                                           │ │
│ │   headers: {                                                │ │
│ │     'Authorization': 'Bearer ' + process.env.SEAL_API_KEY,  │ │
│ │     'Content-Type': 'application/json'                     │ │
│ │   },                                                        │ │
│ │   body: JSON.stringify({                                    │ │
│ │     document: 'https://example.com/contract.pdf',          │ │
│ │     recipients: [{                                          │ │
│ │       email: 'client@company.com',                         │ │
│ │       name: 'John Doe'                                      │ │
│ │     }]                                                      │ │
│ │   })                                                        │ │
│ │ });                                                         │ │
│ │                                                             │ │
│ │ const result = await response.json();                       │ │
│ │ console.log('Document sent:', result.documentId);           │ │
│ │ ```                                                         │ │
│ │                                                             │ │
│ │ [📋 Copy Code] [🔗 Full Example] [📚 JS Guide]            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
````

#### Python

````
┌─────────────────────────────────────────────────────────────────┐
│                        🐍 PYTHON EXAMPLE                       │
│                                                                 │
│ ┌─ PYTHON ───────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ ```python                                                   │ │
│ │ import requests                                             │ │
│ │ import os                                                   │ │
│ │                                                             │ │
│ │ response = requests.post(                                   │ │
│ │     'https://api.seal.sh/documents/send',                  │ │
│ │     headers={                                               │ │
│ │         'Authorization': f'Bearer {os.environ["SEAL_API_KEY"]}',│
│ │         'Content-Type': 'application/json'                 │ │
│ │     },                                                      │ │
│ │     json={                                                  │ │
│ │         'document': 'https://example.com/contract.pdf',    │ │
│ │         'recipients': [{                                    │ │
│ │             'email': 'client@company.com',                 │ │
│ │             'name': 'John Doe'                              │ │
│ │         }]                                                  │ │
│ │     }                                                       │ │
│ │ )                                                           │ │
│ │                                                             │ │
│ │ result = response.json()                                    │ │
│ │ print(f"Document sent: {result['documentId']}")             │ │
│ │ ```                                                         │ │
│ │                                                             │ │
│ │ [📋 Copy Code] [🔗 Full Example] [📚 Python Guide]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
````

## API Documentation Interface

````
┌─────────────────────────────────────────────────────────────────┐
│                      📖 API DOCUMENTATION                       │
│                                                                 │
│ ┌─ NAVIGATION ────────────────┐ ┌─ CONTENT ──────────────────────┐ │
│ │                             │ │                                │ │
│ │ 🚀 Quick Start              │ │ # Send Document API            │ │
│ │ 🔑 Authentication           │ │                                │ │
│ │ ► 📄 Documents API          │ │ Send a document to recipients  │ │
│ │   • Send Document           │ │ for electronic signature.      │ │
│ │   • Get Status              │ │                                │ │
│ │   • List Documents          │ │ ## Endpoint                    │ │
│ │ 🎣 Webhooks                 │ │ POST /documents/send           │ │
│ │ 📊 Rate Limits              │ │                                │ │
│ │ ❌ Error Codes              │ │ ## Request                     │ │
│ │ 💡 Examples                 │ │ ```json                        │ │
│ │   • cURL                    │ │ {                              │ │
│ │   • JavaScript              │ │   "document": "https://...",   │ │
│ │   • Python                  │ │   "recipients": [              │ │
│ │   • PHP                     │ │     {                          │ │
│ │                             │ │       "email": "user@co.com",  │ │
│ │ 🔖 Language Tabs            │ │       "name": "John Doe"       │ │
│ │ [cURL] [JavaScript] [Python]│ │     }                          │ │
│ │                             │ │   ]                            │ │
│ └─────────────────────────────┘ │ }                              │ │
│                                 │ ```                            │ │
│                                 │ [📋 Copy] [🧪 Try Live]       │ │
│                                 │                                │ │
│                                 │ ## Response                    │ │
│                                 │ ```json                        │ │
│                                 │ {                              │ │
│                                 │   "documentId": "doc_123",     │ │
│                                 │   "status": "sent",            │ │
│                                 │   "signingUrl": "https://...", │ │
│                                 │   "expiresAt": "2024-02-15",   │ │
│                                 │   "createdAt": "2024-01-15"    │ │
│                                 │ }                              │ │
│                                 │ ```                            │ │
│                                 │                                │ │
│                                 │ [▼ View Error Codes]           │ │
│                                 │ [▼ View All Parameters]        │ │
│                                 │ [▼ View Status Webhooks]       │ │
│                                 └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
````

## API Key Management Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                      🔑 API KEY MANAGEMENT                      │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                   CREATE NEW API KEY                        │ │
│ │                                                             │ │
│ │ Key Name: [Contract Integration     ] (Optional)            │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 🔒 Your new API key will have access to:               │ │ │
│ │ │ • Send documents for signature                          │ │ │
│ │ │ • Check document status                                 │ │ │
│ │ │ • List workspace documents                              │ │ │
│ │ │ • Configure webhooks                                    │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ [🔑 Generate API Key]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    ACTIVE API KEYS                          │ │
│ │                                                             │ │
│ │ ┌─ Contract Integration ─────────────────────────────────┐   │ │
│ │ │ 🔑 seal_live_sk_abc123...def789                       │   │ │
│ │ │ Created: Jan 15, 2024 • Last used: 2 hours ago       │   │ │
│ │ │ Usage: 1,247 requests this month                      │   │ │
│ │ │ [📊 View Usage] [📋 Copy Key] [🗑️ Revoke]            │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ │ ┌─ HR Onboarding ────────────────────────────────────────┐   │ │
│ │ │ 🔑 seal_live_sk_xyz456...ghi012                       │   │ │
│ │ │ Created: Dec 3, 2023 • Last used: Yesterday           │   │ │
│ │ │ Usage: 89 requests this month                         │   │ │
│ │ │ [📊 View Usage] [📋 Copy Key] [🗑️ Revoke]            │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ │ ┌─ Testing Key ──────────────────────────────────────────┐   │ │
│ │ │ 🔑 seal_test_sk_test123...test789                     │   │ │
│ │ │ Created: Jan 10, 2024 • Last used: Never              │   │ │
│ │ │ Usage: 0 requests this month                          │   │ │
│ │ │ [📊 View Usage] [📋 Copy Key] [🗑️ Revoke]            │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Playground Interface

````
┌─────────────────────────────────────────────────────────────────┐
│                       🧪 API PLAYGROUND                         │
│                                                                 │
│ ┌─ REQUEST BUILDER ──────────────┐ ┌─ RESPONSE VIEWER ───────────┐ │
│ │                                │ │                             │ │
│ │ Method: [POST ▼]               │ │ Status: 200 OK              │ │
│ │ Endpoint: /sendDocument        │ │ Time: 145ms                 │ │
│ │                                │ │                             │ │
│ │ 🔑 Authentication              │ │ Response Body:              │ │
│ │ API Key: [seal_live_sk_***]    │ │ ```json                     │ │
│ │ [🔑 Select Different Key]      │ │ {                           │ │
│ │                                │ │   "documentId": "doc_abc123",│ │
│ │ 📋 Request Body                │ │   "status": "sent",         │ │
│ │ ┌────────────────────────────┐ │ │   "signingUrls": [          │ │
│ │ │ {                          │ │ │     {                       │ │
│ │ │   "documentUrl": "https:// │ │ │       "email": "john@co...",│ │
│ │ │     example.com/doc.pdf",  │ │ │       "url": "https://..."  │ │
│ │ │   "recipients": [          │ │ │     }                       │ │
│ │ │     {                      │ │ │   ],                        │ │
│ │ │       "email": "john@co.., │ │ │   "expires": "2024-02-15",  │ │
│ │ │       "name": "John Doe"   │ │ │   "created": "2024-01-15"   │ │
│ │ │     }                      │ │ │ }                           │ │
│ │ │   ]                        │ │ │ ```                         │ │
│ │ │ }                          │ │ │                             │ │
│ │ └────────────────────────────┘ │ │ Response Headers:           │ │
│ │                                │ │ ```                         │ │
│ │ [🚀 Send Request]              │ │ X-RateLimit-Limit: 1000     │ │
│ │ [📋 Copy as cURL]              │ │ X-RateLimit-Remaining: 987  │ │
│ │ [📝 Save Example]              │ │ ```                         │ │
│ │                                │ │                             │ │
│ └────────────────────────────────┘ │ [📋 Copy Response]          │ │
│                                    └─────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │                    💡 EXAMPLE REQUESTS                      │   │
│ │                                                             │   │
│ │ [📄 Send Document] [📊 Get Status] [🎣 Setup Webhook]      │   │
│ │ [📋 List Docs] [⬇️ Download] [❌ Cancel Document]          │   │
│ └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
````

## API Usage Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                      📊 API USAGE ANALYTICS                     │
│                                                                 │
│ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 📅 Time Period                       │ │ 🔑 API Key Filter │ │
│ │ [This Month ▼] [Custom Range...]     │ │ [All Keys ▼]      │ │
│ │ Jan 1 - Jan 31, 2024                │ │                   │ │
│ └──────────────────────────────────────┘ └───────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    📈 USAGE OVERVIEW                        │ │
│ │                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │ │
│ │ │📡 REQUESTS  │ │✅ SUCCESS   │ │❌ ERRORS    │           │ │
│ │ │             │ │   RATE      │ │   RATE      │           │ │
│ │ │   1,247     │ │   99.2%     │ │   0.8%      │           │ │
│ │ │  +15% ↗️    │ │  +0.1% ↗️   │ │  -0.2% ↗️   │           │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘           │ │
│ │                                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │ │
│ │ │⏱️ AVG       │ │🚀 PEAK      │ │📊 RATE      │           │ │
│ │ │ RESPONSE    │ │ REQUESTS    │ │ LIMIT       │           │ │
│ │ │  145ms      │ │  23/hour    │ │  987/1000   │           │ │
│ │ │  -12ms ↗️   │ │ Yesterday   │ │  remaining  │           │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │ 📊 REQUEST TRENDS    │  │     🔗 ENDPOINT USAGE            │ │
│ │                      │  │                                   │ │
│ │     ┌─┐              │  │ POST /sendDocument    ████████ 65%│ │
│ │  60─┤ ┌─┐            │  │ GET /document/status  ████▒▒▒▒ 28%│ │
│ │  50─┤ │ │            │  │ GET /documents        ██▒▒▒▒▒▒ 5% │ │
│ │  40─┤ │ │   ┌─┐      │  │ POST /webhooks        █▒▒▒▒▒▒▒ 2% │ │
│ │  30─┤ │ │   │ │      │  │                                   │ │
│ │  20─┤ │ │   │ │ ┌─┐  │  │ Most Used: Send Document          │ │
│ │  10─┤ │ │   │ │ │ │  │  │ Avg Response Time: 145ms          │ │
│ │   0─└─┴─┴───┴─┴─┴─┘  │  │                                   │ │
│ │   W1 W2 W3 W4 W5     │  │ [View Detailed Breakdown]         │ │
│ │                      │  │                                   │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    🔑 API KEY BREAKDOWN                     │ │
│ │                                                             │ │
│ │ Contract Integration      ████████████████████ 1,089 req   │ │
│ │ HR Onboarding           ████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 89 req       │ │
│ │ Testing Key             ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 0 req        │ │
│ │                                                             │ │
│ │ [📊 Detailed Per-Key Analytics]                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Mobile Responsive Developer Portal

```
┌─────────────────────┐
│ ☰ 🚀 Dev Portal     │
└─────────────────────┘

┌─────────────────────┐
│   ⚡ QUICK START    │
│                     │
│ Send docs in 2 lines│
│                     │
│ curl -X POST https: │
│ //api.../sendDoc \  │
│   -H "Auth: ..." \  │
│   -d '{...}'        │
│                     │
│ [📋 Copy]           │
│ [🧪 Try Live]       │
└─────────────────────┘

┌─────────────────────┐
│   🔑 GET API KEY    │
│                     │
│ Generate your key   │
│ in one click        │
│                     │
│ [🔑 Generate Key]   │
│                     │
│ 🔒 Requires Pro     │
│ [⬆️ Upgrade Now]    │
└─────────────────────┘

┌─────────────────────┐
│   📖 DOCS           │
│                     │
│ • Send Document API │
│ • Check Status API  │
│ • Webhook Guide     │
│ • Authentication    │
│                     │
│ [📖 Browse Docs]    │
└─────────────────────┘

┌─────────────────────┐
│ 🧪 API PLAYGROUND   │
│                     │
│ Test APIs in        │
│ your browser        │
│                     │
│ [🧪 Launch]         │
└─────────────────────┘
```

## Error States and Loading

### Pro Plan Required State

```
┌─────────────────────────────────────┐
│         🚀 DEVELOPER PORTAL         │
│                                     │
│ 🔒 API Access Requires Pro Plan     │
│                                     │
│ Access to our Developer API is      │
│ available for Pro plan workspaces.  │
│                                     │
│ Pro Plan includes:                  │
│ • Unlimited API requests            │
│ • Webhook integrations              │
│ • Priority support                  │
│ • Advanced analytics                │
│                                     │
│ [⬆️ Upgrade to Pro] [💡 Learn More] │
└─────────────────────────────────────┘
```

### API Key Generation Success State

```
┌─────────────────────────────────────┐
│        🔑 API KEY GENERATED         │
│                                     │
│ ✅ Your API key has been created!   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ seal_live_sk_abc123def456ghi789 │ │
│ │ [📋 Copy to Clipboard]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ⚠️ Store this key securely - it     │
│    won't be shown again!            │
│                                     │
│ Next steps:                         │
│ • Add key to your app               │
│ • Test with API playground          │
│ • Read the documentation            │
│                                     │
│ [🧪 Test in Playground] [📖 Docs]   │
└─────────────────────────────────────┘
```
