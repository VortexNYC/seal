# Wireframe Conventions - Enhanced Documentation Standards

## Overview

This document establishes **detailed** standards for creating wireframes across all 26 features, ensuring uniformity, completeness, and developer-ready specifications. **All wireframes must be highly detailed** - no basic ASCII allowed.

---

## 🎨 Enhanced Visual Conventions

### **Multi-Layer Wireframe Approach**

Every wireframe must include **three layers of information**:

1. **Visual Structure Layer** (detailed ASCII/Unicode layout with measurements)
2. **Detailed Specifications Layer** (colors, interactions, states)
3. **Technical Implementation Layer** (components, data, APIs)

### **Unicode Box Drawing Characters (Maximum Detail)**

#### **Advanced Box Drawing Set**

```
┌─────────────────────────────────────────────────────────┐
│ Single line borders: ┌─┬─┐ ├─┼─┤ └─┴─┘                  │
├─────────────────────────────────────────────────────────┤
│ Double line borders: ╔═╦═╗ ╠═╬═╣ ╚═╩═╝                  │
├─────────────────────────────────────────────────────────┤
│ Thick line borders:  ┏━┳━┓ ┣━╋━┫ ┗━┻━┛                   │
├─────────────────────────────────────────────────────────┤
│ Mixed connections:   ╒═╤═╕ ╞═╪═╡ ╘═╧═╛                   │
└─────────────────────────────────────────────────────────┘

Visual Depth Indicators:
▓▓▓ Solid shadows/elevated elements
▒▒▒ Medium opacity/semi-disabled elements
░░░ Light backgrounds/subtle elements
███ Completely filled/active elements

Interaction Symbols:
↔ ↕ ↗ ↘ ↙ ↖ ↶ ↷ ↺ ↻ Movement/resize
✋ 👆 👉 👇 👈 Touch gestures
⟲ ⟳ Rotation/refresh
🖱 Mouse interactions
⌘ ⌥ ⇧ ⌃ Keyboard modifiers
```

#### **Container Hierarchy System**

```
PRIORITY 1 (Critical): ╔═══════════════╗
                       ║ Primary CTA   ║
                       ╚═══════════════╝

PRIORITY 2 (Important): ┏━━━━━━━━━━━━━━━┓
                        ┃ Secondary     ┃
                        ┗━━━━━━━━━━━━━━━┛

PRIORITY 3 (Standard):  ┌─────────────────┐
                        │ Regular content │
                        └─────────────────┘

PRIORITY 4 (Subtle):    ╭─────────────────╮
                        │ Background info │
                        ╰─────────────────╯
```

### **Enhanced UI Element Standards**

#### **shadcn/ui Buttons (Unicode Enhanced + Component Specific)**

```
BASIC (NEVER USE):
[Button Text]

ENHANCED SHADCN/UI BUTTONS (ALWAYS USE):

╔═[PRIMARY BUTTON: variant="default" size="lg"]══════════════════════════╗
║ ███ Get Started ███ │ 280×44px                                        ║
║ class="bg-primary text-primary-foreground hover:bg-primary/90"        ║
║ ▓▓▓ Shadow depth: 0 1px 3px rgba(0,0,0,0.1) ▓▓▓                      ║
╚════════════════════════════════════════════════════════════════════════╝

┏━[SECONDARY BUTTON: variant="outline" size="default"]━━━━━━━━━━━━━━━━━━━━━┓
┃ ░░░ Learn More ░░░ │ 200×40px                                        ┃
┃ class="border border-input bg-background hover:bg-accent"           ┃
┃ ▒▒▒ Subtle hover state with accent background ▒▒▒                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─[GHOST BUTTON: variant="ghost" size="sm"]────────────────────────────┐
│ Cancel │ 120×36px                                                    │
│ class="hover:bg-accent hover:text-accent-foreground"                 │
│ Minimal visual weight, hover interaction only                        │
└───────────────────────────────────────────────────────────────────────┘

SHADCN/UI STATE MATRIX:
├─ default: bg-primary text-primary-foreground hover:bg-primary/90
├─ destructive: bg-destructive text-destructive-foreground hover:bg-destructive/90
├─ outline: border border-input hover:bg-accent hover:text-accent-foreground
├─ secondary: bg-secondary text-secondary-foreground hover:bg-secondary/80
├─ ghost: hover:bg-accent hover:text-accent-foreground
└─ link: underline-offset-4 hover:underline text-primary

SIZE VARIANTS:
├─ sm: h-9 px-3 text-sm (36px height)
├─ default: h-10 px-4 py-2 (40px height)
├─ lg: h-11 px-8 (44px height)
└─ icon: h-10 w-10 p-0 (40×40px square)

LOADING STATE (Enhanced):
╔═[LOADING BUTTON: disabled state]════════════════════════════════════╗
║ ⟳ Loading... │ Same dimensions as target variant                   ║
║ <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ║
║ ▒▒▒ Muted appearance with spinning icon ▒▒▒                        ║
╚═══════════════════════════════════════════════════════════════════════╝

TECHNICAL IMPLEMENTATION:
├─ Import: import { Button } from "@/components/ui/button"
├─ Usage: <Button variant="default" size="lg" onClick={handleClick}>
├─ Loading: <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</Button>
├─ Custom: className prop for additional Tailwind classes
└─ Analytics: onClick={(e) => { track('button_clicked', { variant, size }); handleClick(e); }}
```

#### **shadcn/ui Form Inputs (Unicode Enhanced + Component Specific)**

```
BASIC (NEVER USE):
[_______________]

ENHANCED SHADCN/UI INPUTS (ALWAYS USE):

╔═[INPUT FIELD: type="email" className="w-80 h-11"]════════════════════════╗
║ john@example.com_ │ 320×44px                                            ║
║ class="border-input bg-background px-3 py-2 text-sm"                    ║
║ ░░░ Placeholder: "Enter your email" text-muted-foreground ░░░           ║
╚════════════════════════════════════════════════════════════════════════╝

┏━[SELECT FIELD: shadcn Select component]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Choose workspace type ▼ │ 280×44px                                    ┃
┃ <Select><SelectTrigger><SelectValue /></SelectTrigger></Select>       ┃
┃ ▒▒▒ Options: Personal │ Team │ Enterprise ▒▒▒                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─[TEXTAREA: shadcn Textarea component]─────────────────────────────────┐
│ Description...                          │ 400×120px                   │
│ class="min-h-[120px] resize-none"       │                             │
│ Multiple line text input with auto-     │                             │
│ resize disabled, controlled height      │                             │
└───────────────────────────────────────────────────────────────────────┘

SHADCN/UI FORM INTEGRATION (react-hook-form + zod):
╔═[FORM FIELD: Full integration pattern]══════════════════════════════════╗
║ <FormField control={form.control} name="email"                         ║
║   render={({ field }) => (                                             ║
║     <FormItem>                                                          ║
║       <FormLabel>Email Address</FormLabel>                             ║
║       <FormControl>                                                     ║
║         <Input placeholder="john@example.com" {...field} />            ║
║       </FormControl>                                                    ║
║       <FormMessage /> {/* Auto error display */}                       ║
║     </FormItem>                                                         ║
║   )} />                                                                 ║
╚═════════════════════════════════════════════════════════════════════════╝

VALIDATION STATES (Enhanced with shadcn/ui):
├─ Default: border-input bg-background text-foreground
├─ Focus: focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
├─ Valid: border-green-500 (custom class or variant)
├─ Error: border-destructive focus-visible:ring-destructive (auto via FormField)
├─ Disabled: disabled:cursor-not-allowed disabled:opacity-50
└─ Loading: <Input disabled /> with <Loader2 className="animate-spin" /> icon

ERROR HANDLING (Automatic with FormMessage):
╭─[ERROR STATE: FormMessage integration]───────────────────────────────╮
│ ❌ Please enter a valid email address                                 │
│ class="text-sm font-medium text-destructive"                         │
│ Position: Below input, automatic spacing                             │
│ Integration: Zod schema validation + react-hook-form                 │
╰────────────────────────────────────────────────────────────────────────╯

ADVANCED INPUT VARIANTS:
┏━[INPUT WITH ICON: Enhanced composition]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ <div className="relative">                                           ┃
┃   🔍 search term...  │ Icon positioned absolutely                   ┃
┃   <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />  ┃
┃   <Input className="pl-9" placeholder="Search..." />                ┃
┃ </div>                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

TECHNICAL IMPLEMENTATION:
├─ Base Import: import { Input } from "@/components/ui/input"
├─ Form Integration: import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
├─ Validation: const formSchema = z.object({ email: z.string().email() })
├─ State Management: const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema) })
├─ Real-time Validation: Built into react-hook-form with zod resolver
└─ Analytics: onFocus, onBlur, onChange event tracking
```

#### **shadcn/ui Layout Containers (Unicode Enhanced + Component Specific)**

```
BASIC (NEVER USE):
┌─────────────┐
│ Content     │
└─────────────┘

ENHANCED SHADCN/UI LAYOUTS (ALWAYS USE):

╔═[CARD CONTAINER: shadcn Card component]═════════════════════════════════════╗
║ <Card className="w-full max-w-2xl mx-auto"> │ 672px max-width             ║
║   <CardHeader>                                                              ║
║     <CardTitle>Document Settings</CardTitle>                               ║
║     <CardDescription>Configure your document preferences</CardDescription>  ║
║   </CardHeader>                                                             ║
║   ▓▓▓ Content area with proper spacing ▓▓▓                                 ║
║   <CardContent className="space-y-4">                                      ║
║     {/* Form fields and content */}                                        ║
║   </CardContent>                                                            ║
║   <CardFooter className="flex justify-between">                            ║
║     ░░░ Footer actions area ░░░                                            ║
║   </CardFooter>                                                             ║
║ </Card>                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════╝

┏━[SHEET/DRAWER: Mobile-responsive sidepanel]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ <Sheet> {/* Mobile: full-screen, Desktop: side panel */}               ┃
┃   <SheetTrigger asChild>                                                ┃
┃     <Button variant="outline">Open Settings</Button>                   ┃
┃   </SheetTrigger>                                                       ┃
┃   <SheetContent className="w-80 sm:w-96">                              ┃
┃     ▒▒▒ 320px mobile, 384px desktop ▒▒▒                                ┃
┃     <SheetHeader>                                                       ┃
┃       <SheetTitle>Document Actions</SheetTitle>                        ┃
┃     </SheetHeader>                                                      ┃
┃     {/* Content */}                                                     ┃
┃   </SheetContent>                                                       ┃
┃ </Sheet>                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─[DIALOG MODAL: Centered overlay]─────────────────────────────────────────┐
│ <Dialog>                                                                 │
│   <DialogContent className="sm:max-w-md"> │ 448px max-width             │
│     <DialogHeader>                                                       │
│       <DialogTitle>Confirm Action</DialogTitle>                         │
│       <DialogDescription>This action cannot be undone.</DialogDescription>│
│     </DialogHeader>                                                       │
│     ░░░ Main content area with appropriate spacing ░░░                   │
│     <DialogFooter className="flex justify-end space-x-2">               │
│       <Button variant="outline">Cancel</Button>                         │
│       <Button variant="destructive">Delete</Button>                     │
│     </DialogFooter>                                                       │
│   </DialogContent>                                                        │
│ </Dialog>                                                                 │
└───────────────────────────────────────────────────────────────────────────┘

RESPONSIVE CONTAINER SYSTEM:
╔═[RESPONSIVE GRID: CSS Grid with Tailwind]══════════════════════════════════╗
║ <div className="container mx-auto px-4"> │ Max-width with center + padding║
║   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> ║
║     ▓▓▓ Mobile: 1 col │ Tablet: 2 cols │ Desktop: 3 cols ▓▓▓            ║
║     <Card>Item 1</Card>                                                    ║
║     <Card>Item 2</Card>                                                    ║
║     <Card>Item 3</Card>                                                    ║
║   </div>                                                                   ║
║ </div>                                                                     ║
╚════════════════════════════════════════════════════════════════════════════╝

ADVANCED LAYOUT PATTERNS:
┏━[TABS CONTAINER: shadcn Tabs with content areas]━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ <Tabs defaultValue="general" className="w-full">                        ┃
┃   <TabsList className="grid grid-cols-3 w-full"> │ Equal width tabs     ┃
┃     <TabsTrigger value="general">General</TabsTrigger>                  ┃
┃     <TabsTrigger value="security">Security</TabsTrigger>                ┃
┃     <TabsTrigger value="billing">Billing</TabsTrigger>                  ┃
┃   </TabsList>                                                            ┃
┃   <TabsContent value="general" className="space-y-4 mt-6">              ┃
┃     ▒▒▒ Content area with consistent spacing ▒▒▒                        ┃
┃   </TabsContent>                                                         ┃
┃ </Tabs>                                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

SCROLLABLE AREAS:
╭─[SCROLL AREA: Long content with custom scrollbar]───────────────────────╮
│ <ScrollArea className="h-96 w-full rounded-md border p-4">              │
│   ░░░ Content exceeding 384px height gets custom scrollbar ░░░          │
│   {Array.from({ length: 50 }).map((_, i) => (                          │
│     <div key={i} className="py-2 border-b">Item {i + 1}</div>          │
│   ))}                                                                    │
│ </ScrollArea>                                                            │
╰──────────────────────────────────────────────────────────────────────────╯

TECHNICAL IMPLEMENTATION:
├─ Layout: import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
├─ Navigation: import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
├─ Overlays: import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
├─ Mobile: import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
├─ Scrolling: import { ScrollArea } from "@/components/ui/scroll-area"
├─ Responsive: Tailwind responsive prefixes (sm:, md:, lg:, xl:, 2xl:)
└─ Spacing: Consistent space-y-4, space-x-2 patterns throughout
```

---

## 📱 Detailed Responsive Specifications

### **Required Breakpoints (All Must Be Documented)**

#### **Desktop Layout (≥1024px) - Primary Layout**

```css
/* Container Specifications */
max-width: 1200px;
margin: 0 auto;
padding: 0 24px;

/* Button Specifications */
Primary CTA: 320×56px
Secondary Button: 160×48px
Touch Target: N/A (mouse interaction)

/* Typography Scale */
Hero: 48px/52px font-bold
Section: 32px/36px font-semibold
Body: 16px/24px font-normal
Small: 14px/20px font-normal

/* Spacing */
Section Gaps: 48px
Element Gaps: 24px
Internal Padding: 16px
```

#### **Mobile Layout (≤767px) - Critical Priority**

```
┌─[MOBILE CONTAINER: 100% width]─────┐
│ Padding: 16px horizontal           │
│                                    │
│ ┌─[HEADER: 100% × 56px]─────────┐  │
│ │ Logo: 100×28px left            │  │
│ │ Menu: 44×44px hamburger right  │  │
│ └────────────────────────────────┘  │
│                                    │
│ ┌─[MAIN CONTENT: 100%]──────────┐  │
│ │ Hero: 36px/40px font-bold      │  │
│ │ Subtitle: 16px/24px            │  │
│ │ Margin: 16px 0                 │  │
│ │                                │  │
│ │ ┌─[CTA: 100% × 48px]────────┐  │  │
│ │ │ Text: 16px font-medium     │  │  │
│ │ │ Touch Target: Full width   │  │  │
│ │ └────────────────────────────┘  │  │
│ │                                │  │
│ │ [Divider: 16px margin]         │  │
│ │                                │  │
│ │ ┌─[OAUTH: 100% × 44px each]─┐  │  │
│ │ │ Stack vertically           │  │  │
│ │ │ Gap: 8px between buttons   │  │  │
│ │ └────────────────────────────┘  │  │
│ └────────────────────────────────┘  │
└────────────────────────────────────┘

CSS IMPLEMENTATION:
@media (max-width: 767px) {
  .container {
    padding: 0 16px;
  }

  .hero-text {
    font-size: 36px;
    line-height: 40px;
  }

  .cta-button {
    width: 100%;
    height: 48px;
  }

  .oauth-buttons {
    flex-direction: column;
    gap: 8px;
  }
}

TOUCH INTERACTIONS:
├─ Minimum Touch Target: 44×44px
├─ Button Height: 48px minimum
├─ Active State: Visual feedback on tap
└─ Swipe Support: Where contextually appropriate
```

---

## 🔄 Comprehensive State Documentation

### **Required States (ALL Must Be Documented)**

#### **1. 🔵 Initial/Empty State - REQUIRED**

```
VISUAL SPECIFICATION:
┌─[EMPTY STATE CONTAINER: 400×300px centered]────────────────────────────────┐
│ ┌─[ICON: 64×64px]──────────────────────────────────────────────────────┐  │
│ │ 📄 Document icon or relevant emoji                                   │  │
│ │ Color: #9ca3af | Position: center                                    │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ┌─[HEADING: auto width × auto height]─────────────────────────────────┐   │
│ │ "No documents yet"                                                   │   │
│ │ 24px/28px font-semibold #374151 | Margin: 16px 0 8px               │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─[DESCRIPTION: auto width × auto height]─────────────────────────────┐   │
│ │ "Upload your first document to get started with digital signatures" │   │
│ │ 16px/24px #6b7280 | Max-width: 300px | Margin: 0 0 24px            │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─[PRIMARY CTA: 200×44px]──────────────────────────────────────────────┐   │
│ │ "Upload Document"                                                    │   │
│ │ Background: #2563eb | Text: #ffffff 16px font-medium               │   │
│ │ Padding: 12px 24px | Radius: 8px                                   │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─[SECONDARY ACTION: auto width]───────────────────────────────────────┐   │
│ │ <View Templates> or <Learn More>                                    │   │
│ │ 16px #2563eb link | Margin: 16px 0 0                               │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘

BEHAVIORAL SPECIFICATIONS:
├─ Animation: Fade in components with 100ms stagger
├─ CTA Action: Open file picker or navigate to upload
├─ Secondary Action: Navigate to templates or help
├─ Analytics: track('empty_state_viewed', { page: 'documents' })
└─ Accessibility: Focus on primary CTA when state loads
```

#### **2. 🟢 Success State - REQUIRED**

```
Must show populated interface with real data examples
Must include all interactive elements in their default states
Must demonstrate proper content hierarchy and spacing
Must include loading indicators for dynamic content
```

#### **3. 🟡 Loading State - REQUIRED**

```
LOADING SPECIFICATION:
┌─[LOADING CONTAINER: Match success state dimensions]────────────────────────┐
│ ┌─[SKELETON: Match actual content structure]─────────────────────────────┐ │
│ │ ┌─[Header Skeleton: 200×24px]───────────────────────────────────────┐ │ │
│ │ │ Background: #f3f4f6 with shimmer animation                       │ │ │
│ │ │ Border-radius: 4px                                               │ │ │
│ │ │ Animation: shimmer 1.5s ease-in-out infinite                     │ │ │
│ │ └───────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │ ┌─[Content Skeleton: 100% × 120px]──────────────────────────────────┐ │ │
│ │ │ Multiple lines of skeleton content                                │ │ │
│ │ │ Line heights match actual text                                    │ │ │
│ │ │ Progressive loading: Lines appear with 100ms stagger             │ │ │
│ │ └───────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │ ┌─[Button Skeleton: 160×44px]───────────────────────────────────────┐ │ │
│ │ │ Same dimensions as actual button                                  │ │ │
│ │ │ Shimmer animation matching other elements                         │ │ │
│ │ └───────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘

CSS IMPLEMENTATION:
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

ACCESSIBILITY:
├─ aria-busy="true" on container
├─ aria-label="Loading content" on skeleton elements
├─ Screen reader announcement: "Loading, please wait"
└─ Focus management: Maintain focus context during loading
```

#### **4. 🔴 Error State - REQUIRED**

```
ERROR STATE SPECIFICATION:
┌─[ERROR CONTAINER: 400×200px centered]──────────────────────────────────────┐
│ ┌─[ERROR ICON: 48×48px]────────────────────────────────────────────────┐  │
│ │ ❌ Error icon or ⚠️ warning icon                                      │  │
│ │ Color: #ef4444 | Position: center top                               │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ┌─[ERROR TITLE: auto width × auto height]─────────────────────────────┐   │
│ │ "Something went wrong"                                               │   │
│ │ 20px/24px font-semibold #ef4444 | Margin: 16px 0 8px               │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─[ERROR DESCRIPTION: auto width × auto height]───────────────────────┐   │
│ │ "We couldn't load your documents. This might be a network issue."   │   │
│ │ 16px/24px #6b7280 | Max-width: 350px | Margin: 0 0 24px            │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─[RECOVERY ACTIONS: auto width]───────────────────────────────────────┐   │
│ │ ┌─[PRIMARY: 120×40px]─────┐ ┌─[SECONDARY: 100×40px]──────────────┐  │   │
│ │ │ "Try Again"             │ │ "Contact Support"                  │  │   │
│ │ │ #2563eb bg, #fff text   │ │ #f3f4f6 bg, #374151 text          │  │   │
│ │ └─────────────────────────┘ └────────────────────────────────────┘  │   │
│ │ Gap: 12px between buttons                                            │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘

BEHAVIORAL SPECIFICATIONS:
├─ Retry Logic: Primary button retries the failed operation
├─ Support Action: Opens help center or contact form
├─ Error Tracking: Log error details for debugging
├─ Analytics: track('error_occurred', { error_type: 'load_failure' })
├─ Auto-Recovery: Attempt retry after 30 seconds if user inactive
└─ Accessibility: Error announced immediately, focus on primary action

TECHNICAL INTEGRATION:
├─ Error Boundary: React Error Boundary catches render errors
├─ API Error Handling: Specific error messages based on HTTP status
├─ Retry Strategy: Exponential backoff for transient errors
└─ Logging: Send error details to monitoring service
```

---

## 🧩 Technical Implementation Requirements

### **Component Architecture (REQUIRED for all wireframes)**

#### **Data Requirements Specification**

```javascript
// REQUIRED: Define exact data needs for each wireframe
interface WireframeDataRequirements {
  // Authentication Context
  user: {
    isAuthenticated: boolean;
    profile: UserProfile | null;
    permissions: string[];
    currentWorkspace: WorkspaceContext;
  };

  // Page-Specific Data
  pageData: {
    // Specify exact API endpoints
    source: 'GET /api/endpoint' | 'Convex query: api.collection.method';
    required: boolean;
    fallback: any; // What to show if data unavailable
    realTimeUpdates: boolean;
  };

  // UI State Management
  uiState: {
    loading: Record<string, boolean>;
    errors: Record<string, string | null>;
    modals: Record<string, boolean>;
    forms: Record<string, FormState>;
  };
}

// REQUIRED: Define all possible actions
interface WireframeActions {
  // Navigation Actions
  navigation: {
    goBack: () => void;
    goForward: (path: string) => void;
    openModal: (modalId: string) => void;
    closeModal: (modalId: string) => void;
  };

  // Data Actions
  data: {
    refetch: () => Promise<void>;
    create: (data: any) => Promise<void>;
    update: (id: string, data: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  // Analytics Actions
  analytics: {
    trackPageView: () => void;
    trackInteraction: (event: string, properties: any) => void;
    trackError: (error: Error, context: any) => void;
  };
}
```

#### **Clerk Integration (REQUIRED)**

```javascript
// REQUIRED: Specify authentication requirements
interface AuthRequirements {
  // Access Control
  minimumRole: 'member' | 'admin' | 'owner';
  workspaceRequired: boolean;
  specificPermissions: string[]; // e.g., ['document.create', 'billing.view']

  // Authentication Flow
  redirectIfUnauthenticated: string; // e.g., '/signin'
  redirectAfterAuth: string; // e.g., '/dashboard'

  // Session Management
  requireRecentAuth: boolean; // For sensitive operations
  mfaRequired: boolean;

  // API Integration
  protectedRoutes: string[]; // API endpoints that require auth
  authHeaders: boolean; // Include auth in API requests
}

// REQUIRED: Define auth-dependent UI states
interface AuthUIStates {
  unauthenticated: WireframeState;
  authenticated: WireframeState;
  insufficientPermissions: WireframeState;
  authExpired: WireframeState;
}
```

#### **Convex Integration (REQUIRED)**

```javascript
// REQUIRED: Specify real-time data needs
interface ConvexIntegration {
  // Queries (READ operations)
  queries: {
    [queryName: string]: {
      api: string; // e.g., 'api.documents.list'
      args: any; // Query arguments
      realTime: boolean; // Subscribe to changes
      dependencies: string[]; // Other queries this depends on
    };
  };

  // Mutations (WRITE operations)
  mutations: {
    [mutationName: string]: {
      api: string; // e.g., 'api.documents.create'
      optimistic: boolean; // Update UI immediately
      invalidates: string[]; // Queries to refetch after mutation
      rollback: any; // How to rollback if mutation fails
    };
  };

  // Actions (Server functions)
  actions: {
    [actionName: string]: {
      api: string; // e.g., 'api.email.send'
      async: boolean; // Long-running operation
      polling: boolean; // Poll for completion status
    };
  };
}
```

---

## 📋 Quality Assurance Checklist

### **Pre-Development Handoff (ALL Must Pass)**

#### **Visual Specifications Complete**

- [ ] **Exact dimensions specified** for all elements (width × height in px)
- [ ] **Color values defined** using design tokens (hex codes from design-tokens.md)
- [ ] **Typography scales documented** (font-size/line-height font-weight)
- [ ] **Spacing measurements included** (margins, padding, gaps in px)
- [ ] **Border radius and shadows** specified with exact CSS values
- [ ] **Responsive breakpoints** defined for mobile, tablet, desktop
- [ ] **Animation specifications** included (duration, easing, keyframes)

#### **Interactive Behavior Complete**

- [ ] **All 5 states documented** (Initial, Success, Loading, Error, Edge cases)
- [ ] **Button interaction matrix** defined (default, hover, focus, active, disabled)
- [ ] **Form validation rules** specified with error messages
- [ ] **Navigation behaviors** documented (back button, external links, modals)
- [ ] **Loading strategies** defined (skeleton screens, progress indicators)
- [ ] **Error recovery paths** specified for each failure mode
- [ ] **Accessibility requirements** documented (ARIA labels, focus management)

#### **Technical Integration Complete**

- [ ] **Data requirements interface** defined with exact API endpoints
- [ ] **Authentication requirements** specified (roles, permissions, redirects)
- [ ] **Real-time subscriptions** identified (Convex queries/mutations)
- [ ] **Component architecture** planned (props, state, side effects)
- [ ] **Performance requirements** specified (loading times, bundle size)
- [ ] **Analytics events** defined (pageviews, interactions, errors)
- [ ] **Error boundaries** and fallback strategies documented

#### **Cross-Platform Compatibility**

- [ ] **Mobile layout tested** at 320px width minimum
- [ ] **Touch targets verified** minimum 44px height
- [ ] **Keyboard navigation** order documented
- [ ] **Screen reader compatibility** verified (semantic HTML, ARIA)
- [ ] **Dark mode considerations** (if applicable)
- [ ] **Reduced motion support** (respect user preferences)
- [ ] **High contrast mode** compatibility verified

---

## 🎯 Implementation Priority

### **Wireframe Detail Levels**

#### **Level 1: Critical User Journeys (Maximum Detail Required)**

- Landing page and authentication flows
- Document upload and signing ceremony
- Checkout and billing flows
- First-time user onboarding
- Mobile-critical interactions

**Requirements:**

- Pixel-perfect specifications
- Complete state matrices
- Full responsive documentation
- Comprehensive technical integration
- Performance budgets defined
- Analytics instrumentation complete

#### **Level 2: Core Application Features (High Detail Required)**

- Dashboard and document management
- Profile and workspace settings
- Templates and bulk operations
- Admin and compliance features
- API key management

**Requirements:**

- Detailed dimensions and spacing
- All interactive states documented
- Responsive behaviors specified
- Key technical integrations defined
- Error handling strategies
- Basic analytics tracking

#### **Level 3: Secondary Features (Moderate Detail Required)**

- Help and support interfaces
- Advanced settings and preferences
- Edge case handling interfaces
- Admin tooling and debugging
- Marketing and informational pages

**Requirements:**

- Standard component specifications
- Primary states documented
- Mobile responsiveness confirmed
- Basic technical requirements
- Standard error handling

---

## 🔄 Maintenance and Updates

### **Wireframe Version Control**

```markdown
## Version History Template (Required for all wireframes)

### v1.2.0 - 2024-01-15

**Changes:**

- Enhanced mobile layout for better touch interaction
- Added loading states for async operations
- Updated color values to match design-tokens.md v2.1

**Technical Updates:**

- Added Convex real-time subscriptions
- Updated Clerk integration patterns
- New analytics events for user behavior tracking

**Breaking Changes:**

- Button component API updated (size prop renamed)
- Navigation structure modified (affects routing)

**Migration Guide:**

- Update button components: size="large" → size="lg"
- Review navigation links in existing implementations
```

### **Cross-Reference Maintenance**

- **Design Tokens**: Verify all color/typography references match current tokens
- **Component Library**: Ensure wireframes align with implemented components
- **API Documentation**: Keep endpoint specifications in sync with backend
- **Flow Diagrams**: Update user flow documentation when wireframes change

---

## ✅ Success Criteria

### **Developer Handoff Quality**

A wireframe is ready for development when:

- [ ] Developer can implement without asking clarifying questions
- [ ] All visual specifications have exact measurements
- [ ] All interactive behaviors are clearly defined
- [ ] Technical integration requirements are complete
- [ ] Error handling strategies are comprehensive
- [ ] Performance requirements are specified
- [ ] Analytics and tracking are instrumented

### **Design Consistency Quality**

A wireframe maintains design consistency when:

- [ ] Uses established design tokens and patterns
- [ ] Follows accessibility guidelines consistently
- [ ] Matches interaction patterns from similar features
- [ ] Maintains brand voice and visual hierarchy
- [ ] Integrates seamlessly with existing user flows

---

**Remember: Every wireframe must be detailed enough that a developer can implement it without asking questions. No basic ASCII wireframes allowed.**
