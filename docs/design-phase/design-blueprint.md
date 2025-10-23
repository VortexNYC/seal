# Design Blueprint - Seal

This is the master design document that establishes our core UX principles, design patterns, and architectural decisions for the entire application.

## 🎯 Design Philosophy

### Core Principles
1. **User Experience First**: Prioritize functionality and flow over visual design
2. **State-Driven Design**: Design for ALL states (loading, error, empty, success), not just happy paths
3. **Predictable Interactions**: Consistent patterns across the entire application
4. **Progressive Disclosure**: Show complexity gradually as users need it
5. **Mobile Optimization**: Responsive design optimized for all screen sizes

### UX Goals
- **Sub-5-minute onboarding**: From sign-up to first document signed
- **Zero-learning curve**: Intuitive flows that require no training
- **Error recovery focused**: Every error state has a clear path to resolution
- **Mobile-first approach**: Every interaction works on mobile browsers

---

## 🏗️ Information Architecture

### Primary User Types
1. **Document Senders** (Workspace Members/Owners/Admins)
2. **Document Signers** (Recipients - may not have accounts)
3. **Workspace Administrators** (Managing teams and billing)
4. **Platform Developers** (Using APIs)

### Core Mental Models
- **Workspaces** = Teams/Organizations with independent billing (each workspace = separate subscription)
- **Seats** = User membership in a workspace (subscription charges per seat)
- **Multi-Workspace Users** = Same user can have different roles/plans in different workspaces
- **Documents** = Individual files that need signatures
- **Templates** = Reusable document scaffolds
- **Recipients** = People who need to sign (internal or external)
- **Signature Fields** = Specific areas requiring input

### Billing & Subscription Model
- **Per-Workspace Billing**: Each workspace has its own subscription (Free, Pro, Team tiers)
- **Per-Seat Pricing**: Workspaces pay per active member seat
- **User Context Switching**: Users inherit permissions/features based on current workspace's plan
- **Plan Examples**:
  - Personal workspace (Free tier): Basic features, limited docs
  - Company workspace (Team tier): Premium features, unlimited docs, team collaboration
  - Client workspace (Pro tier): Advanced features, API access, compliance tools

### Top-Level Navigation Structure
```
Primary Navigation (Always Visible):
├── Dashboard (Home)
├── Documents (Library)
├── Templates 
├── Recipients (if admin+)
└── Settings
    ├── Profile
    ├── Workspace
    ├── Billing (if owner/admin)
    ├── API Keys (if enabled)
    └── Security

User Menu (Top Right):
├── Switch Workspace
├── Profile Settings
├── Help & Support
└── Sign Out
```

---

## 🔄 Core Interaction Patterns

### State Management Philosophy
Every UI component/screen has these states:
1. **Initial/Empty State**: First time experience
2. **Loading State**: Data fetching/processing
3. **Success State**: Normal populated state
4. **Error State**: Something went wrong
5. **Recovery State**: Path back to success

### Form Interaction Patterns

#### Validation Strategy
- **Real-time validation**: Using TanStack Form + Zod schemas
- **Progressive validation**: Validate on blur, then real-time after first error
- **Server validation**: Handled via Clerk patterns
- **Error display**: Inline errors with clear recovery instructions

#### Common Form States
```
Form States:
├── Pristine (untouched)
├── Editing (user typing)
├── Validating (checking input)
├── Valid (green checkmarks)
├── Invalid (red errors with fixes)
├── Submitting (loading spinner)
├── Success (confirmation message)
└── Error (retry options)
```

### Navigation Patterns

#### Page Transitions
- **Optimistic navigation**: UI updates immediately, sync in background
- **Loading indicators**: Page-level loading for slow operations
- **Breadcrumbs**: For deep navigation (Documents > Template > Edit)
- **Back button**: Always works as expected

#### Mobile Navigation
- **Collapsible sidebar**: Drawer pattern for primary nav
- **Bottom navigation**: For frequently used actions
- **Swipe gestures**: Where appropriate (document pages, modal dismiss)

---

## 📱 Responsive Design Strategy

### Breakpoints
- **Mobile**: 320px - 768px (primary target)
- **Tablet**: 768px - 1024px (secondary)
- **Desktop**: 1024px+ (full features)

### Mobile-First Approach
- Design for mobile browsers first
- Progressive enhancement for larger screens
- Touch targets minimum 44px
- No hover states on mobile

### Key Mobile Considerations
- **Virtual keyboard handling**: Viewport adjustments
- **Touch-friendly signature capture**: Large signature areas
- **Readable text**: 16px minimum font size
- **Fast loading**: Optimized for slower connections

---

## 🎨 Visual Design Constraints (Future Phase)

### Design System Approach
Following shadcn/ui neutral theme approach:
- **Minimal color palette**: Primarily neutral scale (neutral-50 to neutral-950)
- **Clean typography**: Sans-serif, readable hierarchy
- **Generous whitespace**: Breathing room between elements
- **Subtle shadows**: Depth without distraction

### Component Philosophy
- **shadcn/ui as Foundation**: All UI components built on shadcn/ui + Radix UI primitives
- **Compound components**: Related elements grouped together (Card + CardHeader + CardContent)
- **Consistent spacing**: Tailwind spacing scale (space-y-4, space-x-2, p-6, etc.)
- **Design Tokens**: CSS variables for theming (--primary, --secondary, --destructive, etc.)
- **Loading skeletons**: Match actual content structure using Skeleton component
- **Performance Optimized**: Tree-shaking friendly imports and minimal bundle impact

---

## 🚨 Error Handling Philosophy

### Error Categories
1. **User Input Errors**: Validation, format issues
2. **System Errors**: Server down, network issues
3. **Permission Errors**: Access denied, subscription limits
4. **Business Logic Errors**: Workflow constraints

### Error Recovery Patterns
Every error includes:
- **Clear explanation**: What happened in plain English
- **Specific cause**: Why it happened
- **Recovery actions**: 2-3 options to fix it
- **Escalation path**: Contact support when needed

### Example Error Pattern
```
Error State Template:
┌─────────────────────────────────┐
│ [Icon] Something went wrong     │
│                                 │
│ Clear explanation of what       │
│ happened and why.               │
│                                 │
│ [Primary Action] Try Again      │
│ [Secondary] Contact Support     │
│ [Tertiary] Go Back              │
└─────────────────────────────────┘
```

---

## 🔐 Security & Privacy UX

### Trust Building Elements
- **Security indicators**: SSL badges, encryption mentions
- **Audit trail visibility**: Users can see document history
- **Data control**: Clear export/deletion options
- **Compliance badges**: ESIGN Act compliance display

### Privacy-First Design
- **Minimal data collection**: Only ask for what's needed
- **Clear permissions**: Explicit consent for data use
- **Easy opt-out**: Unsubscribe/deletion always available
- **Transparency**: Clear privacy policy access

---

## 📊 Performance & Loading Patterns

### Loading Strategy
- **Skeleton screens**: Match actual content structure
- **Progressive loading**: Critical content first
- **Optimistic updates**: Update UI immediately, sync later
- **Error boundaries**: Graceful failure handling

### Critical Performance Targets
- **Time to Interactive**: <3 seconds on mobile
- **Document Processing**: <5 seconds for typical PDFs
- **Real-time Updates**: <500ms via Convex subscriptions
- **Form Responsiveness**: <100ms input response

---

## 🧭 User Flow Principles

### Flow Documentation Standards
- **Start/End clearly marked**: Entry and exit points
- **Decision points highlighted**: Where users make choices
- **Happy path in green**: Main success flow
- **Error paths in red**: Recovery flows
- **Edge cases documented**: Unusual but possible scenarios

### Flow Complexity Management
- **One primary action per screen**: Avoid choice overload
- **Linear progression**: Step 1, 2, 3 when possible
- **Clear progress indicators**: Users know where they are
- **Easy backtracking**: Users can fix mistakes

---

## 🔄 Real-time Features (Convex)

### Real-time Update Patterns
- **Optimistic UI**: Immediate feedback, sync later
- **Connection status**: Users know if offline/online
- **Conflict resolution**: Clear merge conflict handling
- **Presence indicators**: Show who else is active

### Subscription Management
- **Automatic reconnection**: Handle network issues gracefully
- **Subscription cleanup**: Prevent memory leaks
- **Selective subscriptions**: Only subscribe to needed data

---

## 📚 Documentation Standards

### Wireframe Conventions
```
Text Input:     [_______________]
Button:         [Button Text]
Checkbox:       [x] Label / [ ] Label  
Radio:          (•) Selected / ( ) Option
Dropdown:       [Selected ▼]
Link:           <Link Text>
Image:          [IMAGE: Alt text]
Loading:        ⏳ Loading...
Error:          ❌ Error message
Success:        ✅ Success message
```

### State Annotation
```
Screen States:
🟢 Happy Path (normal usage)
🟡 Loading/Processing
🔴 Error State
🔵 Empty State
⚪ Edge Case
```

### Flow Diagram Symbols
```
○ Start/End
□ Process/Action
◇ Decision
→ Flow Direction
↩ Back/Return
⚠ Error Path
✓ Success Path
```

---

## 🎯 Success Metrics

### UX Quality Metrics
- **Task Completion Rate**: >95% for core flows
- **Error Recovery Rate**: >90% successful recovery
- **Time to First Value**: <60 seconds new users
- **Mobile Usability**: Equal functionality across devices

### Technical Quality Metrics
- **Performance Budget**: Lighthouse >90
- **Error Rate**: <1% unrecoverable errors
- **Loading Performance**: <3s on 3G connections
- **Mobile Performance**: Equal functionality across all device sizes

---

---

## 🛠️ shadcn/ui Technical Integration

### Core Architecture
```typescript
// Component Structure
├── @/components/ui/ (shadcn/ui primitives)
│   ├── button.tsx
│   ├── input.tsx
│   ├── form.tsx
│   └── dialog.tsx
├── @/components/ (App-specific compounds)
│   ├── document-card.tsx
│   ├── signature-field.tsx
│   └── workspace-selector.tsx
└── @/lib/ (Utilities)
    ├── utils.ts (cn helper)
    └── validations.ts (Zod schemas)
```

### CSS Variables & Theming
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}
```

### Tailwind Configuration
```javascript
// tailwind.config.js integration
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... rest of color definitions
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
}
```

### Form Integration Pattern
```typescript
// Standard form pattern with shadcn/ui + react-hook-form + zod
const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { email: "", password: "" },
})

// Component implementation:
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input type="email" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

### Performance Budgets
- **Bundle Size**: shadcn/ui components <50KB gzipped total
- **Tree Shaking**: Only import used components
- **CSS-in-JS**: Zero runtime CSS-in-JS (Tailwind compile-time)
- **Component Loading**: <100ms component render time

---

This blueprint serves as the foundation for all design decisions. Every screen, flow, and interaction should align with these principles. When in doubt, prioritize user clarity and error recovery over complexity.

Next: Begin with Authentication Feature design to establish concrete patterns.