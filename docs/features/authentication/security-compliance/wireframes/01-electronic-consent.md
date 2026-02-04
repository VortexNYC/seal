# Electronic Consent Wireframes - All States

## Screen States & Wireframes

### 🔵 Initial Consent Modal (First-Time Signer)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                    📋 Electronic Signature Consent                           ║ [text-3xl font-bold text-center]
║                                                                               ║
║            Before you can sign documents electronically,                     ║ [text-base text-center mb-6]
║                please review and accept the following:                       ║ [text-muted-foreground leading-relaxed]
║                                                                               ║
║    Electronic Signature Agreement                                             ║ [text-xl font-semibold mb-4]
║    ╭─[AGREEMENT CARD: variant="elevated"]─────────────────────────────────╮   ║
║    │                                                                         │   ║ [Card: p-6 space-y-4 bg-blue-50]
║    │  By checking the box below, you consent to use electronic              │   ║ [text-sm leading-relaxed mb-4]
║    │  signatures for this document and future documents.                    │   ║
║    │                                                                         │   ║
║    │  You acknowledge that:                                                  │   ║ [text-sm font-medium mb-2]
║    │  • Electronic signatures have the same legal effect as                 │   ║ [ul: space-y-2 text-sm]
║    │    handwritten signatures under the ESIGN Act                          │   ║ [li: text-muted-foreground]
║    │  • You can request paper copies at any time                            │   ║
║    │  • You can withdraw consent by contacting us                           │   ║
║    │                                                                         │   ║
║    │  Technical Requirements:                                                │   ║ [text-sm font-medium mb-2 mt-4]
║    │  • Modern web browser with JavaScript enabled                          │   ║ [ul: space-y-1 text-sm]
║    │  • Email access to receive signed documents                            │   ║ [li: text-muted-foreground]
║    │                                                                         │   ║
║    ╰─────────────────────────────────────────────────────────────────────────╯   ║
║                                                                               ║
║    ☐ I consent to use electronic signatures as described above               ║ [Checkbox: mr-2 text-base]
║                                                                               ║ [Label: font-medium cursor-pointer]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━ Continue to Document ━━━━━━━━━━━━━━━━━━━┓              ║ [Button: variant="default" w-full py-3]
║                                                                               ║ [disabled: until checkbox checked]
║                                                                               ║
║                        ┏━━━━━ Decline & Exit ━━━━━┓                          ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟢 Consent Accepted State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                  ✅ Electronic Signature Consent Accepted                     ║ [text-3xl font-bold text-center text-green-600]
║                                                                               ║
║                   Thank you for providing your consent.                       ║ [text-lg text-center mb-2]
║               You can now proceed to review and sign documents.              ║ [text-base text-muted-foreground text-center]
║                                                                               ║
║    ╭─[SUCCESS CARD: variant="elevated"]─────────────────────────────────╮     ║
║    │                         sarah@example.com                              │     ║ [Card: p-6 bg-green-50 border-green-200]
║    │                       Consent Date: Jan 15, 2024                       │     ║ [text-center space-y-2]
║    ╰─────────────────────────────────────────────────────────────────────────╯     ║ [text-sm text-green-700]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━ Proceed to Document ━━━━━━━━━━━━━━━━━━━┓               ║ [Button: variant="default" w-full py-3]
║                                                                               ║
║                                                                               ║
║    ╭─[INFO ALERT: variant="default"]──────────────────────────────────╮       ║
║    │ 💡 You won't need to consent again for future documents             │       ║ [Alert: bg-blue-50 border-blue-200 p-4]
║    ╰──────────────────────────────────────────────────────────────────────╯       ║ [text-blue-800 text-sm text-center]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Consent Declined State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        📄 Electronic Signature Declined                     │
│                                                                             │
│              You have declined to use electronic signatures.               │
│             Unfortunately, this document requires electronic               │
│                        signatures to proceed.                              │
│                                                                             │
│                        Alternative options:                                │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    Request Paper Copy                                │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                Contact Document Sender                               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Back to Consent>                                  │
│                                                                             │
│              For assistance, please contact: support@seal.nyc              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Consent Modal

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
║       Alternative         ║
╠═══════════════════════════╣
║                           ║
║    📋 E-Signature         ║ [text-lg font-semibold text-center]
║        Consent            ║
║                           ║
║   Review and accept       ║ [text-sm text-center mb-3]
║   electronic signature    ║ [text-muted-foreground]
║   agreement:              ║ [leading-relaxed]
║                           ║
║ ╭─[AGREEMENT CARD]─────╮   ║ [Card: variant="outline" p-3 bg-blue-50]
║ │                     │   ║ [border-blue-200]
║ │ You consent to use  │   ║ [text-xs leading-tight space-y-2]
║ │ electronic sigs     │   ║
║ │ with same legal     │   ║
║ │ effect as written   │   ║
║ │ signatures.         │   ║
║ │                     │   ║
║ │ Requirements:       │   ║ [text-xs font-medium mt-2]
║ │ • Modern browser    │   ║ [ul: space-y-1 text-xs]
║ │ • Email access      │   ║ [li: text-muted-foreground]
║ │                     │   ║
║ │ [Scroll for more]   │   ║ [text-xs text-blue-600]
║ ╰─────────────────────╯   ║
║                           ║
║ ☐ I consent to use        ║ [Checkbox: mr-2 text-sm]
║   electronic signatures   ║ [Label: font-medium cursor-pointer]
║                           ║ [text-xs leading-tight]
║ ┏━━━ Continue to Doc ━━━┓ ║ [Button: variant="default" w-full py-2]
║                           ║ [disabled: until checkbox checked]
║                           ║
║ <Decline & Exit>          ║ [Button: variant="ghost" text-sm]
║                           ║
╚═══════════════════════════╝
```

---

## Interaction Specifications

### Consent Modal Behavior

- **Required Checkbox**: Must be checked to enable "Continue" button
- **Scroll Tracking**: Ensure user scrolled through full agreement text
- **Session Storage**: Store consent temporarily until document completion
- **Auto-Focus**: Focus on checkbox after modal opens

### Legal Compliance Features

- **Timestamp Recording**: UTC timestamp when consent is given
- **IP Address Logging**: Record user's IP for audit trail
- **Device Information**: Store basic browser/device info
- **Consent Version**: Track which version of consent was accepted

### Error Handling

- **Network Issues**: Allow retry if consent submission fails
- **Session Timeout**: Re-prompt for consent if session expires
- **Browser Compatibility**: Fallback for older browsers

---

## Technical Integration

### Convex Backend

- **Consent Storage**: Encrypted consent records with full audit trail
- **User Linking**: Associate consent with user account and workspace
- **Compliance Queries**: Fast retrieval for legal requirements
- **Retention Management**: Automatic consent record retention

### Legal Compliance

- **ESIGN Act Requirements**: Full disclosure and clear consent process
- **UETA Compliance**: Electronic signature agreement standards
- **Audit Trail**: Complete record of consent process
- **Withdrawal Process**: Clear path for users to withdraw consent

### Accessibility Features

- **Screen Reader**: Full agreement text accessible
- **Keyboard Navigation**: Tab through all interactive elements
- **Focus Management**: Clear focus indicators
- **High Contrast**: Clear visual distinction for all states
