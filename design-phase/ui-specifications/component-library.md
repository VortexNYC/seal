# Component Library - shadcn/ui Selection & Design Patterns

**Philosophy: Leverage shadcn/ui's incredible component foundation with neutral color palette customization.**

## Color Palette - shadcn Neutral Theme

### Primary Colors
```
neutral-50:  #fafafa  (Very light backgrounds)
neutral-100: #f5f5f5  (Light backgrounds, cards)
neutral-200: #e5e5e5  (Borders, dividers)
neutral-300: #d4d4d4  (Stronger borders)
neutral-400: #a3a3a3  (Muted text, placeholders)
neutral-500: #737373  (Secondary text)
neutral-600: #525252  (Primary text)
neutral-700: #404040  (Dark text, emphasis)
neutral-800: #262626  (Headers, strong text)
neutral-900: #171717  (Primary dark, buttons)
neutral-950: #0a0a0a  (Maximum contrast)
```

## Core shadcn/ui Components We're Using

### Form Components
**Selected Components:**
- `Button` - Primary interaction element
- `Input` - Text inputs with validation states
- `Textarea` - Multi-line text input
- `Select` - Dropdown selections
- `Checkbox` - Boolean choices
- `Radio Group` - Single choice from options
- `Switch` - Toggle states
- `Form` - Form state management wrapper
- `Label` - Accessible form labels

**Design Customizations:**
- Primary buttons use `neutral-900` background
- Secondary buttons use `neutral-100` background with `neutral-600` text
- Focus states use `neutral-900` ring
- Error states use red accent over neutral base
- Form spacing follows 8px grid system

### Layout Components
**Selected Components:**
- `Card` - Primary content container
- `Separator` - Visual content division
- `Tabs` - Content organization
- `Accordion` - Collapsible content sections
- `Dialog` - Modal overlays
- `Sheet` - Sliding panels
- `Scroll Area` - Custom scrollbars

**Design Patterns:**
- Cards use `neutral-50` background with `neutral-200` borders
- Separators use `neutral-200` color
- Tab indicators use `neutral-900` for active state
- Modal backdrops use `neutral-900/50` overlay

### Navigation Components
**Selected Components:**
- `Navigation Menu` - Main site navigation
- `Breadcrumb` - Hierarchical navigation
- `Pagination` - List navigation
- `Command` - Search/command palette
- `Dropdown Menu` - Contextual actions

**Design Patterns:**
- Navigation uses `neutral-600` text with `neutral-900` hover states
- Active states use `neutral-900` background
- Breadcrumbs use `neutral-400` separators
- Command palette has `neutral-50` background

### Data Display Components
**Selected Components:**
- `Table` - Data presentation
- `Badge` - Status indicators
- `Avatar` - User representation
- `Tooltip` - Contextual information
- `Alert` - Important messages
- `Progress` - Task completion indicators

**Visual Hierarchy:**
- Table headers use `neutral-700` text
- Table rows alternate between `white` and `neutral-50`
- Badges use semantic colors with neutral base
- Avatars use `neutral-200` fallback background

### Feedback Components
**Selected Components:**
- `Toast` (Sonner integration) - Temporary notifications
- `Alert Dialog` - Confirmation dialogs
- `Skeleton` - Loading states
- `Loading Spinner` - In-progress indicators

**Feedback Patterns:**
- Success toasts use green accent with neutral text
- Error alerts use red accent with `neutral-900` text
- Skeletons use `neutral-200` animated backgrounds
- Loading states maintain layout with neutral placeholders

## Component Behavior Patterns

### Interactive States
**Hover States:**
- Buttons: Darken by one neutral shade
- Links: `neutral-600` to `neutral-900` transition
- Cards: Subtle `neutral-100` background shift

**Focus States:**
- 2px `neutral-900` ring with 2px offset
- Form inputs show focus ring consistently
- Keyboard navigation clearly visible

**Active States:**
- Buttons: Darken by two neutral shades
- Navigation: `neutral-900` background highlight
- Tabs: Border bottom indicator in `neutral-900`

### Disabled States
- Opacity reduced to 50%
- Text color shifts to `neutral-400`
- Pointer events disabled
- Maintain visual hierarchy while clearly disabled

## Responsive Behavior Patterns

### Mobile Adaptations
**Navigation:**
- Navigation Menu � Sheet drawer on mobile
- Command � Full-screen overlay
- Dropdown Menu � Bottom sheet on mobile

**Dialogs:**
- Desktop: Centered modal with backdrop
- Mobile: Full-screen or bottom sheet
- Consistent close button placement

**Forms:**
- Single column layout on mobile
- Touch-friendly button sizes (44px minimum)
- Input spacing optimized for virtual keyboards

### Tablet Adaptations
- Navigation Menu remains visible as sidebar
- Dialogs use centered modal approach
- Form fields can display in two-column layout
- Tables become horizontally scrollable

## Content Density Guidelines

### Spacing Hierarchy
- **Component internal spacing:** 8px, 12px, 16px
- **Component external spacing:** 16px, 24px, 32px
- **Layout sections:** 48px, 64px, 96px
- **Page-level spacing:** 96px, 128px

### Typography Scale Integration
- Card titles use heading-md (20px)
- Body content uses body-md (16px)
- Form labels use label-md (14px medium)
- Helper text uses body-sm (14px)

## Document-Specific Component Patterns

### Document Management Components
**Document Card Pattern:**
- Card container with `neutral-100` background
- Document icon with `neutral-400` color
- Title in `neutral-900`, description in `neutral-600`
- Status badge in top-right corner
- Action dropdown using Dropdown Menu component

**Document List Pattern:**
- Table component with sortable headers
- Status column using Badge components
- Actions column using Dropdown Menu
- Pagination component for large lists

### Signature Workflow Components
**Signature Field Placement:**
- Draggable elements with `neutral-300` borders
- Active drag state uses `neutral-900` border
- Drop zones highlighted with `neutral-200` background
- Field types distinguished by icon and color

**Recipient Management:**
- Card-based layout for each recipient
- Avatar component for user representation
- Role badges using Badge component
- Remove actions using Alert Dialog confirmation

### Workspace Components
**Workspace Switcher:**
- Command component for workspace search
- Avatar + text layout for workspace items
- Separator between personal and business workspaces
- Create workspace action at bottom

**Member Management:**
- Table component for member list
- Role column using Select component
- Status indicators using Badge component
- Invite action using Dialog component

## Loading & Empty States

### Skeleton Patterns
**Document List Skeleton:**
- Card-based skeleton matching actual content structure
- Icon placeholder: 40x40px rounded rectangle
- Text lines: Full width, 3/4 width, 1/2 width pattern
- Maintains spacing identical to loaded state

**Form Skeleton:**
- Label placeholder: 25% width, 16px height
- Input placeholder: Full width, 40px height
- Button placeholder: 20% width, 40px height
- Respects form spacing patterns

### Empty States
**No Documents:**
- Large icon in `neutral-300`
- Primary text in `neutral-600`
- Secondary text in `neutral-400`
- Call-to-action Button component

**No Search Results:**
- Search icon with `neutral-300` color
- "No results for [query]" message
- Suggestions for refining search
- Clear filters Button if applicable

## Performance & Mobile Patterns

### Component Performance
- Tree-shaking friendly imports reduce bundle size
- Lazy loading for non-critical components
- Optimized re-renders with React.memo where beneficial
- Efficient event handling with proper cleanup

### Mobile Optimizations
- Touch-friendly component sizes (minimum 44px targets)
- Responsive behavior built into all components
- Optimized rendering for mobile performance
- Touch gesture support where appropriate

This component selection and customization approach ensures we leverage shadcn/ui's excellence while maintaining our clean, professional neutral aesthetic throughout the entire application.