# Document Sending - User Flows

## Primary Document Sending Flows

### Final Review and Send Flow (After Field Placement)
```
○ User Has Completed Field Placement
    ↓
□ User Initiates Document Sending
    ├─ Field placement shows "Review and Send Document" button
    ├─ All signature fields assigned to recipients
    ├─ Recipients configured with roles and signing order
    └─ Document ready for final review and sending
    ↓
○ User Reviews Complete Document
    ├─ PDF preview with all signature fields visible
    ├─ Field-to-recipient assignments clearly marked with colors
    ├─ Recipient summary showing all signers and workflow
    └─ Final opportunity to make changes before sending
    ↓
□ User Composes Custom Messages
    ├─ Individual message for each recipient
    ├─ Message templates available for common scenarios
    ├─ Personalized subject lines and content
    └─ Professional tone guidance and suggestions
    ↓
○ User Sends Document for Signatures
    ├─ Final sending confirmation with recipient list
    ├─ Email delivery via Resend to all recipients
    ├─ Real-time sending progress feedback
    └─ Document status changes to "Sent" with delivery tracking
```

### Quick Send Flow (Minimal Customization)
```
○ User Wants to Send Document Quickly
    ↓
□ User Chooses Quick Send Option
    ├─ "Send with Default Messages" option available
    ├─ Pre-written professional messages for each recipient
    ├─ No need to write custom messages
    └─ Faster workflow for routine documents
    ↓
○ User Confirms Quick Send
    ├─ Preview of default messages to be sent
    ├─ List of recipients who will receive document
    ├─ Single click confirmation to send
    └─ Document sent immediately with standard messaging
    ↓
□ Document Sent Successfully
    ├─ Delivery confirmation for all recipients
    ├─ Status tracking begins immediately
    ├─ Sender receives confirmation notification
    └─ Recipients receive signing invitations
```

---

## Document Review and Verification

### Complete Document Review Flow
```
○ User Needs to Verify Document Before Sending
    ↓
□ User Reviews Document Completeness
    ├─ PDF preview shows all pages and content
    ├─ All signature fields visible and properly positioned
    ├─ Field assignments to recipients clearly marked
    └─ Color-coded fields match recipient assignments
    ↓
○ User Verifies Recipient Configuration
    ├─ Recipient list shows all signers, CC, and reviewers
    ├─ Signing order confirmed (parallel or sequential)
    ├─ Email addresses validated and correct
    └─ Recipient roles properly assigned
    ↓
□ User Checks Field Assignments
    ├─ Every required field assigned to a recipient
    ├─ No unassigned signature fields remaining
    ├─ Field types appropriate for recipients
    └─ Visual confirmation of complete field mapping
    ↓
○ Review Complete and Validated
    ├─ Document ready for message composition
    ├─ No missing assignments or configuration errors
    ├─ Professional presentation verified
    └─ Ready to proceed to custom messaging
```

### Edit During Review Flow
```
○ User Finds Issue During Document Review
    ↓
□ User Identifies Needed Changes
    ├─ Missing signature field discovered
    ├─ Recipient information needs updating
    ├─ Field assignment needs modification
    └─ Document content requires adjustment
    ↓
○ User Returns to Previous Steps
    ├─ "Edit Recipients" to modify recipient information
    ├─ "Edit Fields" to add or modify signature fields
    ├─ "Back to Processing" to change document
    └─ Seamless navigation to fix identified issues
    ↓
□ User Makes Necessary Corrections
    ├─ Updates made in appropriate workflow step
    ├─ Changes reflected in document review
    ├─ Returns to sending interface with corrections
    └─ Review process continues with updated information
    ↓
○ Corrections Verified and Review Complete
    ├─ Issues resolved and document updated
    ├─ Ready to proceed with sending process
    ├─ Professional quality maintained
    └─ Confidence in document accuracy
```

---

## Custom Message Composition

### Individual Recipient Messaging Flow
```
○ User Wants Personalized Messages for Each Recipient
    ↓
□ User Composes Custom Messages
    ├─ Message composer for each recipient individually
    ├─ Recipient name and role shown for context
    ├─ Message templates available as starting points
    └─ Real-time character count and professional tone suggestions
    ↓
○ User Personalizes Each Message
    ├─ Specific instructions for each recipient's role
    ├─ Context about why they're signing the document
    ├─ Deadline information if applicable
    └─ Contact information for questions
    ↓
□ User Reviews All Messages
    ├─ Preview all recipient messages before sending
    ├─ Consistent tone and professional presentation
    ├─ All necessary information included
    └─ No errors or inappropriate content
    ↓
○ Messages Ready for Sending
    ├─ All recipients have personalized messages
    ├─ Professional presentation maintained
    ├─ Clear instructions provided to each recipient
    └─ Ready for document delivery
```

### Message Template Usage Flow
```
○ User Wants to Use Professional Message Templates
    ↓
□ User Selects Message Template
    ├─ Templates available for different document types
    ├─ "Contract Signing", "Agreement Review", "Approval Request"
    ├─ Professional language and appropriate tone
    └─ Customizable templates with merge fields
    ↓
○ User Customizes Template Content
    ├─ Recipient name automatically inserted
    ├─ Document name and type filled in
    ├─ Custom message sections available for personalization
    └─ Template maintains professional structure
    ↓
□ User Applies Template to Recipients
    ├─ Same template can be used for multiple recipients
    ├─ Individual customization available per recipient
    ├─ Consistent messaging across all recipients
    └─ Time-saving approach for standard documents
    ↓
○ Template Messages Ready
    ├─ Professional, consistent messaging
    ├─ Personalized where appropriate
    ├─ Efficient message composition process
    └─ Ready for document delivery
```

---

## Document Sending and Delivery

### Standard Document Sending Flow
```
○ User Ready to Send Document with Custom Messages
    ↓
□ User Confirms Sending Details
    ├─ Final recipient list review
    ├─ Message preview for each recipient
    ├─ Signing workflow confirmation (parallel/sequential)
    └─ Delivery method confirmation (email via Resend)
    ↓
○ User Initiates Document Sending
    ├─ "Send Document" confirmation dialog
    ├─ Estimated delivery time shown
    ├─ Final opportunity to cancel or modify
    └─ Single click to begin delivery process
    ↓
□ Document Sending Process
    ├─ Real-time sending progress for each recipient
    ├─ Email delivery via Resend API
    ├─ Individual delivery status per recipient
    └─ Visual progress indicator during sending
    ↓
○ Sending Complete with Confirmation
    ├─ "Document sent successfully" confirmation
    ├─ Delivery status for each recipient
    ├─ Document status changes to "Awaiting Signatures"
    └─ Status tracking interface now available
```

### Delivery Status Tracking Flow
```
○ Document Sent Successfully
    ↓
□ User Monitors Delivery Status
    ├─ Real-time delivery confirmations via Resend webhooks
    ├─ "Delivered", "Opened", "Viewed" status per recipient
    ├─ Failed delivery notifications and retry options
    └─ Delivery timeline tracking
    ↓
○ User Receives Engagement Notifications
    ├─ "John opened the document" notifications
    ├─ "Sarah viewed the signature fields" updates
    ├─ Real-time progress as recipients engage
    └─ Clear visibility into document progress
    ↓
□ User Tracks Signing Progress
    ├─ "Signed by John Smith" completion notifications
    ├─ Remaining signatures needed clearly shown
    ├─ Sequential workflow progress (if applicable)
    └─ Estimated completion timeline updates
    ↓
○ Document Completion Notification
    ├─ "All signatures completed" final notification
    ├─ Signed document available for download
    ├─ Completion audit trail available
    └─ Workflow successfully completed
```

---

## Deadline and Reminder Management

### Signing Deadline Setup Flow
```
○ User Wants to Set Signing Deadlines
    ↓
□ User Configures Deadline Settings
    ├─ Optional deadline date selection
    ├─ Deadline applies to all recipients or individual recipients
    ├─ Reasonable deadline validation (minimum 24 hours)
    └─ Automatic reminder schedule configuration
    ↓
○ User Sets Up Reminder Schedule
    ├─ Reminder timing options (3 days, 1 day, same day)
    ├─ Custom reminder frequency if needed
    ├─ Reminder message customization
    └─ Automatic vs manual reminder preferences
    ↓
□ Deadline Information Added to Messages
    ├─ Deadline date included in recipient messages
    ├─ Urgency communicated appropriately
    ├─ Clear expectations set for recipients
    └─ Professional deadline communication
    ↓
○ Document Sent with Deadline Tracking
    ├─ Deadline countdown begins
    ├─ Automatic reminders scheduled
    ├─ Deadline status visible in document tracking
    └─ Proactive deadline management enabled
```

### Reminder Management Flow
```
○ Document Has Deadline with Automatic Reminders
    ↓
□ System Sends Scheduled Reminders
    ├─ Automatic reminder emails via Resend
    ├─ Professional reminder messaging
    ├─ Escalating urgency as deadline approaches
    └─ Individual reminders per recipient based on status
    ↓
○ User Monitors Reminder Effectiveness
    ├─ Reminder delivery status tracking
    ├─ Recipient engagement after reminders
    ├─ Response rates and signing progress
    └─ Reminder impact on completion rates
    ↓
□ User Manages Deadline Extensions
    ├─ Option to extend deadline if needed
    ├─ Notify recipients of deadline changes
    ├─ Maintain professional communication
    └─ Update tracking and reminder schedules
    ↓
○ Deadline Management Complete
    ├─ Document completed within deadline or extended appropriately
    ├─ Professional relationship maintained
    ├─ Clear audit trail of deadline management
    └─ Successful completion or appropriate follow-up
```

---

## Mobile Sending Experience

### Mobile Document Sending Flow
```
○ Mobile User Ready to Send Document
    ↓
□ Mobile Document Review
    ├─ Touch-friendly PDF preview
    ├─ Swipe navigation between pages
    ├─ Pinch-to-zoom for field verification
    └─ Clear recipient and field assignment visibility
    ↓
○ Mobile Message Composition
    ├─ Mobile-optimized message composer
    ├─ Touch keyboard friendly interface
    ├─ Message template selection
    └─ Voice-to-text message composition
    ↓
□ Mobile Sending Confirmation
    ├─ Touch-friendly confirmation interface
    ├─ Large send button and clear recipient list
    ├─ Simple confirmation flow
    └─ Mobile-optimized progress indicators
    ↓
○ Mobile Status Tracking
    ├─ Real-time notifications on mobile device
    ├─ Touch-friendly status dashboard
    ├─ Mobile-optimized tracking interface
    └─ Push notifications for key status changes
```

---

## Error Handling and Recovery

### Sending Failure Recovery Flow
```
○ Email Delivery Failure Detected
    ↓
□ User Notified of Delivery Issues
    ├─ Resend webhook failure notification
    ├─ Specific failure reason (bounce, invalid email)
    ├─ Affected recipients clearly identified
    └─ Immediate notification of delivery problems
    ↓
○ User Reviews Delivery Failures
    ├─ Delivery status dashboard shows failures
    ├─ Failure reasons explained clearly
    ├─ Options for resolution provided
    └─ Guidance on next steps
    ↓
□ User Resolves Delivery Issues
    ├─ Update recipient email addresses if bounced
    ├─ Retry sending to failed recipients
    ├─ Contact recipients through alternative methods
    └─ Maintain document workflow progress
    ↓
○ Delivery Issues Resolved
    ├─ Successful delivery to all recipients
    ├─ Document workflow continues normally
    ├─ Professional relationship maintained
    └─ Audit trail of resolution maintained
```

### Network Interruption Recovery Flow
```
○ Network Interruption During Sending
    ↓
□ System Detects Partial Sending Failure
    ├─ Some recipients received, others didn't
    ├─ Sending status accurately tracked
    ├─ Clear indication of completion status
    └─ No duplicate sending to successful recipients
    ↓
○ User Resumes Sending Process
    ├─ "Resume Sending" option available
    ├─ Only send to recipients who didn't receive document
    ├─ Maintain consistency in document status
    └─ Complete sending process from interruption point
    ↓
□ Sending Process Completed Successfully
    ├─ All recipients receive document
    ├─ No confusion about document status
    ├─ Professional delivery maintained
    └─ Full workflow integrity preserved
```

This comprehensive document sending flow ensures professional, reliable delivery with complete customization options and robust error handling while maintaining the simple, clean workflow from recipients through field placement to final document delivery.