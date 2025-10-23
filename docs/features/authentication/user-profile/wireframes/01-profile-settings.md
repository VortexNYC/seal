# Profile Settings Wireframes - All States

## Screen States & Wireframes

### 🟢 Default Profile View State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                            Profile Settings                                   ║
║                           (text-2xl font-bold)                               ║
║                                                                               ║
║    ╔═[PROFILE HEADER CARD: variant="elevated"]═══════════════════════════╗   ║
║    ║                                                                     ║   ║
║    ║  ╭─[AVATAR: size="lg" fallback="JD"]─╮  John Doe    ┏━[EDIT BTN]━┓ ║   ║
║    ║  │      ▓▓▓ USER AVATAR (64px)      │  (text-lg)   ┃   [EDIT]   ┃ ║   ║
║    ║  │        Profile Image             │  font-medium ┗━━━━━━━━━━━━━┛ ║   ║
║    ║  ╰─────────────────────────────────╯                               ║   ║
║    ║                  john.doe@company.com                              ║   ║
║    ║                   (text-muted-foreground)                          ║   ║
║    ╚═════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║    ┌─[SECTION HEADER: text-lg font-semibold]──────────────────────────────┐   ║
║    │ Personal Information                                                 │   ║
║    └──────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[SETTINGS CARD: variant="outline"]═══════════════════════════════════╗   ║
║    ║ Full Name        John Doe                         ┏━[EDIT BTN]━┓    ║   ║
║    ║                  (text-base)                      ┃    Edit     ┃    ║   ║
║    ║                                                   ┗━━━━━━━━━━━━━┛    ║   ║
║    ║ ────────────────────────────────────────────────────────────────── ║   ║
║    ║ Email Address    john.doe@company.com             ┏━[EDIT BTN]━┓    ║   ║
║    ║                  (text-base)                      ┃    Edit     ┃    ║   ║
║    ║                                                   ┗━━━━━━━━━━━━━┛    ║   ║
║    ╚═════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║    ┌─[SECTION HEADER: text-lg font-semibold]──────────────────────────────┐   ║
║    │ Account Security                                                     │   ║
║    └──────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[SETTINGS CARD: variant="outline"]═══════════════════════════════════╗   ║
║    ║ Password         ••••••••••••••                   ┏━[CHANGE BTN]━┓   ║   ║
║    ║                  (text-muted-foreground)          ┃    Change    ┃   ║   ║
║    ║                                                   ┗━━━━━━━━━━━━━━┛   ║   ║
║    ║ ────────────────────────────────────────────────────────────────── ║   ║
║    ║ Two-Factor Auth  🔒 Disabled                      ┏━[ENABLE BTN]━┓   ║   ║
║    ║                  (text-orange-600)                ┃   Enable     ┃   ║   ║
║    ║                                                   ┗━━━━━━━━━━━━━━┛   ║   ║
║    ║ ────────────────────────────────────────────────────────────────── ║   ║
║    ║ Active Sessions  3 active sessions                ┏━[MANAGE BTN]━┓   ║   ║
║    ║                  (text-base)                      ┃   Manage     ┃   ║   ║
║    ║                                                   ┗━━━━━━━━━━━━━━┛   ║   ║
║    ╚═════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║                      ╭─[BUTTON: variant="destructive"]─╮                    ║
║                      │        Delete Account           │                    ║
║                      ╰─────────────────────────────────╯                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Main settings page with proper spacing and hierarchy
- **Header**: Brand logo with page title (text-2xl font-bold)

### Profile Header Section
- **Profile Card**: Elevated card component with user information
- **Avatar Component**: 
  - Large avatar (64px) with fallback initials "JD"
  - Upload functionality with image validation
  - Rounded corners and proper aspect ratio
- **User Info Display**:
  - Name: text-lg font-medium
  - Email: text-muted-foreground for hierarchy
- **Edit Button**: Primary action button for profile editing

### Personal Information Section
- **Section Header**: Clear section demarcation (text-lg font-semibold)
- **Settings Card**: Outline variant card with list items
- **Field Layout**: 
  - Label-value pairs with consistent spacing
  - Edit buttons aligned to right
  - Divider lines between fields for clarity

### Account Security Section
- **Password Field**: 
  - Masked display with bullet points
  - Muted text color for security
- **Two-Factor Authentication**:
  - 🔒 Lock icon for security context
  - Orange text color for "Disabled" status (warning)
  - Enable button for activation
- **Active Sessions**: Clear count with management option

### Action Buttons
- **Edit Buttons**: 
  - Consistent secondary button styling
  - Right-aligned for scanning pattern
  - Clear labels: "Edit", "Change", "Enable", "Manage"
- **Delete Account**: 
  - Destructive variant button
  - Centered positioning for emphasis
  - Red styling to indicate danger

### Interactive States
- **Hover States**: Button color transitions
- **Focus States**: Keyboard navigation support
- **Loading States**: Spinner for save operations
- **Success States**: Toast notifications for updates

### 🟡 Edit Profile State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                             Edit Profile                                     ║
║                            (text-2xl font-bold)                              ║
║                                                                               ║
║    ╔═[AVATAR UPLOAD CARD: variant="elevated"]════════════════════════════╗   ║
║    ║                                                                     ║   ║
║    ║  ╭─[AVATAR: size="lg" editable]─╮  ┏━[UPLOAD BTN]━┓  ╭─[CANCEL]─╮  ║   ║
║    ║  │   ▓▓▓ USER AVATAR (64px)    │  ┃ Upload New   ┃  │  Cancel  │  ║   ║
║    ║  │     Profile Image           │  ┃    Photo     ┃  │          │  ║   ║
║    ║  ╰─────────────────────────────╯  ┗━━━━━━━━━━━━━━┛  ╰──────────╯  ║   ║
║    ║            ╭─[CHANGE BTN: variant="outline"]─╮                     ║   ║
║    ║            │           Change                │                     ║   ║
║    ║            ╰────────────────────────────────╯                     ║   ║
║    ╚═════════════════════════════════════════════════════════════════════╝   ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Full Name                                                           │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="text" class="w-full" valid state]═══════════════════════╗  ║
║    ║ John Doe                                               ✅            ║  ║
║    ╚═════════════════════════════════════════════════════════════════════════╝  ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Email Address                                                       │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="email" class="w-full" valid state]══════════════════════╗  ║
║    ║ john.doe@company.com                                   ✅            ║  ║
║    ╚═════════════════════════════════════════════════════════════════════════╝  ║
║    ┌─[HELP TEXT: text-sm text-orange-600]────────────────────────────────┐   ║
║    │ ⚠️  Changing your email requires verification                        │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║    ┃                    [BUTTON: variant="default" size="lg"]           ┃   ║
║    ┃                         Save Changes                               ┃   ║
║    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                        ╭─[BUTTON: variant="ghost"]─╮                        ║
║                        │          Cancel           │                        ║
║                        ╰───────────────────────────╯                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Edit mode interface with form validation
- **Header**: Edit Profile title with navigation context

### Avatar Upload Section
- **Avatar Display**: 
  - Current avatar with edit overlay
  - 64px size with proper aspect ratio
  - Upload zone with drag-and-drop support
- **Upload Actions**:
  - Primary "Upload New Photo" button
  - Secondary "Change" button for current avatar
  - Cancel button for upload cancellation
- **File Validation**: JPG/PNG/WebP, max 5MB with preview

### Form Fields
- **Field Labels**: 
  - FormLabel components with medium font weight
  - Consistent spacing and alignment
- **Input Components**:
  - Full-width Input fields with proper validation
  - Success icons (✅) for valid inputs
  - Border styling based on validation state

### Validation Features
- **Real-time Validation**: Input validation on blur
- **Success States**: Green checkmarks for valid fields
- **Help Text**: Warning message for email changes
- **Required Field Indicators**: Visual cues for required fields

### Action Buttons
- **Save Changes**: 
  - Primary button (variant="default" size="lg")
  - Full width for prominence
  - Disabled state until changes detected
- **Cancel Button**: 
  - Ghost variant for secondary action
  - Returns to view mode without saving

### Form Behavior
- **Auto-save**: Draft changes saved locally
- **Validation States**: Real-time feedback
- **Loading States**: Spinner during save operations
- **Success Feedback**: Toast notification on successful save

### 🔴 Validation Error State

## Visual Structure

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       ▓▓▓ SEAL LOGO (h-12) ▓▓▓                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                             Edit Profile                                     ║
║                            (text-2xl font-bold)                              ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Full Name                                                           │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="text" class="w-full border-red-500" error state]═══════╗  ║
║    ║                                                       ❌             ║  ║
║    ╚═════════════════════════════════════════════════════════════════════════╝  ║
║    ┌─[ERROR MESSAGE: text-sm text-red-600]───────────────────────────────┐   ║
║    │ ❌ Name cannot be empty                                              │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║    ┌─[FORM FIELD LABEL: font-medium]─────────────────────────────────────┐   ║
║    │ Email Address                                                       │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║    ╔═[INPUT: type="email" class="w-full border-red-500" error state]══════╗  ║
║    ║ invalid-email                                          ❌            ║  ║
║    ╚═════════════════════════════════════════════════════════════════════════╝  ║
║    ┌─[ERROR MESSAGE: text-sm text-red-600]───────────────────────────────┐   ║
║    │ ❌ Please enter a valid email address                                │   ║
║    └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║
║    ┃               [BUTTON: variant="default" size="lg" disabled]        ┃   ║
║    ┃                         Save Changes                               ┃   ║
║    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║
║                                                                               ║
║                        ╭─[BUTTON: variant="ghost"]─╮                        ║
║                        │          Cancel           │                        ║
║                        ╰───────────────────────────╯                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Detailed Specifications

### Component Details
- **Container**: Error state interface with validation feedback
- **Header**: Consistent edit mode title

### Form Field Validation
- **Field Labels**: FormLabel components with clear hierarchy
- **Error State Inputs**:
  - Red border styling (border-red-500)
  - Error icons (❌) inside input fields
  - Proper ARIA labels for accessibility
  - Focus states maintain error styling

### Error Message Display
- **Error Messages**:
  - text-sm text-red-600 styling
  - Positioned directly below relevant fields
  - Clear, actionable error descriptions
  - ARIA live regions for screen readers

### Validation Rules
- **Full Name Field**:
  - Required validation
  - Empty state error: "Name cannot be empty"
  - Character limits: 1-100 characters
- **Email Field**:
  - Email format validation
  - Invalid format error: "Please enter a valid email address"
  - Uniqueness validation (backend)

### Interactive Elements
- **Save Changes Button**:
  - Disabled state when validation errors exist
  - Grayed out appearance with disabled cursor
  - Re-enabled only when all validations pass
- **Cancel Button**: Always enabled for form exit

### Accessibility Features
- **ARIA Labels**: Form fields properly labeled
- **Error Announcements**: Screen reader notifications
- **Focus Management**: Error fields receive focus
- **High Contrast**: Error states clearly visible

### Form Behavior
- **Real-time Validation**: Errors shown on field blur
- **Live Updates**: Error messages update as user types
- **Form State**: Button remains disabled until valid
- **Recovery**: Clear errors when valid input entered

### 🟢 Email Change Pending State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               [LOGO] Seal                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         📧 Email Change Pending                             │
│                                                                             │
│              We've sent a verification link to your new email:             │
│                          john.new@company.com                              │
│                                                                             │
│                   Click the link to complete your email change             │
│                                                                             │
│    Current Email: john.doe@company.com                                     │
│    Pending Email: john.new@company.com                                     │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                     Resend Verification                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                      <Cancel Email Change>                                 │
│                        <Back to Profile>                                   │
│                                                                             │
│           Didn't receive the email? Check your spam folder.                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive States

### 📱 Mobile Profile View

```
╔═══════════════════════════╗ [MOBILE VIEWPORT: 375px width]
║      ▓▓▓ SEAL LOGO ▓▓▓     ║ [Logo: h-8 mobile variant]
║                           ║
╠═══════════════════════════╣
║                           ║
║   Profile Settings        ║ [text-lg font-semibold text-center]
║                           ║
║  ╭─[PROFILE CARD]─────╮   ║ [Card: variant="elevated", p-4]
║  │ ●●● [AVATAR] ┏Edit┓│   ║ [Avatar: size="sm" 40px, Button: size="sm"]
║  │   John Doe        │   ║ [text-sm font-medium]
║  │   john@company.com│   ║ [text-xs text-muted-foreground]
║  ╰───────────────────╯   ║
║                           ║
║ Personal Info             ║ [text-sm font-semibold mb-2]
║  ╭─[INFO CARD]────────╮   ║ [Card: variant="outline", p-3]
║  │ Name    John Doe   │   ║ [text-xs label + text-sm value]
║  │ Email   john@co... │   ║ [text-xs + truncated text-sm]
║  │ Timezone EST       │   ║ [text-xs + text-sm]
║  ╰────────────────────╯   ║
║                           ║
║ Security                  ║ [text-sm font-semibold mb-2]
║  ╭─[SECURITY CARD]───╮    ║ [Card: variant="outline", p-3]
║  │ Password ┏Change┓  │    ║ [text-xs + Button: size="xs"]
║  │ 2FA      ┏Enable┓  │    ║ [text-xs + Button: size="xs"]
║  │ Sessions ┏Manage┓  │    ║ [text-xs + Button: size="xs"]
║  ╰─────────────────────╯   ║
║                           ║
║ ┏━━━ Delete Account ━━━┓   ║ [Button: variant="destructive", size="sm", w-full]
║                           ║
╚═══════════════════════════╝
```

---

## Interaction Specifications

### Profile Edit Actions
- **Edit Profile Button**: Toggle to edit mode
- **Avatar Upload**: File picker with image validation
- **Save Changes**: Validates and saves profile updates
- **Cancel**: Discards changes, returns to view mode

### Validation Rules
- **Name**: Required, 1-100 characters
- **Email**: Valid email format, unique in system
- **Avatar**: JPG/PNG/WebP, max 5MB

### Real-time Features
- **Profile Sync**: Changes sync across all user sessions via Convex
- **Email Verification**: Required for email changes
- **Session Updates**: All active sessions reflect profile changes

---

## Accessibility Features

- **Screen Reader**: Profile information clearly labeled
- **Keyboard Navigation**: Tab order through all editable fields
- **Focus Management**: Clear focus indicators on form fields
- **Error Announcements**: ARIA live regions for validation errors
- **High Contrast**: Error states clearly visible

---

## Performance Considerations

- **Profile Loading**: <500ms to load profile data
- **Avatar Upload**: Progress indicator for large images
- **Auto-save**: Save preferences automatically on change
- **Image Optimization**: Resize/compress avatars on upload