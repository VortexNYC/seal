# Landing & Onboarding - User Flows

## Primary User Flows

### Regular User Landing Experience

```
○ User Visits seal.nyc
    ↓
□ Hero Landing Page (Clean Design)
    ├─ "Sign documents online in minutes"
    ├─ Simple value proposition for regular users
    ├─ Developer toggle: "Are you a developer? View API docs"
    └─ Clear "Get Started" call to action
    ↓
○ User Engagement Options
    ├─ [Get Started] → Registration & onboarding flow
    ├─ [See Demo] → Interactive demo of signing process
    ├─ [Developers] → Switch to seal.nyc/developers
    └─ [Sign In] → Existing user login
```

### Quick Registration & Onboarding Flow

```
○ User Clicks "Get Started"
    ↓
□ Simple Registration Form
    ├─ Email address
    ├─ Full name
    ├─ Password (with strength indicator)
    └─ Clear messaging: "Create account to start signing"
    ↓
○ Account Created Successfully
    ↓
□ Plan Selection Screen
    ├─ Free Plan: 10 docs/month, 1 user, no API
    ├─ Pro Trial: Unlimited, $10/month per seat after 2 weeks
    ├─ Clear value comparison table
    └─ "You can upgrade anytime" messaging
    ↓
□ Workspace Creation (Simple)
    ├─ Auto-name: "[Name]'s Workspace"
    ├─ Skip complex setup questions
    └─ Focus on getting to first document quickly
    ↓
□ Onboarding Welcome
    ├─ "Let's get your first document signed"
    ├─ Progress indicator (Step 1 of 4)
    └─ Option to skip and explore dashboard
```

### First Document Workflow (Core Onboarding)

```
○ Step 1: Document Upload
    ↓
□ Document Upload Interface
    ├─ Drag & drop area
    ├─ Sample document options for testing
    ├─ File format support (PDF, Word, etc.)
    └─ Progress indicator and tips
    ↓
○ Step 2: Add Signature Fields
    ↓
□ Document Preparation
    ├─ Simple drag-and-drop signature field
    ├─ "Click where you want signature" guidance
    ├─ Real-time document preview
    └─ Field validation and positioning
    ↓
○ Step 3: Add Recipients
    ↓
□ Recipient Management
    ├─ "Send to yourself first" recommendation
    ├─ Add recipient email addresses
    ├─ Optional custom message
    └─ Clear explanation of what happens next
    ↓
○ Step 4: Send Document
    ↓
□ Final Review & Send
    ├─ Document summary preview
    ├─ Recipient confirmation
    ├─ Send button with loading state
    └─ Clear success confirmation
```

### Onboarding Success & Next Steps

```
○ First Document Sent Successfully
    ↓
□ Success Celebration
    ├─ "🎉 Your first document is on its way!"
    ├─ Document tracking interface preview
    ├─ Email notification explanation
    └─ What the recipient will see
    ↓
□ Onboarding Complete Screen
    ├─ Quick wins summary
    ├─ Next suggested actions
    ├─ Dashboard tour option
    └─ Help resources
    ↓
○ Transition to Full App Experience
    ├─ Go to dashboard
    ├─ Upload another document
    ├─ Explore templates
    └─ Invite team members
```

### Progress Tracking & Resumption

```
○ Onboarding Started
    ↓
□ Progress State Management (Convex)
    ├─ Step 1: Document uploaded ✅
    ├─ Step 2: Signature fields added ⏳
    ├─ Step 3: Recipients added ⏸️
    └─ Step 4: Document sent ⏸️
    ↓
□ Smart Resume Experience
    ├─ Return to exact step where left off
    ├─ Brief recap: "You were adding signature fields"
    ├─ Continue with preserved data
    └─ Option to start over if preferred
```

---

## Supporting Flows

### Sample Document Experience

```
○ User Unsure What to Upload
    ↓
□ Sample Document Options
    ├─ "Try with a sample contract"
    ├─ Simple agreement template
    ├─ Employment offer letter
    └─ Basic NDA template
    ↓
○ User Selects Sample
    ↓
□ Pre-configured Tutorial
    ├─ Document with suggested field placements
    ├─ Guided field addition
    ├─ "This is where signatures typically go"
    └─ Encouragement to experiment
```

### Self-Signing Tutorial Flow

```
○ User Wants to Test the Process
    ↓
□ Send to Self Option (Recommended)
    ├─ "Send to your own email to see how it works"
    ├─ Pre-fill recipient with user's email
    ├─ Custom message: "Testing my first document"
    └─ Clear explanation of dual perspective
    ↓
○ Document Sent to Self
    ↓
□ Recipient Experience Preview
    ├─ "Check your email in a few minutes"
    ├─ Screenshot of what recipient email looks like
    ├─ Explanation of signing process
    └─ Return to dashboard to track status
```

### Team Invitation Discovery

```
○ User Completes Personal Onboarding
    ↓
□ Team Features Introduction
    ├─ "Ready to invite your team?"
    ├─ Benefits of team workspace
    ├─ Simple team invitation interface
    └─ Option to skip and do later
    ↓
[If User Interested]
    ↓
□ Team Invitation Flow
    ├─ Add team member emails
    ├─ Set default permissions
    ├─ Send invitations
    └─ Team management overview
```

---

## Error Handling & Recovery Flows

### Document Upload Issues

```
○ Document Upload Fails
    ↓
□ Error Handling
    ├─ Clear error message
    ├─ File format suggestions
    ├─ File size limit guidance
    └─ Alternative upload methods
    ↓
□ Recovery Options
    ├─ [Try Again] → Retry upload
    ├─ [Different File] → Choose another document
    ├─ [Use Sample] → Switch to sample document
    └─ [Get Help] → Support contact
```

### Interrupted Onboarding

```
○ User Leaves Mid-Onboarding
    ↓
□ Return Detection
    ├─ Identify where user left off
    ├─ Preserve uploaded documents
    ├─ Save field placements
    └─ Remember recipient information
    ↓
□ Welcome Back Experience
    ├─ "Welcome back! Let's finish setting up"
    ├─ Progress reminder
    ├─ One-click resume option
    └─ Fresh start alternative
```

### Low Engagement Recovery

```
○ User Showing Hesitation
    ↓
□ Engagement Signals
    ├─ Long pauses between steps
    ├─ Multiple back/forward navigation
    ├─ Hovering without clicking
    └─ Tab switching behavior
    ↓
□ Intervention Options
    ├─ Contextual help tooltips
    ├─ "Need help?" chat option
    ├─ Simplified alternative paths
    └─ Skip to dashboard option
```

---

## Developer Toggle Flow (Separate Path)

### Developer Mode Discovery

```
○ Developer Visits seal.nyc
    ↓
□ Developer Detection & Toggle
    ├─ Prominent "Developers" toggle/dropdown
    ├─ Clear separation from main user flow
    ├─ Direct link to seal.nyc/developers
    └─ No interference with regular onboarding
    ↓
○ Developer Selects Developer Mode
    ↓
□ Redirect to Developer Section
    ├─ seal.nyc/developers landing
    ├─ API reference documentation
    ├─ Code examples in multiple languages
    ├─ Integration examples and webhooks
    └─ Separate developer onboarding/setup
```

---

## Integration Touch Points

### Authentication Integration

- **Seamless Registration**: Simple email/password flow
- **Workspace Creation**: Automatic workspace with sensible defaults
- **Session Persistence**: Maintain onboarding progress across sessions
- **Email Verification**: Handle verification within onboarding flow

### Convex Integration

- **Real-time Progress**: Live step completion tracking
- **Document Storage**: Secure temporary storage during onboarding
- **State Persistence**: Resume onboarding from any step
- **Analytics**: Track completion rates and drop-off points

### React Integration

- **Interactive Components**: Smooth, responsive onboarding experience
- **Progressive Enhancement**: Works on all devices and browsers
- **Accessibility**: Full keyboard and screen reader support
- **Mobile Optimization**: Touch-friendly interface for mobile users

### Document Processing

- **Upload Handling**: Support multiple file formats
- **Preview Generation**: Real-time document preview
- **Field Validation**: Ensure proper signature field placement
- **Template System**: Sample documents for testing and learning
