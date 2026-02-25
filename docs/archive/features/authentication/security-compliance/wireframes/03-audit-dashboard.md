# Audit Dashboard Wireframes - All States

## Screen States & Wireframes

### 🟢 Admin Audit Dashboard (Main View)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ▓▓▓ SEAL LOGO (h-12) ▓▓▓                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║ 📊 Security & Compliance Dashboard              🔴 3 Critical Issues        ║ [text-2xl font-bold mb-6]
║                                                                               ║
│ ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────┐ │
│ │    📄 Total Documents   │ │    ✅ Compliant         │ │  ⚠️ Issues      │ │
│ │         2,847           │ │       2,834 (99.5%)     │ │       13        │ │
│ │    ↑ 12% vs last month │ │    ↑ 0.2% vs last month │ │   3 Critical    │ │
│ └─────────────────────────┘ └─────────────────────────┘ │   7 Medium      │ │
│                                                         │   3 Low         │ │
│ ┌─────────────────────────┐ ┌─────────────────────────┐ └─────────────────┘ │
│ │    🔐 Security Events   │ │    📋 Audit Records     │                     │
│ │         156             │ │       45,892            │                     │
│ │    Last: 2 hours ago    │ │    Last: 3 minutes ago  │                     │
│ └─────────────────────────┘ └─────────────────────────┘                     │
│                                                                             │
│ Recent Security Events                                    [View All Events] │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚨 CRITICAL  │ Document integrity violation     │ 2 hours ago │ SEC-001 │ │
│ │ ⚠️ MEDIUM    │ Failed authentication attempt   │ 4 hours ago │ SEC-002 │ │
│ │ 🔵 INFO      │ Bulk document export            │ 6 hours ago │ AUD-234 │ │
│ │ ⚠️ MEDIUM    │ Compliance data incomplete       │ 1 day ago   │ COM-045 │ │
│ │ 🔵 INFO      │ Successful admin login          │ 1 day ago   │ AUD-235 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Compliance Status by Category                         [Generate Report]    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Document Retention    ████████████████████░ 95% (2,702/2,847)          │ │
│ │ Audit Trail Complete  █████████████████████░ 98% (2,790/2,847)         │ │
│ │ Electronic Consent    ███████████████████░░░ 92% (2,619/2,847)         │ │
│ │ Hash Verification     ██████████████████████ 100% (2,847/2,847)        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Quick Actions                                                               │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐   │
│ │  Generate Audit     │ │  Export Security    │ │  Review Critical    │   │
│ │      Report         │ │       Logs          │ │      Issues         │   │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔍 Detailed Audit Log View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📋 Audit Log                                              <Back to Dashboard>│
│                                                                             │
│ Filter Options                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Date Range: [Jan 1, 2024] to [Jan 15, 2024]    Event Type: [All ▼]     │ │
│ │ User: [All Users ▼]    Document: [All Documents ▼]    Search: [     ]   │ │
│ │                                           [Apply Filters] [Clear All]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Results: 45,892 events                                    [Export CSV/PDF] │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Timestamp          │Event Type     │User          │Document       │IP   │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 2024-01-15 14:43:22│Document Sign  │sarah@co.com  │Employment.pdf │1.2..│ │
│ │ 2024-01-15 14:42:18│Document View  │john@co.com   │NDA.pdf        │1.3..│ │
│ │ 2024-01-15 14:41:05│User Login     │admin@co.com  │-              │1.4..│ │
│ │ 2024-01-15 14:40:33│Hash Check     │System        │Contract.pdf   │-    │ │
│ │ 2024-01-15 14:39:47│Document Upload│mike@co.com   │Agreement.pdf  │1.5..│ │
│ │ 2024-01-15 14:38:12│Consent Given  │lisa@co.com   │-              │1.6..│ │
│ │ 2024-01-15 14:37:28│Document Send  │admin@co.com  │Terms.pdf      │1.4..│ │
│ │ 2024-01-15 14:36:44│Failed Login   │unknown       │-              │2.1..│ │
│ │ 2024-01-15 14:35:55│Email Sent     │System        │Employment.pdf │-    │ │
│ │ 2024-01-15 14:35:12│Document Delete│admin@co.com  │Old_Doc.pdf    │1.4..│ │
│ │                    │               │              │               │     │ │
│ │ [Previous] [1] [2] [3] ... [458] [Next]                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Event Details (Click any row for details)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Selected: Document Sign - Employment.pdf                                │ │
│ │                                                                         │ │
│ │ Event ID: AUD-20240115-1443-001                                        │ │
│ │ User: sarah@company.com (ID: user_abc123)                              │ │
│ │ Document: Employment_Agreement.pdf (ID: doc_xyz789)                    │ │
│ │ Action: Electronic signature applied                                   │ │
│ │ IP Address: 192.168.1.100                                              │ │
│ │ User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0    │ │
│ │ Session Duration: 8 minutes 34 seconds                                 │ │
│ │ Signature Method: Digital draw                                         │ │
│ │ Legal Compliance: ✅ All requirements met                              │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 Compliance Report Generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📋 Generate Compliance Report                            <Back to Dashboard>│
│                                                                             │
│ Report Configuration                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ Report Type                                                             │ │
│ │ (•) Full Compliance Report    ( ) Document-Specific    ( ) User-Specific│ │
│ │                                                                         │ │
│ │ Date Range                                                              │ │
│ │ From: [2024-01-01 ▼]          To: [2024-01-15 ▼]                       │ │
│ │                                                                         │ │
│ │ Include Sections                                                        │ │
│ │ [✓] Executive Summary         [✓] Document Audit Trail                 │ │
│ │ [✓] Security Events           [✓] User Activity Logs                   │ │
│ │ [✓] Compliance Metrics        [✓] Risk Assessment                      │ │
│ │ [✓] Retention Status          [ ] Technical Details                    │ │
│ │                                                                         │ │
│ │ Output Format                                                           │ │
│ │ [✓] PDF (Legal/Court Ready)   [✓] CSV (Data Analysis)                  │ │
│ │ [ ] Excel (Detailed Analysis) [ ] JSON (API Integration)               │ │
│ │                                                                         │ │
│ │ Security Level                                                          │ │
│ │ (•) Standard Report           ( ) Confidential (Password Protected)    │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Report Preview                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ Report Title: Compliance Report - January 1-15, 2024                   │ │
│ │ Generated by: admin@company.com                                         │ │
│ │ Generation Date: January 15, 2024 at 2:43 PM UTC                       │ │
│ │                                                                         │ │
│ │ Estimated Pages: 47                                                     │ │
│ │ Estimated File Size: 2.3 MB                                            │ │
│ │ Processing Time: ~30 seconds                                            │ │
│ │                                                                         │ │
│ │ Content Summary:                                                        │ │
│ │ • 2,847 documents analyzed                                              │ │
│ │ • 45,892 audit events included                                          │ │
│ │ • 13 compliance issues detailed                                         │ │
│ │ • 156 security events documented                                        │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│ │    Generate Report      │  │       Cancel           │                  │
│ └─────────────────────────┘  └─────────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Report Generation Progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        📊 Generating Compliance Report                      │
│                                                                             │
│                      Please wait while we compile your report              │
│                                                                             │
│    Progress                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [██████████████████████████░░░░] 75%                              │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Current Step: Analyzing compliance metrics...                           │
│                                                                             │
│    Completed Steps:                                                         │
│    ✅ Gathering audit data (2,847 documents)                                │
│    ✅ Processing security events (156 events)                               │
│    ✅ Validating document integrity                                          │
│    ✅ Calculating compliance scores                                          │
│    ⏳ Analyzing compliance metrics                                           │
│    ⏳ Generating executive summary                                           │
│    ⏳ Formatting PDF report                                                  │
│                                                                             │
│                    Estimated time remaining: 45 seconds                     │
│                                                                             │
│                          <Cancel Generation>                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Report Generation Complete

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       ✅ Compliance Report Generated                        │
│                                                                             │
│                   Your compliance report is ready for download              │
│                                                                             │
│    Report Details                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                                                                     │  │
│    │  📋 Report: Compliance_Report_2024-01-15.pdf                       │  │
│    │  📊 Pages: 47                                                      │  │
│    │  💾 Size: 2.3 MB                                                   │  │
│    │  🔐 Security: Standard (No password protection)                    │  │
│    │  ⏰ Generated: Jan 15, 2024 at 2:45 PM UTC                         │  │
│    │  📅 Expires: Jan 22, 2024 at 2:45 PM UTC                          │  │
│    │                                                                     │  │
│    │  Report Summary:                                                    │  │
│    │  • Overall Compliance Score: 96.8%                                 │  │
│    │  • Documents Analyzed: 2,847                                       │  │
│    │  • Critical Issues: 3 (requires attention)                         │  │
│    │  • Security Events: 156 (all resolved)                             │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Download Options                                                         │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      📄 Download PDF Report                         │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      📊 Download CSV Data                           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Generate Another Report>                          │
│                         <Back to Dashboard>                                │
│                                                                             │
│              💡 This download link will expire in 7 days                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Audit Dashboard

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│ 📊 Audit Dashboard      │
│                         │
│ 🔴 3 Critical Issues    │
│                         │
│ ┌─────────────────────┐ │
│ │ 📄 Documents: 2,847 │ │
│ │ ✅ Compliant: 99.5% │ │
│ │ ⚠️ Issues: 13       │ │
│ │ 🔐 Events: 156      │ │
│ └─────────────────────┘ │
│                         │
│ Recent Events           │
│ ┌─────────────────────┐ │
│ │🚨 Doc integrity     │ │
│ │  2h ago  SEC-001    │ │
│ │⚠️ Auth failed       │ │
│ │  4h ago  SEC-002    │ │
│ │🔵 Bulk export       │ │
│ │  6h ago  AUD-234    │ │
│ └─────────────────────┘ │
│                         │
│ [View All Events]       │
│                         │
│ Compliance Status       │
│ Retention: ████░ 95%    │
│ Audit Trail: ████ 98%   │
│ Consent: ███░ 92%       │
│ Hashes: █████ 100%      │
│                         │
│ ┌─────────────────────┐ │
│ │  Generate Report    │ │
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Real-time Updates

- **Live Data**: Dashboard updates in real-time via Convex subscriptions
- **Event Notifications**: New security events trigger immediate dashboard updates
- **Status Indicators**: Color-coded status indicators for quick assessment
- **Auto-refresh**: Regular data refresh every 30 seconds

### Filtering & Search

- **Advanced Filters**: Multi-criteria filtering with date ranges, users, documents
- **Search Functionality**: Full-text search across audit logs
- **Saved Filters**: Save frequently used filter combinations
- **Export Capabilities**: Export filtered results in multiple formats

### Report Generation

- **Custom Reports**: Flexible report configuration with multiple output formats
- **Scheduled Reports**: Automated report generation and delivery
- **Template System**: Pre-built report templates for common use cases
- **Legal Compliance**: Court-ready PDF formatting with proper citations

---

## Technical Integration

### Convex Backend

- **Real-time Dashboard**: Live updates via Convex subscriptions
- **Secure Queries**: Optimized queries for large audit datasets
- **Data Aggregation**: Real-time compliance metric calculations
- **Scalable Storage**: Efficient storage for millions of audit events

### Retraced Integration

- **Audit Logging**: Professional audit trail with Retraced service
- **Compliance Standards**: Industry-standard audit logging formats
- **Data Integrity**: Tamper-proof audit log storage
- **Export Capabilities**: Multiple export formats for compliance needs

### Clerk Integration

- **Admin Security**: MFA required for audit access
- **Role-based Access**: Different dashboard views based on user role
- **API Security**: Secure API endpoints for audit data access
- **Session Management**: Secure admin session handling

### Accessibility Features

- **Screen Reader**: Full dashboard accessibility
- **Keyboard Navigation**: Complete keyboard navigation support
- **Focus Management**: Clear focus indicators throughout
- **High Contrast**: Enhanced visibility for all compliance states
