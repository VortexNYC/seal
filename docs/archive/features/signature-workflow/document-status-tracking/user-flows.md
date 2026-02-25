# Document Status Tracking - User Flows

## Primary Status Tracking Flows

### Initial Status Tracking Flow (After Document Sent)

```
○ Sender Successfully Sends Document to Recipients
    ↓
□ Document Status Tracking Begins
    ├─ Document status changes from "Draft" to "Sent"
    ├─ Status dashboard becomes available
    ├─ Email delivery tracking begins
    └─ Recipients added to tracking interface with "Pending" status
    ↓
○ Sender Accesses Status Dashboard
    ├─ Navigate to document from documents list
    ├─ Status page shows recipient progress
    ├─ Email delivery confirmations displayed
    └─ Overall progress percentage visible
    ↓
□ Status Updates via Email
    ├─ Sender receives email when recipients view document
    ├─ Sender receives email when recipients sign document
    ├─ Sender receives email when document is completed
    └─ Complete audit trail maintained
    ↓
○ Status Tracking Active Until Completion
    ├─ Continuous monitoring until all signatures complete
    ├─ Email reminders sent to recipients based on schedule
    ├─ Email notifications to sender for all status changes
    └─ Complete history available in dashboard
```

### Real-Time Status Update Flow

```
○ Recipient Activity Triggers Status Update
    ↓
□ System Detects Recipient Action
    ├─ Email delivered to recipient inbox
    ├─ Recipient opens document signing link
    ├─ Recipient completes signing process
    └─ Status updated immediately in database
    ↓
○ Status Update Processed
    ├─ Recipient status updated in dashboard
    ├─ Progress calculations updated
    ├─ Status change timestamp recorded
    └─ Email notification prepared for sender
    ↓
□ Sender Receives Email Notification
    ├─ Email sent with status update details
    ├─ Link to view full status dashboard
    ├─ Summary of what recipient completed
    └─ Next steps if any remaining
    ↓
○ Status History Updated
    ├─ Complete audit trail of recipient actions
    ├─ Timestamps for all status changes preserved
    ├─ Status available in dashboard
    └─ Email history maintained
```

---

## Multi-Recipient Progress Tracking

### Parallel Signing Progress Flow

```
○ Document Sent to Multiple Recipients Simultaneously
    ↓
□ All Recipients Show "Pending" Status
    ├─ Each recipient has individual status tracking
    ├─ Email delivery tracked separately for each recipient
    ├─ No dependencies between recipient actions
    └─ Overall progress calculated from all recipients
    ↓
○ Recipients Complete at Different Times
    ├─ First recipient signs - progress updates to 33%
    ├─ Second recipient views document - status shows "Viewed"
    ├─ Third recipient completes - progress updates to 67%
    └─ Each action sends email update to sender
    ↓
□ Progressive Completion Tracking
    ├─ Progress bar shows overall completion in dashboard
    ├─ Individual recipient cards show specific status
    ├─ Remaining recipients clearly identified
    └─ Email updates sent for each milestone
    ↓
○ Final Recipient Completes Document
    ├─ Status changes to "Completed" when last signature received
    ├─ Sender receives completion email notification
    ├─ Final document with all signatures becomes available
    └─ Completion confirmation sent to all parties
```

### Sequential Signing Progress Flow

```
○ Document Sent with Sequential Signing Order
    ↓
□ Only First Recipient Receives Document
    ├─ First recipient status shows "Sent"
    ├─ Subsequent recipients show "Awaiting Turn"
    ├─ Clear indication of signing order displayed
    └─ Progress tracking shows current position in sequence
    ↓
○ First Recipient Completes Signing
    ├─ First recipient status changes to "Completed"
    ├─ Second recipient automatically receives document
    ├─ Second recipient status changes to "Sent"
    └─ Sender receives email update about progression
    ↓
□ Sequential Progress Continues
    ├─ Each completion triggers next recipient invitation
    ├─ Clear visual indication of current signer in dashboard
    ├─ Previous signers remain visible as completed
    └─ Email updates sent for each progression
    ↓
○ Sequential Signing Completes
    ├─ Final recipient completion triggers document completion
    ├─ Complete signing sequence visible in dashboard
    ├─ All signatures collected in proper order
    └─ Final completion email sent to sender
```

---

## Status Monitoring and Email Notifications

### Status Dashboard Monitoring Flow

```
○ Sender Wants to Monitor Document Progress
    ↓
□ Status Dashboard Provides Complete Overview
    ├─ Document overview with current status
    ├─ Individual recipient progress cards
    ├─ Timeline of all status changes
    └─ Action items for sender (send reminders)
    ↓
○ Detailed Recipient Status Information
    ├─ Email delivery status (delivered, bounced, opened)
    ├─ Document access status (not viewed, viewed, signing)
    ├─ Completion status (pending, completed, declined)
    └─ Last activity timestamp for each recipient
    ↓
□ Issue Identification
    ├─ Recipients who haven't opened document after 24 hours
    ├─ Recipients who viewed but haven't signed after 48 hours
    ├─ Email delivery failures requiring attention
    └─ Any recipients who declined to sign
    ↓
○ Available Actions
    ├─ "Send Reminder" buttons for inactive recipients
    ├─ "Contact Recipient" information for follow-up
    ├─ "Download Status Report" for detailed analysis
    └─ Basic document management (cancel if needed)
```

### Email Notification System Flow

```
○ Document Status Change Occurs
    ↓
□ Email Notification Triggered
    ├─ Document viewed by recipient → Email to sender
    ├─ Signature completed by recipient → Email to sender
    ├─ Document fully completed → Email to sender
    └─ Issues requiring attention → Email to sender
    ↓
○ Email Notification Content
    ├─ Clear subject line with document name and status
    ├─ Recipient name and action taken
    ├─ Link to view full status dashboard
    └─ Summary of remaining actions if any
    ↓
□ Email Delivery and Tracking
    ├─ Email sent to sender's registered email address
    ├─ Delivery confirmed through email system
    ├─ Email history maintained in system
    └─ Click-through tracking to dashboard
    ↓
○ Sender Engagement
    ├─ Sender clicks link to view detailed status
    ├─ Sender takes any necessary follow-up actions
    ├─ Sender stays informed throughout process
    └─ Professional communication maintained
```

---

## Reminder and Follow-up Management

### Automated Email Reminder Flow

```
○ Document Sent with Reminder Schedule
    ↓
□ Reminder Schedule Established
    ├─ First reminder after 24 hours if not viewed
    ├─ Second reminder after 48 hours if viewed but not signed
    ├─ Final reminder after 72 hours if still incomplete
    └─ Reminders only sent to recipients who haven't completed
    ↓
○ System Monitors Recipient Progress
    ├─ Track time since document sent to each recipient
    ├─ Monitor individual recipient engagement levels
    ├─ Identify specific recipients falling behind
    └─ Skip reminders for recipients who already completed
    ↓
□ Automated Email Reminders Sent
    ├─ Professional reminder emails sent to inactive recipients
    ├─ Customized message based on recipient status
    ├─ Clear next steps and document link included
    └─ Sender receives confirmation email that reminder was sent
    ↓
○ Reminder Effectiveness Tracking
    ├─ Track if recipient responds to reminder
    ├─ Monitor signing completion after reminders
    ├─ Show reminder history in status dashboard
    └─ Simple analytics on reminder effectiveness
```

### Manual Reminder Flow

```
○ Sender Manually Sends Reminder
    ↓
□ Sender Initiates Manual Reminder
    ├─ "Send Reminder" button on recipient card
    ├─ Option to customize reminder message
    ├─ Immediate sending to specific recipient
    └─ Manual reminder recorded in system
    ↓
○ Manual Reminder Email Sent
    ├─ Email sent directly from system to recipient
    ├─ Document link and status included
    ├─ Custom message from sender if provided
    └─ Professional but personal tone maintained
    ↓
□ Manual Reminder Tracked
    ├─ Manual reminder recorded in document history
    ├─ Sender receives confirmation that reminder was sent
    ├─ Reminder appears in dashboard activity log
    └─ Recipient response tracked if they engage
    ↓
○ Follow-up Results
    ├─ Higher completion rates from targeted reminders
    ├─ Recipient issues addressed through additional contact
    ├─ Professional communication maintained
    └─ Document completion facilitated
```

---

## Document Completion

### Document Completion Flow

```
○ Final Recipient Completes Document Signing
    ↓
□ System Detects Complete Document
    ├─ All required signatures collected
    ├─ All required fields completed
    ├─ Document status changes to "Completed"
    └─ Completion timestamp recorded
    ↓
○ Completion Processing
    ├─ Final document PDF generated with all signatures
    ├─ Completion record created with audit trail
    ├─ Document archived with complete history
    └─ Completion email prepared
    ↓
□ Completion Email Notifications Sent
    ├─ Sender receives completion confirmation email
    ├─ All recipients receive final document copy via email
    ├─ Completion details and reference numbers provided
    └─ Download links for final document included
    ↓
○ Post-Completion Access
    ├─ Completed document available for download in dashboard
    ├─ Complete audit trail available in status history
    ├─ Document stored in sender and recipient accounts
    └─ Professional completion record maintained
```

---

## Error Handling

### Email Delivery Failure Handling Flow

```
○ System Detects Email Delivery Failure
    ↓
□ Delivery Issue Analysis
    ├─ Bounce reason identified (invalid email, full inbox, etc.)
    ├─ Recipient status updated to show delivery failure
    ├─ Sender notified via email of delivery problem
    └─ Recommended actions provided
    ↓
○ Issue Resolution Options
    ├─ Update recipient email address in dashboard
    ├─ Contact recipient through alternative means
    ├─ Retry delivery with corrected information
    └─ Replace recipient if necessary
    ↓
□ Resolution Implementation
    ├─ Sender updates recipient information
    ├─ Document re-sent with corrected email address
    ├─ Status tracking resumes with new delivery attempt
    └─ Issue resolution recorded in document history
    ↓
○ Successful Resolution
    ├─ Document successfully delivered to corrected address
    ├─ Normal signing process continues
    ├─ Issue resolution documented
    └─ Professional handling maintained
```

### Document Cancellation Flow

```
○ Sender Needs to Cancel Document Process
    ↓
□ Cancellation Available in Dashboard
    ├─ "Cancel Document" option in status dashboard
    ├─ Cancellation confirmation dialog
    ├─ Impact on recipients explained
    └─ Confirmation required for cancellation
    ↓
○ Cancellation Processing
    ├─ Document status changed to "Cancelled"
    ├─ All recipients notified via email of cancellation
    ├─ Signing links deactivated immediately
    └─ Professional cancellation message sent
    ↓
□ Post-Cancellation Management
    ├─ Document archived with cancellation status
    ├─ History preserved for reference
    ├─ Recipients receive clear communication
    └─ Sender can create new document if needed
    ↓
○ Professional Cancellation Communication
    ├─ Recipients understand cancellation reason
    ├─ Clear communication about next steps
    ├─ Professional relationship maintained
    └─ Option to restart process if needed
```

This simplified status tracking focuses on essential MVP functionality: email notifications only, per-recipient tracking, and core status monitoring without complex features like deadline extensions.
