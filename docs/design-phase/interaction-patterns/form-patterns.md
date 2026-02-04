# Form Interaction Patterns

## Overview

Standardized patterns for form inputs, validation, and submission across the application.

---

## 🎨 Visual Design Principles

### shadcn/ui Neutral Theme Aesthetic

- neutral-900 borders and text (#171717)
- White backgrounds (#FFFFFF)
- neutral-400 states for disabled (#a3a3a3)
- Subtle shadows for depth
- No color except for critical errors (red) and success (green)

### Input Hierarchy

1. **Label** - Clear, above input
2. **Input field** - Prominent, accessible
3. **Helper text** - Subtle, below input
4. **Error message** - Attention-grabbing when needed

---

## 📝 Input Field States

### Text Input States

```
Default:
╔════════════════════════════════════╗
║ Placeholder text                   ║
╚════════════════════════════════════╝

Focus:
╔═══════════════════════════════════╗
║ Entered text                      ║ ← neutral-900 border, ring shadow
╚═══════════════════════════════════╝

Error:
╔═══════════════════════════════════╗
║ invalid@                          ║ ← Red border
╚═══════════════════════════════════╝
❌ Error message here

Disabled:
╔═══════════════════════════════════╗
║░░░ Disabled text ░░░░░░░░░░░░░░░░░║ ← neutral-400 border & bg
╚═══════════════════════════════════╝
```

### Input Components Structure

```
Label *
╔════════════════════════════════════╗
║ Placeholder text                   ║
╚════════════════════════════════════╝
Helper text or character count (0/100)
```

---

## ✅ Validation Patterns

### Validation Timing

1. **On Blur** - Initial validation when user leaves field
2. **On Change** - After first error, validate while typing
3. **On Submit** - Final validation before submission

### Validation States

```
Typing (no validation):
╔════════════════════════════════════╗
║ user@                              ║
╚════════════════════════════════════╝

Validating:
╔════════════════════════════════════╗
║ user@example.com              [⏳] ║ ← Loading indicator
╚════════════════════════════════════╝

Valid:
╔════════════════════════════════════╗
║ user@example.com               [✓] ║ ← Green checkmark
╚════════════════════════════════════╝

Invalid:
╔════════════════════════════════════╗
║ userexample                    [❌] ║ ← Red X
╚════════════════════════════════════╝
❌ Please enter a valid email address
```

### Error Message Guidelines

- **Specific**: "Password must be at least 8 characters"
- **Actionable**: "Add a special character (!@#$%)"
- **Friendly**: Avoid technical jargon
- **Positioned**: Below the field, clearly associated

---

## 📤 Form Submission Patterns

### Submit Button States

```
Default:
[Submit]

Hover:
[Submit] ← Slightly darker border

Loading:
[  ⏳ Submitting...  ] ← Disabled, with spinner

Success:
[   ✓ Submitted  ] ← Brief success state

Error:
[  ❌ Try Again  ] ← Shows error occurred
```

### Form-Level Validation

```
┌────────────────────────────────────┐
│ ❌ Please fix the following errors: │
│   • Email is required               │
│   • Password is too short          │
└────────────────────────────────────┘
```

---

## 🔐 Special Input Types

### Password Input

```
╔════════════════════════════════════╗
║ ••••••••••••••••••••••••••••  [👁] ║ ← Toggle visibility
╚════════════════════════════════════╝
✓ 8+ characters  ✓ 1 number ✓ 1 special character
```

### Select/Dropdown

```
Closed:
╔════════════════════════════════════╗
║ Select an option               [▼] ║
╚════════════════════════════════════╝

Open:
╔════════════════════════════════════╗
║ Select an option               [▲] ║
╠════════════════════════════════════╣
║ Option 1                           ║
║▓▓ Option 2 (hover) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓║ ← Gray background
║ Option 3                           ║
╚════════════════════════════════════╝
```

### Checkbox/Radio

```
Checkbox:
☐ Unchecked
☑ Checked
☒ Indeterminate

Radio:
○ Option 1
◉ Option 2 (selected)
○ Option 3
```

### File Upload

```
┌────────────────────────────────────┐
│                                    │
│        [📁] Drop files here or     │
│                                    │
│          [Choose Files]            │
│                                    │
└────────────────────────────────────┘
PDF, Word, or image files (max 10MB)
```

---

## 📱 Mobile Form Adaptations

### Touch Optimizations

- **Larger touch targets**: Minimum 44x44px
- **Increased spacing**: More room between inputs
- **Sticky submit button**: Fixed at bottom on long forms
- **Native inputs**: Use device keyboards (email, number, etc.)

### Mobile Keyboard Handling

```
When keyboard opens:
╔══════════════════════════════════╗
║ Active input field               ║ ← Scrolls into view
╚══════════════════════════════════╝

  📱 Device Keyboard
```

---

## 📑 Progressive Disclosure

### Conditional Fields

```
Are you a business?
○ Yes  ◉ No

If Yes selected:
┌────────────────────────────────────┐
│ 📊 Business Information (slides in) │
├────────────────────────────────────┤
│ Company Name *                     │
│ ╔════════════════════════════════╗ │
│ ║                                ║ │
│ ╚════════════════════════════════╝ │
│                                    │
│ Tax ID                             │
│ ╔════════════════════════════════╗ │
│ ║                                ║ │
│ ╚════════════════════════════════╝ │
└────────────────────────────────────┘
```

### Multi-Step Forms

```
Progress: Step 2 of 3
▓▓▓▓▓▓▓▓░░░░░░░░░

[← Back] [Continue →]
```

---

## ✨ Success Patterns

### Inline Success

```
┌────────────────────────────────────┐
│  ✅ Changes saved automatically     │
└────────────────────────────────────┘
```

### Post-Submit Success

```
┌────────────────────────────────────┐
│                                    │
│               ✅                   │
│                                    │
│      Form submitted successfully   │
│                                    │
│  You'll receive an email confirmation │
│                                    │
│         [Back to Dashboard]        │
│                                    │
└────────────────────────────────────┘
```

---

## 📋 Form Best Practices

### Do's

- Show field requirements upfront
- Validate on blur, not while typing (initially)
- Provide clear, actionable error messages
- Save progress automatically when possible
- Group related fields together

### Don'ts

- Don't clear form on error
- Don't validate too aggressively
- Don't hide important information
- Don't disable submit without explanation
- Don't use placeholder as label

---

## 📈 Performance Metrics

- **Field focus time**: <100ms
- **Validation feedback**: <500ms
- **Form submission**: <2s typical
- **Error recovery rate**: >80%
- **Mobile completion rate**: Within 10% of desktop
