# Workspace Creation Wireframes - All States

## Screen States & Wireframes

### 🏢 Workspace Name Setup

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║                         🏢 Create Your Workspace                            ║ [text-3xl font-bold text-center text-blue-600]
║                                                                             ║
║                    Let's set up your document signing workspace            ║ [text-lg text-center mb-6]
║                                                                             ║ [text-muted-foreground leading-relaxed]
║    Workspace Name                                                           ║ [text-sm font-medium mb-2]
║    ╭─[NAME INPUT: variant="elevated"]────────────────────────────────────────╮  ║
║    │ John's Workspace                                        ✅          │  ║ [Input: w-full p-3] [Badge: variant="success" absolute right-2]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║    💡 You can change this later in settings                                ║ [text-sm text-blue-600 mb-4]
║                                                                             ║
║    What's a workspace?                                                      ║ [text-base font-semibold mb-3]
║    • Your space for documents and signing                                  ║ [ul: space-y-2 text-sm]
║    • Collaborate with team members                                         ║ [li: text-muted-foreground]
║    • Manage permissions and settings                                       ║
║    • Join multiple workspaces later                                        ║
║                                                                             ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━ Continue ━━━━━━━━━━━━━━━━━━━━━━━━━┓              ║ [Button: variant="default" size="lg" w-full py-4 mb-4]
║                                                                             ║
║              ℹ️  You'll be the owner with full access                       ║ [text-sm text-muted-foreground text-center]
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 📋 Plan Selection

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║                         📋 Choose Your Plan                                 ║ [text-3xl font-bold text-center text-blue-600]
║                                                                             ║
║                   Select the plan that works best for you                  ║ [text-lg text-center mb-6]
║                                                                             ║ [text-muted-foreground]
║ ╭─[FREE PLAN CARD: variant="elevated"]───────────────╮ ╭─[PRO PLAN CARD: variant="elevated"]───────────────╮ ║
║ │                🆓 FREE              │ │             🚀 PRO TRIAL            │ ║ [Card: flex-1 p-6 space-y-4] [Card: flex-1 p-6 space-y-4]
║ │                                     │ │                                     │ ║ [text-2xl font-bold text-center mb-4]
║ │  Perfect for getting started        │ │  Perfect for teams & power users   │ ║ [text-sm text-center text-muted-foreground mb-4]
║ │                                     │ │                                     │ ║
║ │  ✅ 10 documents per month          │ │  ✅ Unlimited documents             │ ║ [text-sm space-y-2]
║ │  ✅ 1 user workspace                │ │  ✅ Unlimited team members          │ ║
║ │  ✅ All core signing features       │ │  ✅ Full API access                 │ ║
║ │  ✅ Unlimited storage               │ │  ✅ Advanced integrations           │ ║
║ │                                     │ │  ✅ Priority support                │ ║
║ │  🚫 No API access                   │ │                                     │ ║ [text-sm text-red-600]
║ │  🚫 No team members                 │ │  🎯 2 weeks free                    │ ║ [text-sm font-medium text-blue-600]
║ │                                     │ │  💰 Then $10/month per user        │ ║ [text-sm text-muted-foreground]
║ │  💰 Always free                     │ │                                     │ ║ [text-lg font-bold text-green-600]
║ │                                     │ │                                     │ ║
║ │ ┏━━━━━━━━━━━ Start Free ━━━━━━━━━━━┓ │ │ ┏━━━━━━━━━ Try Pro Free ━━━━━━━━━┓ │ ║ [Button: variant="outline" w-full py-3] [Button: variant="default" w-full py-3]
║ ╰─────────────────────────────────────╯ ╰─────────────────────────────────────╯ ║
║                                                                             ║
║              💡 You can upgrade or downgrade anytime                        ║ [Alert: bg-blue-50 border-blue-200 p-4 text-center]
║                                                                             ║ [text-blue-800 text-sm]
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Workspace Name Conflict

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║                         🏢 Create Your Workspace                            ║ [text-3xl font-bold text-center text-red-600]
║                                                                             ║
║    Workspace Name                                                           ║ [text-sm font-medium mb-2]
║    ╭─[ERROR INPUT: variant="destructive"]─────────────────────────────────╮  ║
║    │ Acme Corporation                                        ❌          │  ║ [Input: w-full p-3 border-red-300] [Badge: variant="destructive"]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║    ❌ This workspace name is already taken                                 ║ [text-sm text-red-600 font-medium mb-4]
║                                                                             ║
║    Suggested alternatives:                                                  ║ [text-base font-semibold mb-3]
║    ╭─[SUGGESTION CARD: variant="elevated"]────────────────────────────────╮  ║
║    │ Acme Corporation (2)                           ┏━━━ Use This Name ━━━┓ │  ║ [Card: p-3 flex justify-between items-center mb-2]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║ [Button: variant="outline" size="sm"]
║    ╭─[SUGGESTION CARD: variant="elevated"]────────────────────────────────╮  ║
║    │ John's Acme Workspace                          ┏━━━ Use This Name ━━━┓ │  ║ [Card: p-3 flex justify-between items-center mb-2]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║    ╭─[SUGGESTION CARD: variant="elevated"]────────────────────────────────╮  ║
║    │ Acme Team                                      ┏━━━ Use This Name ━━━┓ │  ║ [Card: p-3 flex justify-between items-center mb-4]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                             ║
║    Or choose a different name:                                             ║ [text-base font-semibold mb-2]
║    ╭─[CUSTOM INPUT: variant="elevated"]────────────────────────────────────╮  ║
║    │ Enter a different workspace name                                    │  ║ [Input: w-full p-3 placeholder:text-muted-foreground]
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                             ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━ Try Different Name ━━━━━━━━━━━━━━━━━━━━━━━┓          ║ [Button: variant="default" w-full py-3]
║                                                                             ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 🆓 Free Workspace Creation Complete

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║                       ✅ Free Workspace Created!                           ║ [text-3xl font-bold text-center text-green-600]
║                                                                             ║
║                            🏢 John's Workspace                              ║ [text-2xl font-semibold text-center text-blue-700]
║                          Owner: John Doe                                   ║ [text-base text-center text-muted-foreground]
║                         Plan: Free (10 docs/month)                         ║ [Badge: variant="secondary" mx-auto mb-6]
║                                                                             ║
║    Your free workspace is ready! Here's what you can do:                   ║ [text-lg font-semibold text-center mb-6]
║                                                                             ║
║    ┏━━━━━━━━━━━━━━━━━━━ 📄 Send Your First Document ━━━━━━━━━━━━━━━━━━━┓      ║ [Button: variant="default" size="lg" w-full py-4 mb-3]
║                                                                             ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━ 📋 Explore Templates ━━━━━━━━━━━━━━━━━━━━━━━┓       ║ [Button: variant="outline" size="lg" w-full py-4 mb-6]
║                                                                             ║
║                         ┏━━━ Go to Dashboard ━━━┓                           ║ [Button: variant="ghost"]
║                                                                             ║
║              🚀 Ready for more? Upgrade to Pro anytime!                    ║ [Alert: bg-blue-50 border-blue-200 p-4 text-center]
║                                                                             ║ [text-blue-800 text-sm]
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 💳 Pro Trial Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         🚀 Start Your Pro Trial                            │
│                                                                             │
│                    Unlock all features for "John's Workspace"              │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      2-Week Pro Trial                               │  │
│    │                                                                     │  │
│    │  🚀 Full access to all Pro features                                 │  │
│    │  📅 Trial starts immediately                                        │  │
│    │  💰 $10/month per user after trial ends                            │  │
│    │  🎯 Cancel anytime - revert to free plan                           │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Payment Information                                                      │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ 1234 5678 9012 3456                                                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────┐ ┌─────────────────────────────────────┐  │
│    │ MM / YY                     │ │ CVC                                 │  │
│    └─────────────────────────────┘ └─────────────────────────────────────┘  │
│                                                                             │
│    Billing Name                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ John Doe                                                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    Start Pro Trial                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              🔒 Secure billing powered by Polar                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Creating Workspace

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ⏳ Setting Up Your Workspace                         │
│                                                                             │
│                              Acme Corporation                              │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [███████████████████████████████░░░░░] 85%                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ✅ Workspace created                                │
│                         ✅ Owner permissions assigned                       │
│                         ✅ Billing configured                               │
│                         ⏳ Preparing dashboard...                           │
│                                                                             │
│                      This should take just a moment!                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🎉 Pro Trial Started Successfully

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       🚀 Pro Trial Started Successfully!                   │
│                                                                             │
│                            🏢 John's Workspace                              │
│                          Owner: John Doe                                   │
│                      📅 2-week Pro trial active                            │
│                                                                             │
│    Unlock the full power of Seal Pro:                                      │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              👥 Invite Unlimited Team Members                       │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              🔧 Set Up API Integration                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              📄 Send Unlimited Documents                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Go to Dashboard>                                  │
│                                                                             │
│              🎯 Explore all Pro features! Trial ends in 2 weeks.          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Workspace Creation Error

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     ❌ Workspace Creation Failed                             │
│                                                                             │
│              Something went wrong while creating your workspace.            │
│                        Please try again in a moment.                       │
│                                                                             │
│                            Acme Corporation                                │
│                                                                             │
│    Error Details:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  The Pro Trial setup failed - using Free plan instead.            │  │
│    │  Your payment information was declined.                           │  │
│    │                                                                     │  │
│    │  Error Code: PAYMENT_DECLINED                                       │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                     Try Different Payment Method                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                     Continue with Free Plan                       │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Contact Support>                                  │
│                                                                             │
│              If the problem persists, please contact support.              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 📊 Free Plan Usage Dashboard Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📊 Dashboard                          🏢 John's Workspace (Free)            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📈 Usage This Month                    🚀 Upgrade to Pro              │ │
│ │                                                                         │ │
│ │ Documents: 7/10 used                   ✅ Unlimited documents           │ │
│ │ [██████░░░░] 70%                      ✅ Team collaboration            │ │
│ │                                        ✅ Full API access               │ │
│ │ Team Members: 1/1 (limit reached)     ✅ Advanced integrations         │ │
│ │ [██████████] 100%                                                      │ │
│ │                                        💰 $10/month per user            │ │
│ │ Want to add teammates?                                                  │ │
│ │ [Upgrade to Pro]                       [Try Pro Free - 2 weeks]        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Recent Documents                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Employment_Agreement.pdf     │ Pending    │ 2 of 3 signed  │ 2 days ago │ │
│ │ NDA_Contract.pdf             │ Completed  │ 1 of 1 signed  │ 5 days ago │ │
│ │ Service_Agreement.pdf        │ Draft      │ Not sent       │ 1 week ago │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🚀 Pro Trial Usage Dashboard Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📊 Dashboard                    🏢 John's Workspace (Pro Trial - 12 days left) │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚀 You're experiencing Pro!          📅 Trial Status                    │ │
│ │                                                                         │ │
│ │ This Month:                           ⏰ 12 days remaining               │ │
│ │ ✅ 23 documents sent (unlimited)      💰 $10/month per user after trial │ │
│ │ ✅ 4 team members active                                                 │ │
│ │ ✅ API integration configured         Love what you see?                 │ │
│ │                                                                         │ │
│ │ See the difference Pro makes:         [Keep Pro - Add Payment]          │ │
│ │ • 2.3x more docs sent                [Continue with Free Plan]          │ │
│ │ • Team collaboration active                                             │ │
│ │ • API calls this week: 156                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Recent Documents (Showing power of Pro)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Team_Contract_A.pdf          │ Completed  │ 3 of 3 signed  │ 1 day ago  │ │
│ │ Client_Agreement_B.pdf       │ Pending    │ 1 of 2 signed  │ 2 days ago │ │
│ │ API_Generated_Doc.pdf        │ Completed  │ 1 of 1 signed  │ 3 days ago │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Plan Selection

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
╠═══════════════════════════╣
║                           ║
║ 📋 Choose Your Plan       ║ [text-xl font-bold text-center text-blue-600]
║                           ║
║ ╭─[FREE PLAN CARD]─────╮   ║ [Card: p-4 space-y-3 bg-white border]
║ │       🆓 FREE         │   ║ [text-lg font-bold text-center]
║ │                       │   ║
║ │ Perfect for getting   │   ║ [text-sm text-center text-muted-foreground]
║ │ started               │   ║
║ │                       │   ║
║ │ ✅ 10 docs/month      │   ║ [text-xs space-y-1]
║ │ ✅ 1 user workspace   │   ║
║ │ ✅ Core features      │   ║
║ │ 🚫 No API access      │   ║ [text-xs text-red-600]
║ │ 🚫 No team members    │   ║
║ │                       │   ║
║ │ 💰 Always free        │   ║ [text-sm font-bold text-green-600]
║ │                       │   ║
║ │ ┏━━━ Start Free ━━━┓   │   ║ [Button: variant="outline" w-full py-2]
║ ╰───────────────────────╯   ║
║                           ║
║ ╭─[PRO PLAN CARD]──────╮   ║ [Card: p-4 space-y-3 bg-blue-50 border-blue-200]
║ │    🚀 PRO TRIAL       │   ║ [text-lg font-bold text-center text-blue-700]
║ │                       │   ║
║ │ Perfect for teams     │   ║ [text-sm text-center text-muted-foreground]
║ │ & power users         │   ║
║ │                       │   ║
║ │ ✅ Unlimited docs     │   ║ [text-xs space-y-1]
║ │ ✅ Unlimited users    │   ║
║ │ ✅ Full API access    │   ║
║ │ ✅ Priority support   │   ║
║ │                       │   ║
║ │ 🎯 2 weeks free       │   ║ [text-sm font-medium text-blue-600]
║ │ 💰 $10/mo per user    │   ║ [text-sm text-muted-foreground]
║ │                       │   ║
║ │ ┏━━━ Try Pro Free ━━━┓ │   ║ [Button: variant="default" w-full py-2]
║ ╰───────────────────────╯   ║
║                           ║
║ 💡 Change anytime         ║ [text-xs text-center text-muted-foreground]
║                           ║
╚═══════════════════════════╝
```

### 📱 Mobile Workspace Creation

```
┌─────────────────────────┐
│    [LOGO] Seal      │
├─────────────────────────┤
│                         │
│ 🏢 Create Workspace     │
│                         │
│ Every user needs a      │
│ workspace to start      │
│                         │
│ Workspace Name          │
│ ┌─────────────────────┐ │
│ │ John's Workspace ✅ │ │
│ └─────────────────────┘ │
│ 💡 Change later         │
│                         │
│ What's a workspace?     │
│ • Personal doc space    │
│ • Invite team members   │
│ • Manage billing        │
│ • Join multiple later   │
│                         │
│ ┌─────────────────────┐ │
│ │ Create Workspace    │ │
│ └─────────────────────┘ │
│                         │
│ ℹ️ You'll be the owner   │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Billing Setup

```
┌─────────────────────────┐
│    [LOGO] Seal      │
├─────────────────────────┤
│                         │
│ 💳 Billing Required     │
│                         │
│ Setup for "Acme Corp"   │
│                         │
│ ┌─────────────────────┐ │
│ │ 14-Day Free Trial   │ │
│ │                     │ │
│ │ 🚀 Full access      │ │
│ │ 💳 Card required    │ │
│ │ 📅 Starts now       │ │
│ │ 💰 $10/mo per seat  │ │
│ └─────────────────────┘ │
│                         │
│ Credit Card             │
│ ┌─────────────────────┐ │
│ │ 1234 5678 9012 3456 │ │
│ └─────────────────────┘ │
│                         │
│ ┌──────────┐┌─────────┐ │
│ │ MM / YY  ││   CVC   │ │
│ └──────────┘└─────────┘ │
│                         │
│ Billing Name            │
│ ┌─────────────────────┐ │
│ │ John Doe            │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │Create & Start Trial │ │
│ └─────────────────────┘ │
│                         │
│ 🔒 Secure via Polar     │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Workspace Name Validation
- **Real-time Validation**: Check name availability as user types
- **Character Limits**: 3-50 characters, most Unicode characters allowed
- **Duplicate Handling**: Auto-suggest alternatives when conflicts occur
- **URL Sanitization**: Convert to URL-safe format for workspace routing

### Billing Integration
- **Polar Integration**: Plan-based payment processing (Pro Trial only)
- **Free Plan**: No payment collection required
- **Pro Trial Management**: Automatic 2-week trial activation with payment info
- **Error Handling**: Clear payment error messages with Free plan fallback
- **Security**: PCI-compliant payment processing for Pro plans

### Better Auth Integration
- **Organization Creation**: Uses Better Auth Organization plugin
- **Owner Role Assignment**: Automatic owner role via RBAC plugin
- **Permission Setup**: Immediate full workspace permissions
- **Multi-workspace Support**: Prepares for future workspace membership

### Progressive Enhancement
- **Mobile Optimization**: Touch-friendly interface for mobile devices
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Complete accessibility compliance
- **Offline Handling**: Graceful degradation when network unavailable

---

## Technical Integration

### Better Auth Organization Plugin
- **Workspace Creation**: Uses createOrganization API
- **Owner Assignment**: Automatic role assignment via RBAC
- **Member Management**: Prepares invitation infrastructure
- **Multi-workspace Support**: User can belong to multiple organizations

### Polar Billing Integration
- **Subscription Creation**: Per-workspace subscription model (Pro plans only)
- **Free Plan**: No payment processing required
- **Pro Trial Processing**: Secure payment info collection and storage
- **Trial Management**: 2-week trial with automatic conversion
- **Seat-based Pricing**: $10/month per member pricing model (Pro only)

### Convex Real-time Integration
- **Workspace Data**: Real-time workspace information storage
- **User Context**: Current workspace context management
- **Permission Updates**: Live permission and role updates
- **State Consistency**: Automatic data synchronization

### React Integration
- **Form Management**: Advanced form validation and state handling
- **Error Handling**: User-friendly error messages and recovery
- **Loading States**: Smooth progress indication during creation
- **Responsive Design**: Mobile-first, progressively enhanced interface