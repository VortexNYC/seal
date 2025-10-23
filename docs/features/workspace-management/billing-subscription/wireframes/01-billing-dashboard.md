# Billing & Subscription Management Wireframes - All States

## Screen States & Wireframes

### 💳 Free Plan Dashboard

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         💳 Billing & Subscription                           ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    Current Plan                                                               ║ [text-xl font-semibold mb-4]
║    ╭─[FREE PLAN CARD: variant="elevated"]──────────────────────────────────╮  ║
║    │                        🆓 FREE PLAN                                     │  ║ [Card: p-6 space-y-4 bg-gradient-to-br from-gray-50 to-gray-100]
║    │                                                                         │  ║ [text-2xl font-bold text-center text-gray-700 mb-4]
║    │  Usage This Month                                                       │  ║ [text-lg font-semibold mb-3]
║    │  ████████░░ 8 of 10 documents used                                      │  ║ [Progress: value={80} className="w-full h-2 mb-2"]
║    │  ⚠️  Only 2 documents remaining                                          │  ║ [text-sm text-orange-600 font-medium mb-4]
║    │                                                                         │  ║
║    │  Features                                                               │  ║ [text-lg font-semibold mb-3]
║    │  ✅ 10 documents per month                                              │  ║ [ul: space-y-2 text-sm]
║    │  ✅ 1 user workspace                                                    │  ║ [li: flex items-center space-x-2]
║    │  ✅ All core signing features                                           │  ║ [li: text-green-600 font-medium]
║    │  🚫 No team members                                                     │  ║ [li: text-gray-500]
║    │  🚫 No API access                                                       │  ║
║    │                                                                         │  ║
║    │  ┏━━━━━━━━━━━━━━━━ 🚀 Upgrade to Pro ━━━━━━━━━━━━━━━━┓                │  ║ [Button: variant="default" size="lg" w-full]
║    │                                                                         │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Usage History                                                              ║ [text-xl font-semibold mb-4]
║    ╭─[USAGE HISTORY TABLE: variant="elevated"]────────────────────────────╮  ║
║    │ January 2024    8/10 documents   ████████░░                            │  ║ [Table: className="w-full"]
║    │ December 2023   10/10 documents  ██████████                            │  ║ [tr: even:bg-gray-50]
║    │ November 2023   6/10 documents   ██████░░░░                            │  ║ [td: text-sm py-2 px-3]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║ [Progress: inline progress indicators]
║                                                                               ║
║    ℹ️  Next month's usage resets on February 15, 2024                         ║ [text-sm text-muted-foreground text-center mt-6]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🚀 Pro Plan Dashboard

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         💳 Billing & Subscription                           ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    Current Plan                                                               ║ [text-xl font-semibold mb-4]
║    ╭─[PRO PLAN CARD: variant="elevated"]───────────────────────────────────╮  ║
║    │                        🚀 PRO PLAN                                      │  ║ [Card: p-6 space-y-4 bg-gradient-to-br from-blue-50 to-indigo-100]
║    │                                                                         │  ║ [text-2xl font-bold text-center text-blue-700 mb-4]
║    │  Billing                                                                │  ║ [text-lg font-semibold mb-3]
║    │  💰 $30/month for 3 users                                              │  ║ [text-base font-medium mb-1]
║    │  📅 Next billing: March 15, 2024                                       │  ║ [text-sm text-muted-foreground mb-4]
║    │                                                                         │  ║
║    │  Current Usage                                                          │  ║ [text-lg font-semibold mb-3]
║    │  📄 47 documents this month                                             │  ║ [text-base font-medium mb-1]
║    │  👥 3 active team members                                               │  ║ [text-base font-medium mb-4]
║    │                                                                         │  ║
║    │  Features                                                               │  ║ [text-lg font-semibold mb-3]
║    │  ✅ Unlimited documents                                                 │  ║ [ul: space-y-2 text-sm]
║    │  ✅ Unlimited team members                                              │  ║ [li: flex items-center space-x-2]
║    │  ✅ Full API access                                                     │  ║ [li: text-green-600 font-medium]
║    │  ✅ Advanced integrations                                               │  ║
║    │  ✅ Priority support                                                    │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Payment Method                                                             ║ [text-xl font-semibold mb-4]
║    ╭─[PAYMENT METHOD CARD: variant="elevated"]─────────────────────────────╮  ║
║    │  💳 **** **** **** 4242                                                │  ║ [Card: p-4 flex justify-between items-center]
║    │  Expires 12/26                      ┏━━━ Edit ━━━┓ ┏━━━ Remove ━━━┓   │  ║ [text-sm text-muted-foreground] [Button: variant="outline" size="sm"]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Recent Invoices                                                            ║ [text-xl font-semibold mb-4]
║    ╭─[INVOICES TABLE: variant="elevated"]────────────────────────────────────╮  ║
║    │  February 2024     $30.00     Paid ✅           ┏━ Download PDF ━┓     │  ║ [Table: className="w-full"]
║    │  January 2024      $20.00     Paid ✅           ┏━ Download PDF ━┓     │  ║ [tr: even:bg-gray-50]
║    │  December 2023     $10.00     Paid ✅           ┏━ Download PDF ━┓     │  ║ [td: text-sm py-3 px-4] [Button: variant="ghost" size="sm"]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    ┏━━━ View All Invoices ━━━┓ ┏━━ Manage Payment Methods ━━┓ ┏━ Download All ━┓ ║ [flex justify-center space-x-3 mb-6]
║                                                                               ║ [Button: variant="outline"]
║                            ┏━━━━━━ Downgrade to Free ━━━━━━┓                  ║ [Button: variant="ghost" text-red-600]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔥 Pro Trial Dashboard

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         💳 Billing & Subscription                           ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    Current Plan                                                               ║ [text-xl font-semibold mb-4]
║    ╭─[PRO TRIAL CARD: variant="elevated"]──────────────────────────────────╮  ║
║    │                        🔥 PRO TRIAL                                     │  ║ [Card: p-6 space-y-4 bg-gradient-to-br from-orange-50 to-amber-100]
║    │                                                                         │  ║ [text-2xl font-bold text-center text-orange-700 mb-4]
║    │  ⏰ 8 days remaining in your free trial                                │  ║ [Alert: variant="default" mb-4]
║    │  💰 $10/month per user after trial ends                               │  ║ [text-base font-medium mb-4]
║    │                                                                         │  ║
║    │  Current Usage                                                          │  ║ [text-lg font-semibold mb-3]
║    │  📄 15 documents created (unlimited)                                   │  ║ [text-base font-medium mb-1]
║    │  👥 1 active user                                                      │  ║ [text-base font-medium mb-4]
║    │                                                                         │  ║
║    │  Trial Features                                                         │  ║ [text-lg font-semibold mb-3]
║    │  ✅ Unlimited documents                                                 │  ║ [ul: space-y-2 text-sm]
║    │  ✅ Unlimited team members                                              │  ║ [li: flex items-center space-x-2]
║    │  ✅ Full API access                                                     │  ║ [li: text-green-600 font-medium]
║    │  ✅ Advanced integrations                                               │  ║
║    │  ✅ Priority support                                                    │  ║
║    │                                                                         │  ║
║    │  ┏━━━━━━━━━━━━━━ ⚡ Add Payment Method to Continue ━━━━━━━━━━━━━━┓      │  ║ [Button: variant="default" size="lg" w-full]
║    │                                                                         │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Payment Method                                                             ║ [text-xl font-semibold mb-4]
║    ╭─[PAYMENT WARNING CARD: variant="elevated"]────────────────────────────╮  ║
║    │  ⚠️  No payment method added                                            │  ║ [Card: p-6 bg-yellow-50 border-yellow-200]
║    │  Add a payment method to continue Pro features after trial             │  ║ [Alert: variant="destructive" mb-4]
║    │                                                                         │  ║ [text-sm text-yellow-700 mb-4]
║    │  ┏━━━━━━━━━━━━━━━━━━ 💳 Add Payment Method ━━━━━━━━━━━━━━━━━━┓          │  ║ [Button: variant="default" size="lg" w-full]
║    │                                                                         │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    ℹ️  Trial ends on March 8, 2024. Add payment to continue Pro features      ║ [text-sm text-muted-foreground text-center mt-6]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 💳 Payment Method Management

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         💳 Payment Methods                                    ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    Current Payment Methods                                                    ║ [text-xl font-semibold mb-4]
║    ╭─[PRIMARY CARD: variant="elevated"]─────────────────────────────────────╮  ║
║    │  💳 Visa ending in 4242                         ▓▓▓ PRIMARY ▓▓▓         │  ║ [Card: p-4 border-blue-200 bg-blue-50]
║    │  Expires 12/2026                        ┏━━━ Edit ━━━┓ ┏━━━ Remove ━━━┓  │  ║ [text-sm text-muted-foreground mb-1]
║    │  Added January 15, 2024                                                 │  ║ [Badge: variant="secondary"] [Button: variant="outline" size="sm"]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║ [text-xs text-muted-foreground]
║                                                                               ║
║    ╭─[SECONDARY CARD: variant="elevated"]───────────────────────────────────╮  ║
║    │  💳 Mastercard ending in 8888                                           │  ║ [Card: p-4]
║    │  Expires 08/2025              ┏━ Set Primary ━┓ ┏━━ Edit ━━┓ ┏━ Remove ━┓ │  ║ [text-sm text-muted-foreground mb-1]
║    │  Added December 3, 2023                                                 │  ║ [Button: variant="ghost" size="sm"]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║ [text-xs text-muted-foreground]
║                                                                               ║
║    Add New Payment Method                                                     ║ [text-xl font-semibold mb-4]
║    ╭─[ADD PAYMENT FORM: variant="elevated"]─────────────────────────────────╮  ║
║    │                                                                         │  ║ [Card: p-6 space-y-4]
║    │  Card Number                                                            │  ║ [Label: text-sm font-medium mb-2]
║    │  ╭─────────────────────────────────────────────────────────────────╮    │  ║
║    │  │ 1234 5678 9012 3456                                       ✅      │    │  ║ [Input: className="w-full" validation state]
║    │  ╰─────────────────────────────────────────────────────────────────╯    │  ║
║    │                                                                         │  ║
║    │  Expiry Date          CVC                                               │  ║ [grid grid-cols-2 gap-4]
║    │  ╭─────────────╮    ╭─────────╮                                         │  ║
║    │  │ MM/YY   ✅  │    │ 123 ✅  │                                         │  ║ [Input: size="sm" validation state]
║    │  ╰─────────────╯    ╰─────────╯                                         │  ║
║    │                                                                         │  ║
║    │  Cardholder Name                                                        │  ║ [Label: text-sm font-medium mb-2]
║    │  ╭─────────────────────────────────────────────────────────────────╮    │  ║
║    │  │ John Doe                                                   ✅      │    │  ║ [Input: className="w-full" validation state]
║    │  ╰─────────────────────────────────────────────────────────────────╯    │  ║
║    │                                                                         │  ║
║    │  ┏━━━━━━━━━━━━━━━━━━━ 💳 Add Payment Method ━━━━━━━━━━━━━━━━━━━┓         │  ║ [Button: variant="default" size="lg" w-full]
║    │                                                                         │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━ < Back to Billing ━━━━━━━━━━━━━━━━━┓                     ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Payment Failed State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         💳 Billing & Subscription                           ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    ❌ Payment Failed                                                           ║ [text-xl font-semibold text-red-600 mb-4]
║    ╭─[PAYMENT FAILED ALERT: variant="destructive"]─────────────────────────╮  ║
║    │                        🚨 PAYMENT FAILED                                │  ║ [Alert: variant="destructive" p-6 space-y-4]
║    │                                                                         │  ║ [text-2xl font-bold text-center text-red-700 mb-4]
║    │  Your payment of $30.00 failed on March 15, 2024                      │  ║ [text-lg font-semibold mb-2]
║    │                                                                         │  ║
║    │  Reason: Credit card was declined                                       │  ║ [text-base text-red-600 mb-4]
║    │                                                                         │  ║
║    │  ⏰ Grace Period: 26 days remaining                                     │  ║ [Alert: variant="default" mb-2]
║    │  Your Pro features remain active until April 14, 2024                  │  ║ [text-sm text-muted-foreground mb-4]
║    │                                                                         │  ║
║    │  ┏━━━━━━━━━━━━━━━━ 🔄 Update Payment Method ━━━━━━━━━━━━━━━━┓            │  ║ [Button: variant="default" size="lg" w-full mb-3]
║    │                                                                         │  ║
║    │  ┏━━━━━━━━━━━━━━━━━━━━━ 💰 Retry Payment ━━━━━━━━━━━━━━━━━━━━━┓            │  ║ [Button: variant="destructive" size="lg" w-full]
║    │                                                                         │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Current Payment Method                                                     ║ [text-xl font-semibold mb-4]
║    ╭─[DECLINED CARD: variant="elevated"]────────────────────────────────────╮  ║
║    │  💳 **** **** **** 4242 (DECLINED)                                     │  ║ [Card: p-4 bg-red-50 border-red-200]
║    │  Expires 12/26                        ┏━━━ Update ━━━┓ ┏━━━ Remove ━━━┓ │  ║ [text-red-700 font-medium mb-1]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║ [Button: variant="outline" size="sm"]
║                                                                               ║
║    Recent Invoices                                                            ║ [text-xl font-semibold mb-4]
║    ╭─[INVOICES TABLE: variant="elevated"]────────────────────────────────────╮  ║
║    │  March 2024        $30.00     Failed ❌          ┏━ Retry Payment ━┓   │  ║ [Table: className="w-full"]
║    │  February 2024     $30.00     Paid ✅            ┏━ Download PDF ━┓    │  ║ [tr: even:bg-gray-50]
║    │  January 2024      $20.00     Paid ✅            ┏━ Download PDF ━┓    │  ║ [td: text-sm py-3 px-4] [Button: variant="ghost" size="sm"]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    📧 We've emailed you instructions at john@company.com                     ║ [text-sm text-muted-foreground text-center mt-6]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 📊 Billing History

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         📊 Billing History                                    ║ [text-2xl font-bold text-center mb-6]
║                                                                               ║
║    Invoice History                            ┏━━━━━ Download All PDFs ━━━━━┓   ║ [text-xl font-semibold mb-4] [Button: variant="outline"]
║    ╭─[INVOICE HISTORY TABLE: variant="elevated"]───────────────────────────╮  ║
║    │ Date          Amount    Status      Description        Actions         │  ║ [Table: className="w-full"]
║    ├─────────────────────────────────────────────────────────────────────────┤  ║ [thead: bg-gray-50]
║    │ Mar 15, 2024  $30.00    Failed ❌  Pro Plan (3 users)   ┏━━━ Retry ━━━┓ │  ║ [tr: even:bg-gray-50]
║    │ Feb 15, 2024  $30.00    Paid ✅    Pro Plan (3 users)   ┏━ Download ━┓  │  ║ [td: text-sm py-3 px-4]
║    │ Jan 15, 2024  $20.00    Paid ✅    Pro Plan (2 users)   ┏━ Download ━┓  │  ║ [Button: variant="ghost" size="sm"]
║    │ Dec 15, 2023  $10.00    Paid ✅    Pro Plan (1 user)    ┏━ Download ━┓  │  ║
║    │ Nov 15, 2023  $0.00     Free ✅    Trial started        -             │  ║
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Payment Summary                                                            ║ [text-xl font-semibold mb-4]
║    ╭─[PAYMENT SUMMARY CARD: variant="elevated"]─────────────────────────────╮  ║
║    │  Total Paid in 2024                                     $60.00          │  ║ [Card: p-6 space-y-3]
║    │  Total Paid in 2023                                     $10.00          │  ║ [flex justify-between items-center]
║    │  Outstanding Balance                                     $30.00          │  ║ [text-base font-medium]
║    │  Next Payment Due                                   April 14, 2024       │  ║ [text-red-600 font-bold]
║    ╰─────────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║ ┏━━ < Back to Billing ━━┓ ┏━━━ Export All Data ━━━┓ ┏━ Contact Billing Support ━┓ ║ [flex justify-center space-x-3]
║                                                                               ║ [Button: variant="ghost"] [Button: variant="outline"]
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 📱 Mobile - Free Plan

```
╔═════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓   ║ [Logo: h-8 mobile variant]
║       Alternative       ║
╠═════════════════════════╣
║                         ║
║   💳 Billing            ║ [text-lg font-bold text-center mb-4]
║                         ║
║ ╭─[FREE PLAN CARD]───╮ ║
║ │     🆓 FREE PLAN    │ ║ [Card: p-3 bg-gray-50]
║ │                     │ ║ [text-base font-bold text-center mb-2]
║ │ Usage: 8/10 docs    │ ║ [text-sm mb-1]
║ │ ████████░░          │ ║ [Progress: h-2 mb-2]
║ │ ⚠️ 2 remaining      │ ║ [text-xs text-orange-600 mb-3]
║ │                     │ ║
║ │ ┏━ 🚀 Upgrade to Pro ━┓ ║ [Button: variant="default" size="sm" w-full]
║ ╰─────────────────────╯ ║
║                         ║
║ Usage History           ║ [text-sm font-semibold mb-2]
║ ╭─[USAGE HISTORY]────╮ ║
║ │ Jan '24   8/10 docs │ ║ [Card: p-2 text-xs space-y-1]
║ │ Dec '23  10/10 docs │ ║
║ │ Nov '23   6/10 docs │ ║
║ ╰─────────────────────╯ ║
║                         ║
║ Next reset: Feb 15      ║ [text-xs text-muted-foreground text-center]
║                         ║
╚═════════════════════════╝
```

### 📱 Mobile - Pro Plan

```
╔═════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓   ║ [Logo: h-8 mobile variant]
║       Alternative       ║
╠═════════════════════════╣
║                         ║
║   💳 Billing            ║ [text-lg font-bold text-center mb-4]
║                         ║
║ ╭─[PRO PLAN CARD]────╮ ║
║ │     🚀 PRO PLAN     │ ║ [Card: p-3 bg-blue-50]
║ │                     │ ║ [text-base font-bold text-center mb-2]
║ │ $30/month (3 users) │ ║ [text-sm font-medium mb-1]
║ │ Next: Mar 15, 2024  │ ║ [text-xs text-muted-foreground mb-2]
║ │                     │ ║
║ │ 47 docs this month  │ ║ [text-sm mb-1]
║ │ 3 team members      │ ║ [text-sm]
║ ╰─────────────────────╯ ║
║                         ║
║ Payment Method          ║ [text-sm font-semibold mb-2]
║ ╭─[PAYMENT CARD]─────╮ ║
║ │ **** 4242           │ ║ [Card: p-2 text-xs]
║ │ Exp 12/26  ┏━ Edit ━┓ ║ [Button: variant="outline" size="xs"]
║ ╰─────────────────────╯ ║
║                         ║
║ Recent Invoices         ║ [text-sm font-semibold mb-2]
║ ╭─[INVOICES CARD]────╮ ║
║ │ Feb $30 ✅ ┏━ PDF ━┓ ║ [Card: p-2 text-xs space-y-1]
║ │ Jan $20 ✅ ┏━ PDF ━┓ ║ [Button: variant="ghost" size="xs"]
║ │ Dec $10 ✅ ┏━ PDF ━┓ ║
║ ╰─────────────────────╯ ║
║                         ║
║ ┏━━ All Invoices ━━━┓    ║ [Button: variant="outline" size="sm" w-full mb-2]
║ ┏━ Downgrade to Free ━┓  ║ [Button: variant="ghost" size="sm" w-full text-red-600]
║                         ║
╚═════════════════════════╝
```

---

## Interactive Elements

### Billing Dashboard Actions
- **Upgrade Button**: Leads to payment method setup flow
- **Usage Bars**: Visual progress indicators with hover tooltips
- **Payment Method Links**: Quick access to edit/remove cards
- **Invoice Downloads**: Direct PDF download links

### Payment Method Management
- **Real-time Validation**: Card number, expiry, CVC validation
- **Primary Method Toggle**: Set/unset primary payment method
- **Remove Confirmation**: Two-step confirmation for removal

### Error States
- **Payment Failures**: Clear error messages with recovery actions
- **Grace Period**: Countdown timer with clear consequences
- **Retry Mechanisms**: Automatic and manual retry options

---

## State Management

### Plan Transitions
- **Free to Pro**: Immediate upgrade with prorated billing
- **Pro to Free**: Scheduled downgrade at billing cycle end
- **Trial to Pro**: Seamless transition with payment method

---

## Confirmation Dialogs

### Cancel Subscription Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ⚠️ Cancel Pro Subscription                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│               Are you sure you want to cancel your subscription?            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ **What will happen:**                                                   │ │
│ │ • Your Pro features remain active until March 15, 2024                 │ │
│ │ • After that, you'll be moved to the Free plan                        │ │
│ │ • You'll lose access to unlimited documents and team features          │ │
│ │ • All existing documents will remain accessible                        │ │
│ │                                                                         │ │
│ │ **Your current Pro features:**                                          │ │
│ │ ✅ 247 documents this month                                             │ │
│ │ ✅ 4 active team members                                                │ │
│ │ ✅ API access (523 calls this month)                                    │ │
│ │ ✅ Analytics dashboard                                                   │ │
│ │                                                                         │ │
│ │ **Free plan limits you'll return to:**                                 │ │
│ │ • 10 documents per month                                                │ │
│ │ • 1 user only                                                           │ │
│ │ • No API access                                                         │ │
│ │                                                                         │ │
│ │ You can reactivate Pro anytime                                         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Keep Pro Plan]                               [Cancel Subscription]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Delete Payment Method Confirmation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🗑️ Remove Payment Method                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│         Are you sure you want to remove this payment method?               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ **Payment method:** •••• •••• •••• 1234 (Expires 12/26)               │ │
│ │                                                                         │ │
│ │ ⚠️ **Warning:** This is your primary payment method                     │ │
│ │                                                                         │ │
│ │ **What will happen:**                                                   │ │
│ │ • Your next billing attempt will fail                                   │ │
│ │ • Pro features may be suspended                                         │ │
│ │ • You'll need to add a new payment method                              │ │
│ │                                                                         │ │
│ │ **Recommendation:** Add a backup payment method first                   │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Cancel]  [+ Add Backup First]  [🗑️ Remove Payment Method]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Usage Tracking
- **Real-time Updates**: Usage counters update with document creation
- **Monthly Reset**: Usage resets on billing date
- **Limit Enforcement**: Block actions when limits reached

---

## Accessibility Features

- **Screen Reader**: All billing information properly labeled
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Clear visual indicators for all states
- **Error Announcements**: ARIA live regions for payment errors