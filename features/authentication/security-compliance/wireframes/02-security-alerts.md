# Security Alerts Wireframes - All States

## Screen States & Wireframes

### 🔴 Document Integrity Violation (Hash Mismatch)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                  🚨 SECURITY ALERT: Document Modified                       ║ [text-3xl font-bold text-center text-red-600]
║                                                                               ║
║              The document has been modified since upload and                ║ [text-lg text-center mb-2]
║                      cannot be signed for security reasons.                ║ [text-base text-muted-foreground text-center]
║                                                                               ║
║                    Document: Employment_Agreement.pdf                      ║ [text-base font-mono bg-gray-100 px-3 py-1 rounded]
║                    Detected: Jan 15, 2024 at 2:43 PM                       ║ [text-sm text-muted-foreground text-center]
║                                                                               ║
║    Security Details                                                         ║ [text-xl font-semibold mb-4]
║    ╭─[SECURITY CARD: variant="elevated"]─────────────────────────────────╮  ║
║    │                                                                       │  ║ [Card: p-6 space-y-4 bg-red-50 border-red-200]
║    │  ❌ Document integrity check failed                                  │  ║ [text-base font-medium text-red-700 mb-3]
║    │  📄 Original hash: 2a8f9c1d...                                       │  ║ [text-sm font-mono bg-white px-2 py-1 rounded]
║    │  📄 Current hash:  8b3e7a5f...                                       │  ║ [text-sm font-mono bg-white px-2 py-1 rounded]
║    │                                                                       │  ║
║    │  This indicates the document may have been:                          │  ║ [text-sm text-muted-foreground font-medium mb-2]
║    │  • Modified after upload                                             │  ║ [ul: space-y-1 text-sm text-red-700]
║    │  • Corrupted during transmission                                     │  ║ [li: ml-4]
║    │  • Compromised by unauthorized access                                │  ║
║    │                                                                       │  ║
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Recommended Actions:                                                     ║ [text-xl font-semibold mb-4]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━ Contact Document Sender ━━━━━━━━━━━━━━━┓                  ║ [Button: variant="default" w-full py-3 mb-3]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━ Report Security Issue ━━━━━━━━━━━━━━━━┓                  ║ [Button: variant="destructive" w-full py-3 mb-6]
║                                                                               ║
║                          ┏━━━ Back to Documents ━━━┓                         ║ [Button: variant="ghost"]
║                                                                               ║
║              Incident ID: SEC-20240115-001 (for support reference)        ║ [text-sm text-muted-foreground text-center font-mono]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🔴 Unauthorized Access Attempt

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        🛡️ ACCESS DENIED                                      ║ [text-3xl font-bold text-center text-red-600]
║                                                                               ║
║              Your access link has expired or is invalid.                   ║ [text-lg text-center mb-2]
║                    This attempt has been logged for security.              ║ [text-base text-muted-foreground text-center]
║                                                                               ║
║                    Attempted Access: Jan 15, 2024 at 2:43 PM               ║ [text-sm text-muted-foreground text-center]
║                    Document: Employment_Agreement.pdf                      ║ [text-sm font-mono bg-gray-100 px-3 py-1 rounded text-center]
║                                                                               ║
║    Access Details                                                           ║ [text-xl font-semibold mb-4]
║    ╭─[ACCESS CARD: variant="elevated"]───────────────────────────────────╮  ║
║    │                                                                       │  ║ [Card: p-6 space-y-4 bg-orange-50 border-orange-200]
║    │  ❌ Access token expired                                             │  ║ [text-base font-medium text-orange-700 mb-2]
║    │  ⏰ Original expiration: Jan 14, 2024 at 11:59 PM                   │  ║ [text-sm text-muted-foreground mb-2]
║    │  🔒 Access attempts logged                                           │  ║ [text-sm text-orange-600 font-medium mb-4]
║    │                                                                       │  ║
║    │  For your security, document access links expire after 24 hours     │  ║ [text-sm text-muted-foreground leading-relaxed]
║    │  or after successful signing completion.                             │  ║
║    │                                                                       │  ║
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Next Steps:                                                              ║ [text-xl font-semibold mb-4]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━ Request New Access Link ━━━━━━━━━━━━━━━┓                  ║ [Button: variant="default" w-full py-3 mb-3]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━ Contact Document Sender ━━━━━━━━━━━━━━━━┓                 ║ [Button: variant="outline" w-full py-3 mb-6]
║                                                                               ║
║                           ┏━━━ Back to Home ━━━┓                             ║ [Button: variant="ghost"]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 🟡 Compliance Data Missing Warning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                      ⚠️ COMPLIANCE REVIEW REQUIRED                          │
│                                                                             │
│              Some required compliance data is missing for this              │
│                 document. Review needed before completion.                  │
│                                                                             │
│                    Document: Employment_Agreement.pdf                      │
│                    Review Required: Jan 15, 2024                            │
│                                                                             │
│    Missing Compliance Data                                                  │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  ❌ Electronic consent record incomplete                           │  │
│    │  ❌ Signer authentication method missing                           │  │
│    │  ⚠️ Audit trail has gaps in timeline                              │  │
│    │                                                                     │  │
│    │  Legal Impact Assessment: MEDIUM RISK                              │  │
│    │                                                                     │  │
│    │  Document signing is temporarily paused to ensure                  │  │
│    │  full legal compliance and validity.                               │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Resolution Actions:                                                      │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                Complete Missing Information                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Contact Admin Support                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                          <Back to Documents>                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Document Retention Policy Violation

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                  🚨 CRITICAL: Retention Policy Violation                    ║ [text-3xl font-bold text-center text-red-600]
║                                                                               ║
║              A document retention policy violation has been detected.       ║ [text-lg text-center mb-2]
║                    Immediate action required for compliance.                ║ [text-base text-muted-foreground text-center]
║                                                                               ║
║                    Violation Type: Premature Document Deletion              ║ [text-sm text-muted-foreground text-center]
║                    Affected Documents: 3                                    ║ [text-sm font-mono bg-red-100 px-3 py-1 rounded text-center]
║                    Detected: Jan 15, 2024 at 2:43 PM                       ║ [text-sm text-muted-foreground text-center]
║                                                                               ║
║    Violation Details                                                        ║ [text-xl font-semibold mb-4]
║    ╭─[VIOLATION CARD: variant="elevated"]────────────────────────────────╮  ║
║    │                                                                       │  ║ [Card: p-6 space-y-4 bg-red-50 border-red-200]
║    │  ❌ Employment_Agreement_001.pdf                                     │  ║ [text-base font-medium text-red-700 mb-1]
║    │     Deleted after 2 years (Required: 7 years)                       │  ║ [text-sm text-red-600 ml-4 mb-3]
║    │                                                                       │  ║
║    │  ❌ NDA_Contract_002.pdf                                             │  ║ [text-base font-medium text-red-700 mb-1]
║    │     Backup corruption detected                                       │  ║ [text-sm text-red-600 ml-4 mb-3]
║    │                                                                       │  ║
║    │  ❌ Service_Agreement_003.pdf                                        │  ║ [text-base font-medium text-red-700 mb-1]
║    │     Storage system failure                                           │  ║ [text-sm text-red-600 ml-4 mb-4]
║    │                                                                       │  ║
║    │  Legal Risk Level: HIGH                                            │  ║ [text-lg font-bold text-red-800 mb-2]
║    │  Recovery Status: In Progress                                      │  ║ [text-base text-blue-700 font-medium]
║    │                                                                       │  ║
║    ╰─────────────────────────────────────────────────────────────────────╯  ║
║                                                                               ║
║    Immediate Actions Taken:                                                ║ [text-xl font-semibold mb-4]
║    ✅ Operations halted for affected document types                         ║ [text-sm text-green-700 mb-2]
║    ✅ Legal/compliance team notified                                        ║ [text-sm text-green-700 mb-2]
║    ✅ Backup recovery initiated                                             ║ [text-sm text-green-700 mb-6]
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━ View Recovery Progress ━━━━━━━━━━━━━━━┓                  ║ [Button: variant="default" w-full py-3 mb-6]
║                                                                               ║
║                Case ID: RET-20240115-001 (for legal reference)             ║ [text-sm text-muted-foreground text-center font-mono]
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Responsive States

### 📱 Mobile Security Alert

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
║       Alternative         ║
╠═══════════════════════════╣
║                           ║
║  🚨 SECURITY ALERT        ║ [text-lg font-bold text-center text-red-600]
║                           ║
║ Document Modified         ║ [text-base font-semibold text-center mb-2]
║                           ║
║ The document has been     ║ [text-sm text-center mb-3]
║ changed since upload      ║ [text-muted-foreground leading-tight]
║ and cannot be signed.     ║
║                           ║
║ Employment_Agmt.pdf       ║ [text-xs font-mono bg-gray-100 px-2 py-1 rounded text-center]
║ Jan 15, 2024 2:43PM       ║ [text-xs text-muted-foreground text-center]
║                           ║
║ Security Details:         ║ [text-sm font-semibold mb-2]
║ ╭─[SECURITY CARD]──────╮  ║ [Card: variant="outline" p-2 bg-red-50]
║ │ ❌ Integrity failed   │  ║ [text-xs text-red-700 mb-1]
║ │ 📄 Hash mismatch     │  ║ [text-xs text-red-700 mb-2]
║ │                     │  ║
║ │ Document may be:    │  ║ [text-xs font-medium mb-1]
║ │ • Modified          │  ║ [ul: text-xs space-y-1]
║ │ • Corrupted         │  ║ [li: text-red-600]
║ │ • Compromised       │  ║
║ ╰─────────────────────╯  ║
║                           ║
║ ┏━━ Contact Sender ━━┓ ║ [Button: variant="default" size="sm" w-full mb-2]
║                           ║
║ ┏━━ Report Issue ━━━┓ ║ [Button: variant="destructive" size="sm" w-full mb-4]
║                           ║
║ <Back to Docs>            ║ [Button: variant="ghost" text-xs]
║                           ║
║ ID: SEC-20240115-001      ║ [text-xs text-muted-foreground font-mono text-center]
║                           ║
╚═══════════════════════════╝
```

---

## Interaction Specifications

### Security Alert Behavior
- **Immediate Display**: Show alerts as soon as security issues detected
- **No Dismissal**: Security alerts cannot be dismissed without action
- **Automatic Logging**: All security events logged to audit trail
- **Admin Notification**: High-severity alerts trigger immediate admin notifications

### Access Control
- **Token Validation**: Real-time validation of document access tokens
- **Rate Limiting**: Prevent brute force access attempts
- **Session Management**: Secure session handling during security events
- **IP Tracking**: Log IP addresses for all security-related events

### Compliance Integration
- **Legal Impact Assessment**: Automatic risk scoring for compliance issues
- **Escalation Paths**: Clear escalation procedures for different risk levels
- **Documentation**: Complete incident documentation for legal requirements
- **Recovery Procedures**: Automated and manual recovery options

---

## Technical Integration

### Convex Backend
- **Real-time Monitoring**: Live security event detection
- **Incident Storage**: Encrypted storage of all security incidents
- **Notification System**: Real-time admin alerts via Convex presence
- **Audit Integration**: Seamless integration with audit logging

### Web Crypto API
- **Hash Verification**: Real-time document integrity checking
- **Secure Validation**: Cryptographic validation of document access
- **Error Detection**: Advanced cryptographic error detection
- **Performance Optimization**: Efficient hashing for large documents

### Clerk Integration
- **Session Validation**: Secure session management during security events
- **Access Control**: Integration with Clerk access control
- **API Security**: Secure API endpoints for security operations
- **Multi-Factor**: Additional authentication for high-security actions

### Accessibility Features
- **Screen Reader**: All security alerts fully accessible
- **Keyboard Navigation**: Full keyboard navigation for security actions
- **Focus Management**: Clear focus indicators for critical actions
- **High Contrast**: Maximum visibility for security warnings