# First-Time Workspace Creation Wireframes - All States

## Screen States & Wireframes

### 🟢 Plan Selection State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                          🚀 Choose Your Plan                                ║
║                       (text-2xl font-semibold)                               ║
║                                                                               ║
║                   Select a plan to create your workspace                     ║
║                        (text-muted-foreground)                               ║
║                                                                               ║
║  ╔═══════════════════════════════════╗ ╔═══════════════════════════════════╗ ║
║  ║           🆓 FREE                 ║ ║          🚀 PRO TRIAL             ║ ║
║  ║    (Card: variant="outline")      ║ ║   (Card: variant="default")       ║ ║
║  ║                                   ║ ║                                   ║ ║
║  ║  ✅ 10 documents per month        ║ ║  ✅ Unlimited documents           ║ ║
║  ║  ✅ 1 user workspace              ║ ║  ✅ Unlimited team members        ║ ║
║  ║  ✅ All core signing features     ║ ║  ✅ Full API access               ║ ║
║  ║  ✅ Electronic signatures         ║ ║  ✅ Advanced workflows            ║ ║
║  ║  ✅ Document templates            ║ ║  ✅ Priority support              ║ ║
║  ║                                   ║ ║                                   ║ ║
║  ║      Perfect to get started       ║ ║   $10/month per seat after trial ║ ║
║  ║                                   ║ ║        (2-week free trial)        ║ ║
║  ║                                   ║ ║                                   ║ ║
║  ║ ┏━[BUTTON: variant="outline"]━━━┓ ║ ║ ┏━[BUTTON: variant="default"]━━━┓ ║ ║
║  ║ ┃      Start with Free          ┃ ║ ║ ┃     Start Pro Trial           ┃ ║ ║
║  ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║ ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║ ║
║  ╚═══════════════════════════════════╝ ╚═══════════════════════════════════╝ ║
║                                                                               ║
║                    You can upgrade or downgrade anytime                      ║
║                           (text-sm text-muted-foreground)                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Full-width Card component with elevation shadow
- **Logo Area**: Brand logo, fixed height 48px (h-12)
- **Header**: 
  - Title: "🚀 Choose Your Plan" (text-2xl font-semibold)
  - Subtitle: "Select a plan to create your workspace" (text-muted-foreground)

### Plan Cards Layout
- **Grid**: Two-column equal width (grid-cols-2 gap-6)
- **FREE Plan Card**:
  - Border: Card with outline variant (border-2 border-border)
  - Header: "🆓 FREE" with badge styling
  - Features: List with ✅ checkmark icons
  - CTA: Button with outline variant
- **PRO TRIAL Card**:
  - Style: Elevated card with default variant (shadow-lg)
  - Header: "🚀 PRO TRIAL" with accent styling
  - Pricing: Emphasized pricing text
  - CTA: Primary button with default variant

### Interactive Elements
- **Buttons**: 
  - Free Plan: variant="outline" size="lg" class="w-full"
  - Pro Trial: variant="default" size="lg" class="w-full"
- **Hover States**: Cards lift with shadow increase on hover
- **Focus States**: Keyboard navigation with visible focus rings

### Responsive Design
- **Desktop**: Two-column card layout (1200px+)
- **Tablet**: Two-column stacked (768px+)
- **Mobile**: Single column (< 768px)

### 🟢 Welcome & Workspace Setup State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                         🎉 Welcome to Seal!                                 ║
║                        (text-2xl font-semibold)                              ║
║                                                                               ║
║                  Let's set up your workspace to get started.                 ║
║                           (text-muted-foreground)                            ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Workspace Name                                                        │   ║
║    └───────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="text" class="w-full"]═══════════════════════════════════╗   ║
║    ║ My Workspace                                               ✅        ║   ║
║    ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║    ┌─[HELP TEXT: text-sm text-muted-foreground]─────────────────────────┐   ║
║    │ 💡 You can change this later in settings                           │   ║
║    └───────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║    ┃                    [BUTTON: variant="default" size="lg"]              ┃   ║
║    ┃                         Create Workspace                             ┃   ║
║    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║              ┌─[INFO ALERT: variant="default"]─────────────────────────┐     ║
║              │ ℹ️  You'll be the owner with full access                │     ║
║              └───────────────────────────────────────────────────────────┘     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Card component with padding-6 and subtle border
- **Logo Area**: Brand logo centered, height 48px
- **Welcome Section**:
  - Title: "🎉 Welcome to Seal!" (text-2xl font-semibold text-center)
  - Subtitle: Instructional text (text-muted-foreground text-center)

### Form Elements
- **Workspace Name Field**:
  - Label: FormLabel component with medium font weight
  - Input: FormField with Input component
  - Type: text, full width, border-input
  - Validation: Real-time name availability check
  - Success Icon: Green checkmark (✅) when valid
  - Help Text: Muted guidance text below input

### Action Elements
- **Create Button**: 
  - variant="default" size="lg" class="w-full mt-6"
  - Primary action, full width
  - Disabled until valid workspace name entered

### Information Display
- **Owner Info Alert**:
  - Alert component with info icon
  - variant="default" (light blue background)
  - Clear ownership explanation

### Interaction States
- **Input Focus**: Blue border and shadow focus ring
- **Button Hover**: Slight color darkening and shadow
- **Loading**: Button shows spinner and disabled state
- **Validation**: Real-time feedback on workspace name

### 🟢 Corporate Email Detection State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                      🏢 Team Workspace Recommended                           ║
║                         (text-2xl font-semibold)                             ║
║                                                                               ║
║                We noticed you signed up with a company email.                ║
║                 Would you like to create a team workspace?                   ║
║                           (text-muted-foreground)                            ║
║                                                                               ║
║                      ┌─[EMAIL BADGE: variant="secondary"]─┐                  ║
║                      │    john.doe@acmecorp.com           │                  ║
║                      └────────────────────────────────────┘                  ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Workspace Name                                                        │   ║
║    └───────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="text" class="w-full" prefilled]════════════════════════╗   ║
║    ║ Acme Corporation                                           ✅        ║   ║
║    ╚═══════════════════════════════════════════════════════════════════════════╝   ║
║    ┌─[HELP TEXT: text-sm text-muted-foreground]─────────────────────────┐   ║
║    │ 💡 Auto-suggested from your email domain                           │   ║
║    └───────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║    ┃                 [BUTTON: variant="default" size="lg"]                ┃   ║
║    ┃                      Create Team Workspace                           ┃   ║
║    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                  ╭─[BUTTON: variant="link" class="text-sm"]─╮                 ║
║                  │        Create Personal Workspace Instead        │         ║
║                  ╰─────────────────────────────────────────────────╯         ║
║                                                                               ║
║              ┌─[INFO ALERT: variant="default"]─────────────────────────┐     ║
║              │ 🚀 Team features: Collaboration, shared templates,    │     ║
║              │                   centralized billing                  │     ║
║              └───────────────────────────────────────────────────────────┘     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Card with elevated styling and padding
- **Header Section**:
  - Icon: 🏢 building emoji for team context
  - Title: "Team Workspace Recommended" (text-2xl font-semibold)
  - Description: Two-line explanation (text-muted-foreground)

### Email Detection Display
- **Email Badge**: 
  - Badge component with secondary variant
  - Shows detected company email
  - Centered positioning with subtle background

### Form Interface
- **Workspace Name Field**:
  - Pre-filled with company name extracted from email domain
  - Auto-suggestion algorithm based on email domain
  - Real-time validation with success checkmark
  - Help text explaining auto-suggestion

### Action Hierarchy
- **Primary Action**: "Create Team Workspace" button
  - variant="default" size="lg" class="w-full"
  - Recommended action prominently displayed
- **Secondary Action**: "Create Personal Workspace Instead" link
  - variant="link" with smaller text size
  - Alternative option less prominent

### Feature Highlight
- **Team Benefits Alert**:
  - Info alert showcasing team workspace benefits
  - Rocket emoji for excitement
  - Key features: Collaboration, templates, billing

### Smart Detection Logic
- **Email Analysis**: Corporate domain detection
- **Name Generation**: Company name extraction from domain
- **Recommendation**: Contextual workspace type suggestion

### 🟡 Creating Workspace State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ⏳ Setting Up Your Workspace                         │
│                                                                             │
│                              Acme Corporation                              │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [███████████████████████████████░░░░░] 85%                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ✅ Workspace created                                │
│                         ✅ Owner permissions assigned                       │
│                         ✅ Security settings configured                     │
│                         ⏳ Preparing dashboard...                           │
│                                                                             │
│                      This should take just a moment!                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Workspace Created - Next Steps State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       ✅ Workspace Created Successfully!                    │
│                                                                             │
│                            🏢 Acme Corporation                              │
│                          Owner: John Doe                                   │
│                                                                             │
│              What would you like to do first?                              │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              📄 Upload and Send Your First Document                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              👥 Invite Team Members                                 │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │              📋 Create Document Template                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Skip - Go to Dashboard>                           │
│                                                                             │
│              🎯 Complete your first document to unlock more features        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔵 Team Invitation State (Optional)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       👥 Invite Your Team                                   │
│                                                                             │
│                     Add teammates to Acme Corporation                      │
│                                                                             │
│    Team Member Email Addresses (one per line)                              │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ sarah@acmecorp.com                                                  │  │
│    │ mike@acmecorp.com                                                   │  │
│    │ lisa@acmecorp.com                                                   │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    Default Role for New Members                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Member ▼                                                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Send Invitations                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         <Skip - Do This Later>                             │
│                                                                             │
│              💡 You can invite more teammates anytime                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟡 Sending Invitations State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       📧 Sending Team Invitations                           │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │  [████████████████████░░░░░░░░░] 70%                               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         ✅ sarah@acmecorp.com sent                          │
│                         ✅ mike@acmecorp.com sent                           │
│                         ⏳ lisa@acmecorp.com sending...                     │
│                                                                             │
│                      Sending invitation emails...                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🟢 Invitations Sent - Welcome to Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         🎉 All Set Up!                                     │
│                                                                             │
│                      ✅ Workspace: Acme Corporation                         │
│                      ✅ 3 team invitations sent                             │
│                      ✅ You're ready to start signing                       │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                   Go to Dashboard                                   │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│              📧 Your teammates will receive invitation emails               │
│                                                                             │
│              🚀 Next Steps:                                                 │
│              • Upload your first document                                  │
│              • Add signature fields                                        │
│              • Send for signature                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 Workspace Creation Error State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     ❌ Workspace Creation Failed                             │
│                                                                             │
│              Something went wrong while creating your workspace.            │
│                        Please try again in a moment.                       │
│                                                                             │
│                            Acme Corporation                                │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                        Try Again                                    │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                        <Use Different Name>                                │
│                         <Contact Support>                                  │
│                                                                             │
│              If the problem persists, please contact support.              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚪ Workspace Name Conflict State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          [LOGO] Seal                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    🏢 Workspace Name Already Exists                         │
│                                                                             │
│              A workspace with this name already exists.                    │
│                    Please choose a different name.                         │
│                                                                             │
│    Workspace Name                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ Acme Corporation                                       ❌          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    ❌ This workspace name is already taken                                 │
│                                                                             │
│    Suggested alternatives:                                                  │
│    • Acme Corporation - Sales                                              │
│    • Acme Corp                                                             │
│    • Acme Corporation 2024                                                 │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    Try Different Name                               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Workspace Setup

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│ 🎉 Welcome!             │
│                         │
│ Set up workspace:       │
│                         │
│ Workspace Name          │
│ ┌─────────────────────┐ │
│ │ My Workspace    ✅  │ │
│ └─────────────────────┘ │
│                         │
│ Use case:               │
│ (•) Personal docs       │
│ ( ) Small business      │
│ ( ) Medium business     │
│ ( ) Enterprise          │
│                         │
│ ┌─────────────────────┐ │
│ │ Create Workspace    │ │
│ └─────────────────────┘ │
│                         │
│ ℹ️ You'll be the owner   │
│                         │
└─────────────────────────┘
```

### 📱 Mobile Team Invitation

```
┌─────────────────────────┐
│    [LOGO] Seal      │
│      Alternative        │
├─────────────────────────┤
│                         │
│ 👥 Invite Team          │
│                         │
│ Add to Acme Corp:       │
│                         │
│ Team Emails             │
│ ┌─────────────────────┐ │
│ │ sarah@acme.com      │ │
│ │ mike@acme.com       │ │
│ │ lisa@acme.com       │ │
│ └─────────────────────┘ │
│                         │
│ Default Role            │
│ ┌─────────────────────┐ │
│ │ Member          ▼   │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ Send Invitations    │ │
│ └─────────────────────┘ │
│                         │
│ <Skip - Do Later>       │
│                         │
└─────────────────────────┘
```

---

## Interaction Specifications

### Workspace Name Input
- **Auto-suggestion**: Based on email domain for corporate accounts
- **Real-time Validation**: Check name availability as user types
- **Character Limits**: 3-50 characters, alphanumeric and spaces
- **Conflict Resolution**: Suggest alternatives if name taken

### Use Case Selection
- **Smart Defaults**: Auto-select based on email domain analysis
- **Progressive Disclosure**: Show relevant features based on selection
- **Later Modification**: Can be changed in workspace settings
- **Feature Implications**: Affects onboarding flow and feature recommendations

### Team Invitation Flow
- **Bulk Email Entry**: Support multiple emails (one per line or comma-separated)
- **Email Validation**: Real-time format and domain checking
- **Role Assignment**: Default member role with dropdown for alternatives
- **Skip Option**: Optional flow - can be completed later

---

## Clerk Integration

### Organization Plugin
- **Workspace Creation**: Leverage Clerk Organizations
- **Owner Assignment**: Set creator as organization owner
- **Member Invitations**: Send invitation emails via Clerk
- **Role Management**: Integrate with Clerk roles for permissions

### Permission Setup
- **Owner Permissions**: Full workspace access and management
- **Default Member Role**: Standard document access and collaboration
- **Admin Assignment**: Option to assign admin role during invitation
- **API Access**: Generate API keys based on role permissions

---

## Technical Integration

### Convex Backend
- **Real-time Updates**: Workspace creation progress via Convex subscriptions
- **Data Sync**: Immediate workspace data availability
- **Member Management**: Real-time member status and invitation tracking
- **Audit Trail**: Log all workspace creation and invitation activities

### Email Integration
- **React Email**: Styled invitation email templates
- **Resend Service**: Reliable email delivery for invitations
- **Personalization**: Include workspace name and inviter information
- **Tracking**: Monitor invitation email delivery and opening

### State Management
- **Creation Progress**: Track workspace setup steps
- **Error Handling**: Clear error recovery at each step
- **Success Confirmation**: Positive feedback for completion
- **Navigation Flow**: Smooth transition to dashboard

---

## Accessibility Features

- **Screen Reader**: Form labels and progress announcements
- **Keyboard Navigation**: Tab order through all interactive elements
- **Focus Management**: Clear visual focus indicators
- **Progress Updates**: ARIA live regions for creation status
- **Error Handling**: Clear error messages with recovery options

---

## Business Logic

### Workspace Naming
- **Uniqueness**: Global workspace name uniqueness enforcement
- **Suggestions**: Smart alternative generation for conflicts
- **Domain Analysis**: Extract company name from email domain
- **Reserved Names**: Prevent use of system/reserved names

### Team Size Detection
- **Email Domain Analysis**: Detect corporate vs. personal emails
- **Use Case Mapping**: Map selections to feature recommendations
- **Billing Setup**: Each workspace gets independent billing/subscription
- **Feature Access**: Configure available features based on workspace's chosen plan

### Onboarding Personalization
- **Flow Customization**: Tailor next steps based on use case
- **Feature Highlighting**: Show relevant features for workspace type
- **Quick Actions**: Surface most relevant first actions
- **Progress Tracking**: Guide users through initial workspace setup