# Signing Experience - Wireframes

## 01: Signing Interface Wireframes

### Authentication Required Landing Page

```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Seal                                           [☰] [?] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📄 Document Signing Invitation                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 service-agreement.pdf                           │ │
│ │                                                     │ │
│ │ From: Sarah Johnson (Acme Corp)                     │ │
│ │ To: john@clientcompany.com                          │ │
│ │                                                     │ │
│ │ "Hi John, Please review and sign the service       │ │
│ │ agreement for our Q1 project. Let me know if you   │ │
│ │ have any questions. Best regards, Sarah"           │ │
│ │                                                     │ │
│ │ 🔒 Secure Account Required                         │ │
│ │ Create an account or sign in to view and sign      │ │
│ │ this document securely.                            │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ✉️ john@clientcompany.com                              │
│                                                         │
│ [🔑 Create Account to Sign] [📝 Already have account? Sign In] │
│                                                         │
│ 💡 Why create an account?                              │
│ • Legal signature authentication                       │
│ • Secure document access                               │
│ • Download your signed documents                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Account Creation for Signing

```
┌─────────────────────────────────────────────────────────┐
│ Create Account to Sign Document                   [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔐 Secure Account Creation                              │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ✉️ Email Address:                                  │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ john@clientcompany.com                          │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ (Pre-filled from invitation)                       │ │
│ │                                                     │ │
│ │ 👤 Full Name:                                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ John Smith                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 🔒 Password:                                       │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ ••••••••••••••                                  │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ✅ Strong password                                  │ │
│ │                                                     │ │
│ │ 🔒 Confirm Password:                               │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ ••••••••••••••                                  │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ✅ Passwords match                                  │ │
│ │                                                     │ │
│ │ ☑️ I agree to Terms of Service and Privacy Policy  │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]                    [🔐 Create Account & Continue] │
│                                                         │
│ 📄 After verification, you'll immediately access the   │
│ document for signing.                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Email Verification Required

```
┌─────────────────────────────────────────────────────────┐
│ Verify Your Email                                 [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📧 Check Your Email                                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ✉️ Verification email sent to:                     │ │
│ │ john@clientcompany.com                              │ │
│ │                                                     │ │
│ │ Please check your email and click the verification │ │
│ │ link to complete account creation and access the    │ │
│ │ document for signing.                               │ │
│ │                                                     │ │
│ │ ⏱️ Verification link expires in 10 minutes         │ │
│ │                                                     │ │
│ │ Didn't receive the email?                           │ │
│ │ • Check your spam/junk folder                       │ │
│ │ • Wait 2-3 minutes for delivery                     │ │
│ │                                                     │ │
│ │         [🔄 Resend Verification Email]              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Back to Sign In]                    [❌ Cancel]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Document Signing Interface

### Main Signing Interface

```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Seal                                 👤 John Smith ▼ │
├─────────────────────────────────────────────────────────┤
│ Document: service-agreement.pdf • Ready for Signing     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 Document Progress: 0 of 3 fields completed (0%)     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Progress: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │         SERVICE AGREEMENT                       │ │ │
│ │ │                                                 │ │ │
│ │ │ Between: ________________                       │ │ │
│ │ │                                                 │ │ │
│ │ │ 🔵 [John Smith - Signature] ← START HERE       │ │ │
│ │ │                                                 │ │ │
│ │ │ And: ____________________                       │ │ │
│ │ │                                                 │ │ │
│ │ │ Date: ___________                              │ │ │
│ │ │ 🔵 [Auto Date Field]                           │ │ │
│ │ │                                                 │ │ │
│ │ │ [Additional contract text...]                   │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ Page 1 of 3              [◀] [▶] [🔍+] [🔍-]       │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🎯 Next: Complete your signature field                 │
│                                                         │
│ [📋 Field Overview] [🏁 Start Signing] [❓ Help]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Signature Field Active

```
┌─────────────────────────────────────────────────────────┐
│ Sign Document                                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✍️ Please Sign Below                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Field 1 of 3: Signature Field                   │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │                                                 │ │ │
│ │ │           [Sign Here]                           │ │ │
│ │ │                                                 │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ Choose signing method:                              │ │
│ │ ● Draw with mouse/finger                            │ │
│ │ ○ Type signature                                    │ │
│ │ ○ Upload signature image                            │ │
│ │                                                     │ │
│ │               [🗑️ Clear]  [✅ Accept]               │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Your signature will be legally binding and secure   │
│                                                         │
│ [◀ Cancel]                              [Continue →]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Signature Capture with Drawing

```
┌─────────────────────────────────────────────────────────┐
│ Draw Your Signature                               [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✍️ Draw your signature in the box below                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │                                                 │ │ │
│ │ │    John Smith                                   │ │ │ <- User drawing
│ │ │                                                 │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 💡 Tips:                                           │ │
│ │ • Sign naturally with your finger or mouse         │ │
│ │ • Make sure signature is clear and readable        │ │
│ │ • You can clear and redo if needed                 │ │
│ │                                                     │ │
│ │               [🗑️ Clear]  [✅ Accept]               │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Back] [💾 Save for Future Use] [✍️ Type Instead]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Date Field Auto-Population

```
┌─────────────────────────────────────────────────────────┐
│ Document Signing                                  [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📅 Date Field Completed Automatically                  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Field 2 of 3: Date Field                        │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │     March 15, 2024 - 3:42 PM PST               │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ ✅ Automatically filled with current date & time   │ │
│ │                                                     │ │
│ │ 💡 This date represents exactly when you're        │ │
│ │ signing this document and cannot be changed for     │ │
│ │ legal authenticity.                                │ │
│ │                                                     │ │
│ │                  [Continue →]                       │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Field completed in 0.3 seconds • Next field ready     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Text Field Entry

```
┌─────────────────────────────────────────────────────────┐
│ Enter Information                                 [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📝 Please Enter Required Information                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📋 Field 3 of 3: Company Name                      │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Client Company LLC                              │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 📊 Characters: 18/100                              │ │
│ │                                                     │ │
│ │ 💡 Enter the full legal name of your company       │ │
│ │                                                     │ │
│ │               [Clear]     [✅ Accept]               │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [◀ Previous Field]                      [Continue →]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Progress and Navigation

### Field Navigation Overview

```
┌─────────────────────────────────────────────────────────┐
│ Field Overview                                    [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 Your Fields to Complete                              │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ✅ Field 1: Signature                              │ │
│ │    Page 1 • Completed 3:42 PM                      │ │
│ │    [👁️ View]                                        │ │
│ │                                                     │ │
│ │ ✅ Field 2: Date                                   │ │
│ │    Page 1 • Auto-filled March 15, 2024 3:42 PM    │ │
│ │    [👁️ View]                                        │ │
│ │                                                     │ │
│ │ 🔄 Field 3: Company Name                           │ │
│ │    Page 1 • Currently completing...                │ │
│ │    [✏️ Complete]                                    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 Progress: 2 of 3 fields completed (67%)             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Progress: ████████████████████░░░░░░░░░░░ 67%        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Close Overview]                    [Continue Signing]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Multi-Page Navigation

```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Seal                                 👤 John Smith ▼ │
├─────────────────────────────────────────────────────────┤
│ Document: service-agreement.pdf • Page 2 of 3          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 Document Progress: 2 of 3 fields completed (67%)    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Progress: ████████████████████░░░░░░░░░░░ 67%        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ │ [Contract terms and conditions text...]         │ │ │
│ │ │                                                 │ │ │
│ │ │ No signature fields on this page               │ │ │
│ │ │                                                 │ │ │
│ │ │ [More contract text...]                         │ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ Page 2 of 3              [◀] [▶] [🔍+] [🔍-]       │ │
│ │ No fields to complete on this page                 │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Page 3 has your remaining field                     │
│                                                         │
│ [◀ Previous Page] [Next Page with Fields →]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Final Review and Completion

### Final Review Before Submission

```
┌─────────────────────────────────────────────────────────┐
│ Final Review                                      [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔍 Review Your Completed Document                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📄 service-agreement.pdf                           │ │
│ │                                                     │ │
│ │ ✅ All fields completed:                           │ │
│ │                                                     │ │
│ │ ✍️ Signature: John Smith                           │ │
│ │ 📅 Date: March 15, 2024 - 3:42 PM PST             │ │
│ │ 🏢 Company: Client Company LLC                     │ │
│ │                                                     │ │
│ │ 🔒 Legal Authentication:                           │ │
│ │ • Signed by: john@clientcompany.com                │ │
│ │ • Account verified: ✅                             │ │
│ │ • Signing IP: 192.168.1.100                       │ │
│ │ • Completion time: 3:45 PM PST                     │ │
│ │                                                     │ │
│ │              [📄 Download Preview]                  │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ⚠️ By submitting, you confirm this electronic signature │
│ is legally binding and equivalent to your handwritten   │
│ signature.                                              │
│                                                         │
│ [◀ Back to Edit] [📤 Submit Signed Document]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Signing Complete Success

```
┌─────────────────────────────────────────────────────────┐
│ Signing Complete!                                 [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🎉 Document Signed Successfully                        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ✅ service-agreement.pdf                           │ │
│ │                                                     │ │
│ │ Your signature has been successfully recorded and   │ │
│ │ the document has been sent back to:                 │ │
│ │                                                     │ │
│ │ 👤 Sarah Johnson (Acme Corp)                       │ │
│ │ 📧 sarah@acmecorp.com                              │ │
│ │                                                     │ │
│ │ 📊 Signing Details:                                │ │
│ │ • Completed: March 15, 2024 at 3:45 PM PST        │ │
│ │ • Reference: DOC-2024-0315-001                     │ │
│ │ • Status: Legally binding                          │ │
│ │                                                     │ │
│ │ 📧 Confirmation email sent to your account         │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💾 Keep a copy for your records:                       │
│                                                         │
│ [📥 Download Signed Document] [📧 Email Copy to Me]    │
│                                                         │
│ [🏠 Dashboard] [❓ Questions?] [🔐 Sign Out]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Signing Experience

### Mobile Signing Interface

```
┌───────────────────────────┐
│ 🏠 Seal          [☰]     │
├───────────────────────────┤
│                           │
│ 📄 Sign Document         │
│                           │
│ ┌───────────────────────┐ │
│ │ service-agreement.pdf │ │
│ │ Progress: 0/3 (0%)    │ │
│ │ ░░░░░░░░░░░░░░░░░░░░  │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │                       │ │
│ │  SERVICE AGREEMENT    │ │
│ │                       │ │
│ │  Between: _________   │ │
│ │                       │ │
│ │  🔵 [Sign Here] ←     │ │
│ │                       │ │
│ │  Date: _______        │ │
│ │  🔵 [Auto Date]       │ │
│ │                       │ │
│ │  Page 1/3    [+][-]   │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ [🏁 Start Signing]        │
│                           │
│ [📋 Overview] [❓ Help]    │
│                           │
└───────────────────────────┘
```

### Mobile Signature Capture

```
┌───────────────────────────┐
│ Sign Here           [✕]  │
├───────────────────────────┤
│                           │
│ ✍️ Field 1/3: Signature  │
│                           │
│ ┌───────────────────────┐ │
│ │                       │ │
│ │                       │ │
│ │  John Smith           │ │
│ │                       │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ Sign method:              │
│ ● Draw with finger        │
│ ○ Type signature          │
│                           │
│ [🗑️ Clear] [✅ Accept]    │
│                           │
│ 💡 Sign naturally with    │
│ your finger               │
│                           │
│ [◀ Back] [Continue →]     │
│                           │
└───────────────────────────┘
```

### Mobile Auto Date Field

```
┌───────────────────────────┐
│ Date Field          [✕]  │
├───────────────────────────┤
│                           │
│ 📅 Field 2/3: Date       │
│                           │
│ ┌───────────────────────┐ │
│ │                       │ │
│ │   March 15, 2024      │ │
│ │   3:42 PM PST         │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ ✅ Auto-filled with      │
│ current date & time       │
│                           │
│ 💡 Cannot be changed for  │
│ legal authenticity        │
│                           │
│ [Continue →]              │
│                           │
└───────────────────────────┘
```

---

## Error Handling

### Session Expired Recovery

```
┌─────────────────────────────────────────────────────────┐
│ Session Expired                                   [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔒 Please Sign In Again                                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ Your session has expired for security.              │ │
│ │                                                     │ │
│ │ 💾 Good news: Your progress is saved!              │ │
│ │ • Signature: ✅ Completed                          │ │
│ │ • Date field: ✅ Auto-filled                       │ │
│ │ • Company name: ⏳ In progress                     │ │
│ │                                                     │ │
│ │ Sign in to continue where you left off.            │ │
│ │                                                     │ │
│ │ ✉️ Email:                                          │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ john@clientcompany.com                          │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ 🔒 Password:                                       │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ ••••••••••••••                                  │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Forgot Password?]              [🔐 Sign In & Continue] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Network Connection Issues

```
┌─────────────────────────────────────────────────────────┐
│ Connection Issue                                  [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📶 Connection Problem Detected                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🔄 Attempting to reconnect...                      │ │
│ │                                                     │ │
│ │ 💾 Your progress is automatically saved:           │ │
│ │ • All completed fields preserved                    │ │
│ │ • Current field progress saved                      │ │
│ │ • Session remains secure                            │ │
│ │                                                     │ │
│ │ 📶 Connection Status:                              │ │
│ │ • Checking network... (3 seconds)                  │ │
│ │ • Will retry automatically                          │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Reconnecting... ████████░░░░ 67%                │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 You can continue signing once connection is restored │
│                                                         │
│                               [🔄 Retry Now] [❌ Cancel] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Bottom Sheets for Signing

### Mobile Help Options Bottom Sheet

```
┌───────────────────────────┐
│ Sign Here           [✕]  │
├───────────────────────────┤
│                           │
│ ✍️ Field 1/3: Signature  │
│                           │
│           ...             │
│                           │
│ [◀ Back] [❓ Help] ←      │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Signing Help            ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ ❓ How to sign          ║
│ ║    Step-by-step guide   ║
│ ║                         ║
│ ║ 📱 Signature tips       ║
│ ║    Best practices       ║
│ ║                         ║
│ ║ ⚠️ Having trouble?      ║
│ ║    Common issues        ║
│ ║                         ║
│ ║ 📞 Contact support      ║
│ ║    Get direct help      ║
│ ║                         ║
│ ║ ────────────────────    ║
│ ║                         ║
│ ║ 🔐 Legal information    ║
│ ║    Your rights          ║
│ ║                         ║
│ ╚═════════════════════════╝
│         [Close]           │
└───────────────────────────┘
```

### Document Navigation Bottom Sheet

```
┌───────────────────────────┐
│ 📄 Sign Document         │
├───────────────────────────┤
│                           │
│ [📋 Field Overview] ←     │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Document Overview       ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ 📋 Your Progress:       ║
│ ║ ████████████░░░░ 75%    ║
│ ║                         ║
│ ║ ✅ Field 1: Signature   ║
│ ║    Page 1 • Complete    ║
│ ║                         ║
│ ║ ✅ Field 2: Date        ║
│ ║    Page 1 • Auto-filled ║
│ ║                         ║
│ ║ 🔄 Field 3: Company     ║
│ ║    Page 3 • In progress ║
│ ║    [Continue Here]      ║
│ ║                         ║
│ ║ ⏱️ Time remaining:      ║
│ ║    2 fields left        ║
│ ║                         ║
│ ╚═════════════════════════╝
│    [Cancel] [Continue]    │
└───────────────────────────┘
```

### Signature Method Selection Bottom Sheet

```
┌───────────────────────────┐
│ Sign Here           [✕]  │
├───────────────────────────┤
│                           │
│ Choose signing method: ←  │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ How would you like      ║
│ ║ to sign?                ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ ✏️ Draw with finger     ║
│ ║    Natural signature    ║
│ ║                         ║
│ ║ 📸 Photo of signature   ║
│ ║    Take picture         ║
│ ║                         ║
│ ║ ⌨️ Type signature       ║
│ ║    Type your name       ║
│ ║                         ║
│ ║ 💾 Use saved signature  ║
│ ║    Previously created   ║
│ ║                         ║
│ ║ ────────────────────    ║
│ ║                         ║
│ ║ 💡 Recommended: Draw    ║
│ ║    Most natural look    ║
│ ║                         ║
│ ╚═════════════════════════╝
│         [Cancel]          │
└───────────────────────────┘
```

### Decline to Sign Bottom Sheet

```
┌───────────────────────────┐
│ 📄 Sign Document         │
├───────────────────────────┤
│                           │
│ [◀ Cancel] [❌ Decline] ← │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Decline to Sign?        ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ Why are you declining?  ║
│ ║ (Optional)              ║
│ ║                         ║
│ ║ ○ Need more time        ║
│ ║                         ║
│ ║ ○ Missing information   ║
│ ║                         ║
│ ║ ○ Terms not acceptable  ║
│ ║                         ║
│ ║ ○ Wrong document        ║
│ ║                         ║
│ ║ ○ Other reason:         ║
│ ║ [________________]      ║
│ ║                         ║
│ ║ ⚠️ This will notify     ║
│ ║ the sender that you     ║
│ ║ declined to sign.       ║
│ ║                         ║
│ ╚═════════════════════════╝
│   [Cancel] [Decline]      │
└───────────────────────────┘
```

### Document Actions Bottom Sheet

```
┌───────────────────────────┐
│ 🏠 Seal          [☰] ←   │
├───────────────────────────┤
│                           │
│ 📄 Sign Document         │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Document Options        ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ 👁️ Preview full doc     ║
│ ║    View all pages       ║
│ ║                         ║
│ ║ 📥 Download copy        ║
│ ║    Save for records     ║
│ ║                         ║
│ ║ 🔍 Zoom controls        ║
│ ║    Adjust page size     ║
│ ║                         ║
│ ║ ────────────────────    ║
│ ║                         ║
│ ║ 📧 Questions?           ║
│ ║    Contact sender       ║
│ ║                         ║
│ ║ ❓ Signing help         ║
│ ║    Get assistance       ║
│ ║                         ║
│ ║ ────────────────────    ║
│ ║                         ║
│ ║ ❌ Decline to sign      ║
│ ║    I can't sign this    ║
│ ║                         ║
│ ╚═════════════════════════╝
│         [Close]           │
└───────────────────────────┘
```

### Save Draft Bottom Sheet

```
┌───────────────────────────┐
│ Sign Here           [✕]  │
├───────────────────────────┤
│                           │
│ Session ending soon... ←  │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Save Your Progress?     ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ ⏱️ Auto-save in 30 sec  ║
│ ║                         ║
│ ║ ✅ Progress so far:     ║
│ ║ • Signature completed   ║
│ ║ • Date auto-filled      ║
│ ║ • Company field: 50%    ║
│ ║                         ║
│ ║ 💾 Saved drafts expire  ║
│ ║ in 7 days for security  ║
│ ║                         ║
│ ║ 📱 Sign in on any device║
│ ║ to continue where you   ║
│ ║ left off                ║
│ ║                         ║
│ ╚═════════════════════════╝
│  [Don't Save] [Save Draft]│
└───────────────────────────┘
```

### Final Review Options Bottom Sheet

```
┌───────────────────────────┐
│ Final Review        [✕]  │
├───────────────────────────┤
│                           │
│ [📄 Download Preview] ←   │
│                           │
├───────────────────────────┤
│ ╔═════════════════════════╗
│ ║ Review Options          ║
│ ╠═════════════════════════╣
│ ║                         ║
│ ║ 📄 Download preview     ║
│ ║    PDF with your        ║
│ ║    completed fields     ║
│ ║                         ║
│ ║ 🔍 Zoom to check        ║
│ ║    Review signatures    ║
│ ║    and details          ║
│ ║                         ║
│ ║ ✏️ Edit field           ║
│ ║    Make changes before  ║
│ ║    final submission     ║
│ ║                         ║
│ ║ ────────────────────    ║
│ ║                         ║
│ ║ 📧 Email me a copy      ║
│ ║    After I submit       ║
│ ║                         ║
│ ╚═════════════════════════╝
│         [Close]           │
└───────────────────────────┘
```

This comprehensive wireframe collection covers the complete signing experience from authentication through document completion, with proper mobile support, automatic date handling, robust error recovery, and intuitive mobile bottom sheets for all key signing actions while maintaining legal compliance and a smooth user experience.
