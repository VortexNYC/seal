# Recipient Management - User Flows

## Primary Recipient Setup Flows

### Initial Recipient Setup Flow (After Document Processing)
```
○ User's Document Processing Complete
    ↓
□ User Begins Recipient Configuration
    ├─ Document processing shows "Configure Recipients" as next step
    ├─ Click "Configure Recipients" before field placement
    ├─ Recipient setup interface opens
    └─ "Who needs to sign this document?" prompt
    ↓
○ User Adds First Recipient
    ├─ Click "Add Recipient" to open recipient form
    ├─ Enter recipient name and email address
    ├─ Choose recipient role (Signer, CC, Reviewer)
    └─ Recipient added to list
    ↓
□ User Adds Additional Recipients
    ├─ Add more recipients as needed
    ├─ Each recipient gets a role and position in workflow
    ├─ No limits on number of recipients
    └─ All recipients configured before field placement
    ↓
○ Recipients Setup Complete
    ├─ All necessary recipients added
    ├─ Signing workflow configured
    ├─ "Continue to Add Signature Fields" button appears
    └─ Smooth transition to field placement with recipients ready
```

### Multiple Recipients and Signing Order Flow
```
○ User Needs Multiple Signers with Specific Order
    ↓
□ User Configures Signing Workflow
    ├─ Add all required recipients first
    ├─ Choose signing workflow type:
    ├─ "Everyone signs at the same time" (Parallel)
    └─ "Specific signing order required" (Sequential)
    ↓
○ User Sets Sequential Signing Order
    ├─ Drag recipients to arrange signing sequence
    ├─ First recipient signs, then second, then third, etc.
    ├─ Visual workflow shows signing dependencies
    └─ Each recipient knows their position in sequence
    ↓
□ Signing Order Configured
    ├─ Sequential workflow set up correctly
    ├─ Recipients understand they'll receive document in order
    ├─ Clear visual indication of signing flow
    └─ Ready to proceed to field placement
```

---

## Recipient Role Management

### Assign Recipient Roles Flow
```
○ User Setting Up Different Types of Recipients
    ↓
□ User Chooses Appropriate Roles
    ├─ "Signer" → Will complete signature fields
    ├─ "CC" → Receives copy, no signing required
    ├─ "Reviewer" → Can view and provide feedback
    └─ Each recipient assigned appropriate role
    ↓
○ Role-Based Workflow Setup
    ├─ Only "Signer" recipients will be assigned signature fields
    ├─ "CC" recipients receive final completed document
    ├─ "Reviewer" recipients get access during signing process
    └─ Workflow adapts to recipient role requirements
    ↓
□ Recipients and Roles Ready
    ├─ All recipients have appropriate roles assigned
    ├─ Workflow configured based on role requirements
    ├─ Ready to place fields knowing who will sign what
    └─ Clear foundation for field assignment
```

---

## Recipient Information Management

### Edit Recipient Details Flow
```
○ User Needs to Modify Recipient Information
    ↓
□ User Updates Recipient
    ├─ Click on recipient in list to edit
    ├─ Modify name, email, role, or signing order
    ├─ Changes saved automatically
    └─ Workflow updated with new information
    ↓
○ Recipient Information Updated
    ├─ Updated information reflected in workflow
    ├─ Signing order adjusted if role changed
    ├─ Ready to continue with field placement
    └─ Recipient changes preserved for field assignment
```

### Remove Recipient Flow
```
○ User Needs to Remove Recipient
    ↓
□ User Removes Recipient from Workflow
    ├─ Select recipient and click remove
    ├─ "Remove [Name] from document?" confirmation
    ├─ Recipient removed from signing workflow
    └─ Signing order automatically adjusts for remaining recipients
    ↓
○ Workflow Updated Without Recipient
    ├─ Signing sequence updated
    ├─ Remaining recipients maintain their roles
    ├─ Document workflow simplified
    └─ Ready to continue with current recipient list
```

---

## Transition to Field Placement

### From Recipients to Field Placement Flow
```
○ User Has All Recipients Configured
    ↓
□ User Ready to Place Signature Fields
    ├─ Recipients list complete with roles and order
    ├─ Workflow type selected (parallel vs sequential)
    ├─ All recipients identified and configured
    └─ "Continue to Add Signature Fields" button active
    ↓
○ Smooth Transition to Field Placement
    ├─ Click to move to field placement interface
    ├─ Recipients carried forward to field assignment
    ├─ Field placement interface shows recipient list
    └─ Ready to assign fields to specific recipients
    ↓
□ Field Placement with Recipient Context
    ├─ Each field can be assigned to specific recipients
    ├─ Recipient colors used for field identification
    ├─ Only "Signer" recipients available for field assignment
    └─ Field placement informed by recipient setup
```

---

## Email Validation and Data Management

### Email Validation Flow
```
○ User Enters Email Addresses for Recipients
    ↓
□ Real-Time Email Validation
    ├─ Email format checked as user types
    ├─ "Valid email" or "Invalid format" feedback
    ├─ Common typo suggestions provided
    └─ Cannot proceed with invalid emails
    ↓
○ Email Validation Complete
    ├─ All recipient emails properly formatted
    ├─ Ready for successful document delivery when sent
    ├─ Reduced bounce rates from valid emails
    └─ Recipients properly configured for signing invitations
```

### Duplicate Recipients Handling Flow
```
○ User Accidentally Adds Same Email Twice
    ↓
□ System Prevents Duplicate Recipients
    ├─ "This email is already added" warning
    ├─ Show existing recipient with same email
    ├─ Option to edit existing recipient instead
    └─ Clean recipient list maintained
    ↓
○ Duplicate Resolved
    ├─ User edits existing recipient or uses different email
    ├─ No duplicate recipients in workflow
    ├─ Clear recipient management maintained
    └─ Each email appears only once in recipient list
```

---

## Mobile Recipient Management

### Mobile Recipient Setup Flow
```
○ Mobile User Setting Up Recipients
    ↓
□ Mobile-Optimized Recipient Interface
    ├─ Touch-friendly recipient addition form
    ├─ Large input fields for name and email
    ├─ Simple role selection with large buttons
    └─ Easy signing order arrangement
    ↓
○ Mobile Recipient Configuration
    ├─ Add recipients using mobile-friendly interface
    ├─ Touch and drag to arrange signing order
    ├─ Role assignment with clear mobile controls
    └─ All recipient setup completed on mobile
    ↓
□ Mobile Setup Complete
    ├─ All recipients configured using mobile interface
    ├─ Signing workflow set up correctly
    ├─ Ready to transition to mobile field placement
    └─ Consistent experience with desktop version
```

---

## Error Handling and Recovery

### Invalid Email Recovery Flow
```
○ User Gets Email Validation Error
    ↓
□ Clear Error Guidance
    ├─ Specific error message for invalid email format
    ├─ Suggestions for common corrections
    ├─ Examples of valid email formats shown
    └─ Real-time validation as user corrects
    ↓
○ Email Corrected Successfully
    ├─ Green checkmark when email becomes valid
    ├─ User can continue with recipient setup
    ├─ No interruption to main workflow
    └─ Smooth continuation to next recipient or field placement
```

### Recipient Setup Validation Flow
```
○ User Tries to Proceed Without Required Recipients
    ↓
□ Setup Validation Check
    ├─ "At least one signer required" message if no signers
    ├─ Sequential order validation for complex workflows
    ├─ Role assignment verification
    └─ Cannot proceed until requirements met
    ↓
○ Requirements Met
    ├─ All validation passes
    ├─ User can proceed to field placement
    ├─ Recipients properly configured for workflow
    └─ Strong foundation for successful document signing
```

---

## Workflow Integration

### Recipients to Field Assignment Flow
```
○ User Completes Recipient Setup
    ↓
□ Recipients Information Available for Field Placement
    ├─ Field placement interface shows recipient list
    ├─ Each recipient has unique color coding
    ├─ Only "Signer" recipients can receive field assignments
    └─ "CC" and "Reviewer" recipients noted but not assigned fields
    ↓
○ Field Assignment with Recipient Context
    ├─ Place signature fields knowing who will sign
    ├─ Assign fields to specific recipients during placement
    ├─ Visual confirmation of field-to-recipient assignments
    └─ Complete workflow from recipients to fields
```

### Recipient Setup Foundation for Later Steps
```
○ User Has Recipients Configured
    ↓
□ Recipients Ready for Field Assignment
    ├─ All recipients identified with roles and order
    ├─ Signing workflow established (parallel vs sequential)
    ├─ Foundation set for field placement phase
    └─ Recipients will be available for final sending configuration
    ↓
○ Recipients Carry Through Entire Workflow
    ├─ Field assignment uses recipient list
    ├─ Final sending uses recipients for custom messages and delivery
    ├─ Status tracking follows recipient progress
    └─ Recipients configured once, used throughout entire process
```

This streamlined recipient management focuses purely on the essential setup: who needs to sign, what role they have, and in what order they'll sign. Custom messages and final sending details are handled in later workflow steps.