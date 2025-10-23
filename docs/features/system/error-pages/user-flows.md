# System Error Pages - User Flows

## Primary User Flows

### 404 Not Found Flow
```
○ User Navigates to Non-Existent URL
    ↓
□ Route Not Found (TanStack Router)
    ├─ Check: URL pattern against known routes
    ├─ Result: No matching route found
    └─ Trigger: Show 404 error page
    ↓
○ 404 Page Display
    ├─ Header: "Page Not Found"
    ├─ Message: Context-specific error message
    ├─ Actions: [Go Home] [Search] [Back]
    └─ Support: Optional contact support link
    ↓
□ User Recovery Actions
    ├─ Go Home → Navigate to dashboard
    ├─ Search → Open search with suggested terms
    ├─ Back → Browser back navigation
    └─ Support → Contact form with error context
```

### 403 Permission Denied Flow
```
○ User Attempts Unauthorized Action
    ↓
□ Permission Check (RBAC)
    ├─ Check: User role vs required permission
    ├─ Result: Insufficient permissions
    └─ Trigger: Show 403 error page
    ↓
○ 403 Page Display
    ├─ Header: "Access Denied"
    ├─ Message: Explain permission requirement
    ├─ Actions: [Go Back] [Contact Admin] [Sign Out]
    └─ Context: Show current user role and workspace
    ↓
□ User Recovery Actions
    ├─ Go Back → Return to previous safe page
    ├─ Contact Admin → Email workspace owner
    ├─ Sign Out → Clear session and return to login
    └─ View Permissions → Show current role details
```

### 500 Server Error Flow
```
○ Application Exception Occurs
    ↓
□ Error Boundary Triggered (React + TanStack Router)
    ├─ Catch: Unhandled server/client exception
    ├─ Log: Error details for debugging
    └─ Trigger: Show 500 error page
    ↓
○ 500 Page Display
    ├─ Header: "Something Went Wrong"
    ├─ Message: "We're working to fix this issue"
    ├─ Actions: [Try Again] [Go Home] [Report Issue]
    └─ Error ID: Reference number for support
    ↓
□ User Recovery Actions
    ├─ Try Again → Retry the failed operation
    ├─ Go Home → Navigate to safe dashboard
    ├─ Report Issue → Pre-filled support form
    └─ Wait → Show retry countdown timer
```

### Network Offline Flow
```
○ Network Connection Lost
    ↓
□ Connection Detection (Navigator.onLine + Convex)
    ├─ Monitor: Network connectivity status
    ├─ Detect: Connection lost event
    └─ Trigger: Show offline state
    ↓
○ Offline State Display
    ├─ Banner: "You're currently offline"
    ├─ Message: "Some features may not work"
    ├─ Actions: [Try Again] [Work Offline]
    └─ Status: Last successful connection time
    ↓
□ Automatic Recovery
    ├─ Monitor: Network connectivity restored
    ├─ Retry: Queue failed operations
    ├─ Sync: Update data when back online
    └─ Notify: "You're back online" message
```

### Session Expired Flow
```
○ Session Timeout Occurs
    ↓
□ Authentication Check
    ├─ Check: JWT token expiration
    ├─ Result: Session expired
    └─ Trigger: Show session expired page
    ↓
○ Session Expired Display
    ├─ Header: "Session Expired"
    ├─ Message: "Please sign in again for security"
    ├─ Actions: [Sign In Again] [Go to Login]
    └─ Context: Time since last activity
    ↓
□ Re-authentication Flow
    ├─ Redirect: To login page with return URL
    ├─ Login: Standard authentication process
    ├─ Success: Return to original intended page
    └─ Failure: Remain on login with error message
```

## Secondary User Flows

### Context-Aware 404 Flow
```
○ Document-Specific 404
    ↓
□ URL Pattern Analysis
    ├─ Pattern: /document/[documentId]
    ├─ Context: Document not found in workspace
    └─ Message: "Document not found in your workspace"
    ↓
○ Contextual Actions
    ├─ Go to Documents → Navigate to document library
    ├─ Search Documents → Search with document name
    └─ Contact Support → Pre-filled with document ID
```

### Pro Feature 403 Flow
```
○ Free User Accesses Pro Feature
    ↓
□ Subscription Check
    ├─ User Plan: Free tier detected
    ├─ Feature: Requires Pro subscription
    └─ Message: "This feature requires a Pro subscription"
    ↓
○ Upgrade Prompt Actions
    ├─ Upgrade to Pro → Navigate to billing upgrade
    ├─ View Free Features → Show available features
    └─ Contact Sales → Sales inquiry form
```

### Real-Time Permission Change
```
○ User Permission Revoked While Active
    ↓
□ Real-Time Permission Update (Convex)
    ├─ Event: Permission change notification
    ├─ Check: Current user permissions
    └─ Action: Immediate access revocation
    ↓
○ Graceful Degradation
    ├─ Save: Auto-save current work
    ├─ Notify: "Your access has been changed"
    ├─ Redirect: To appropriate safe page
    └─ Context: Explain permission change
```

## Error Recovery Flows

### Smart Navigation Flow
```
○ Error Context Analysis
    ↓
□ Determine Safe Return Path
    ├─ Document Error → Document list
    ├─ Workspace Error → Workspace switcher
    ├─ Feature Error → Dashboard
    └─ System Error → Homepage
    ↓
○ Navigation Actions
    ├─ Back Button → Context-aware back navigation
    ├─ Breadcrumb → Show path to current location
    └─ Home Button → Always available safe return
```

### Error Reporting Flow
```
○ User Chooses to Report Error
    ↓
□ Error Context Collection
    ├─ URL: Current page when error occurred
    ├─ User: ID and workspace context
    ├─ Browser: User agent and capabilities
    └─ Timestamp: When error occurred
    ↓
○ Support Form Pre-Population
    ├─ Error Details: Technical information pre-filled
    ├─ User Input: "What were you trying to do?"
    ├─ Severity: User-selected impact level
    └─ Contact: User's preferred contact method
```

## Error Prevention Flows

### Proactive Session Management
```
○ Session Near Expiration
    ↓
□ Warning System
    ├─ Time Check: 5 minutes before expiration
    ├─ Warning: "Session expires soon"
    ├─ Action: [Extend Session] [Save and Sign Out]
    └─ Auto-extend: On user activity
```

### Connection Monitoring
```
○ Unstable Connection Detected
    ↓
□ Connection Quality Assessment
    ├─ Monitor: Request response times
    ├─ Detect: Slow or failing requests
    └─ Warning: "Connection seems slow"
    ↓
○ Degraded Experience Mode
    ├─ Reduce: Non-essential requests
    ├─ Cache: Aggressive local caching
    └─ Notify: "Working in offline mode"
```