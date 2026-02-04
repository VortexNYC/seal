# ASCII to shadcn/ui Component Mapping

## Overview

This document maps every ASCII wireframe element to its corresponding shadcn/ui component implementation. Use this as a reference when converting wireframes to actual code.

---

## 🔘 Button Elements

### Primary Button (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[BUTTON TEXT: 280×48px]─────────────────────────────────┐
│ ████ Get Started ████                                  │
│ Background: #2563eb | Hover: #1d4ed8 | Radius: 8px     │
│ Padding: 12px 24px | Shadow: 0 1px 3px rgba(0,0,0,0.1) │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Button variant="default" size="lg">
  Get Started
</Button>

// Custom styling if needed
<Button variant="default" size="lg" className="w-[280px] h-12">
  Get Started
</Button>
```

### Secondary Button (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[SECONDARY BUTTON: 200×40px]───────────────────────────┐
│ ▢▢▢▢ Learn More ▢▢▢▢                                  │
│ Border: #e5e7eb | Hover: #f3f4f6 | Text: #374151      │
│ Padding: 8px 16px | Radius: 6px                        │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Button variant="outline" size="default">
  Learn More
</Button>

// With custom width
<Button variant="outline" size="default" className="w-[200px]">
  Learn More
</Button>
```

### Destructive Button (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[DELETE BUTTON: 120×36px]──────────────────────────────┐
│ ████ Delete ████                                      │
│ Background: #ef4444 | Hover: #dc2626 | Text: #ffffff  │
│ Padding: 8px 12px | Radius: 6px                        │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Button variant="destructive" size="sm">
  Delete
</Button>
```

### Loading Button State

```
WIREFRAME ASCII:
┌─[LOADING BUTTON: 280×48px]─────────────────────────────┐
│ ⏳ Loading... (spinner + disabled state)              │
│ Background: #e5e7eb | Text: #9ca3af | Disabled         │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Button variant="default" size="lg" disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>

// Import needed:
import { Loader2 } from "lucide-react"
```

---

## 📝 Form Input Elements

### Text Input (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[INPUT FIELD: 320×44px]─────────────────────────────────┐
│ Placeholder: "Enter your email" #9ca3af 16px           │
│ Border: 1px solid #e5e7eb | Focus: #3b82f6            │
│ Padding: 12px 16px | Radius: 6px                       │
│ Font: 16px #374151 | Background: #ffffff               │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Input
  type="email"
  placeholder="Enter your email"
  className="w-[320px] h-11"
/>

// With form integration:
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input placeholder="Enter your email" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Input with Error State

```
WIREFRAME ASCII:
┌─[INPUT FIELD: 320×44px]─────────────────────────────────┐
│ john@invalid                                           │
│ Border: #ef4444 | Background: #ffffff                  │
│ ❌ Please enter a valid email address                  │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<div className="space-y-2">
  <Input
    type="email"
    value="john@invalid"
    className="border-destructive focus-visible:ring-destructive"
  />
  <p className="text-sm text-destructive">
    Please enter a valid email address
  </p>
</div>

// Or with form integration (handles error automatically):
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Shows error automatically */}
    </FormItem>
  )}
/>
```

### Select Dropdown (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[SELECT FIELD: 280×44px]───────────────────────────────┐
│ Choose workspace type ▼                                │
│ Border: #e5e7eb | Background: #ffffff                  │
│ Options: Personal | Team | Enterprise                  │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Select>
  <SelectTrigger className="w-[280px]">
    <SelectValue placeholder="Choose workspace type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="personal">Personal</SelectItem>
    <SelectItem value="team">Team</SelectItem>
    <SelectItem value="enterprise">Enterprise</SelectItem>
  </SelectContent>
</Select>

// With form integration:
<FormField
  control={form.control}
  name="workspaceType"
  render={({ field }) => (
    <FormItem>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Choose workspace type" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="personal">Personal</SelectItem>
          <SelectItem value="team">Team</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 🗂️ Layout Components

### Card Container (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[CARD: 400×300px]──────────────────────────────────────┐
│ Padding: 24px | Background: #ffffff                    │
│ Border: 1px solid #e5e7eb | Radius: 8px               │
│ Shadow: 0 1px 3px rgba(0,0,0,0.1)                     │
│                                                        │
│ [Card content goes here]                               │
│                                                        │
└────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Card className="w-[400px] h-[300px]">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Footer content like buttons */}
  </CardFooter>
</Card>

// Simple card without header/footer:
<Card className="p-6">
  {/* Content */}
</Card>
```

### Alert/Toast Messages (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[SUCCESS ALERT: 100% width × 48px]─────────────────────┐
│ ✅ Document uploaded successfully!                     │
│ Background: #dcfce7 | Border: #16a34a | Text: #166534  │
│ Padding: 12px 16px | Radius: 6px                       │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Alert>
  <CheckCircle className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>
    Document uploaded successfully!
  </AlertDescription>
</Alert>

// Error variant:
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong. Please try again.
  </AlertDescription>
</Alert>

// For toast notifications:
import { toast } from "@/components/ui/use-toast"

toast({
  title: "Success",
  description: "Document uploaded successfully!",
})
```

---

## 📊 Data Display Components

### Table (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[TABLE: 100% width]────────────────────────────────────┐
│ ┌─[HEADER]──────┬─[HEADER]──────┬─[ACTIONS]─────────┐ │
│ │ Document      │ Status        │ Actions           │ │
│ ├───────────────┼───────────────┼───────────────────┤ │
│ │ Contract.pdf  │ ✅ Signed     │ [View] [Download] │ │
│ │ NDA.pdf       │ ⏳ Pending    │ [Send] [Edit]     │ │
│ └───────────────┴───────────────┴───────────────────┘ │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Document</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Contract.pdf</TableCell>
      <TableCell>
        <Badge variant="success">Signed</Badge>
      </TableCell>
      <TableCell className="text-right space-x-2">
        <Button variant="outline" size="sm">View</Button>
        <Button variant="outline" size="sm">Download</Button>
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell>NDA.pdf</TableCell>
      <TableCell>
        <Badge variant="secondary">Pending</Badge>
      </TableCell>
      <TableCell className="text-right space-x-2">
        <Button variant="outline" size="sm">Send</Button>
        <Button variant="outline" size="sm">Edit</Button>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## 🗄️ Navigation Components

### Tabs (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[TABS: 100% width]─────────────────────────────────────┐
│ [●Documents] [○Templates] [○Settings]                  │
│ ═════════════════════════════════════════════════════   │
│                                                        │
│ [Active tab content shown here]                        │
│                                                        │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Tabs defaultValue="documents" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="documents">Documents</TabsTrigger>
    <TabsTrigger value="templates">Templates</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="documents" className="space-y-4">
    {/* Documents content */}
  </TabsContent>
  <TabsContent value="templates" className="space-y-4">
    {/* Templates content */}
  </TabsContent>
  <TabsContent value="settings" className="space-y-4">
    {/* Settings content */}
  </TabsContent>
</Tabs>
```

### Command Palette (⌘K Interface)

```
WIREFRAME ASCII:
╔═[COMMAND PALETTE: Full-screen overlay]═════════════════════════════════════╗
║ ⌘K Search commands, documents, and settings...                            ║
║ ├─────────────────────────────────────────────────────────────────────────║
║ │ 🔍 Create new document                                         ⌘N      │
║ │ 📄 Upload document                                            ⌘U      │
║ │ ⚙️ Open settings                                              ⌘,      │
║ │ 📊 View analytics                                             ⌘A      │
║ └─────────────────────────────────────────────────────────────────────────║
╚═════════════════════════════════════════════════════════════════════════════╝

SHADCN/UI IMPLEMENTATION:
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Documents">
      <CommandItem onSelect={() => navigate('/documents/new')}>
        <FileText className="mr-2 h-4 w-4" />
        <span>Create new document</span>
        <CommandShortcut>⌘N</CommandShortcut>
      </CommandItem>
      <CommandItem onSelect={() => navigate('/upload')}>
        <Upload className="mr-2 h-4 w-4" />
        <span>Upload document</span>
        <CommandShortcut>⌘U</CommandShortcut>
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="Settings">
      <CommandItem onSelect={() => navigate('/settings')}>
        <Settings className="mr-2 h-4 w-4" />
        <span>Open settings</span>
        <CommandShortcut>⌘,</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>

// Keyboard shortcut handler:
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen((open) => !open)
    }
  }
  document.addEventListener("keydown", down)
  return () => document.removeEventListener("keydown", down)
}, [])
```

---

## 🎛️ Advanced Components

### Dialog/Modal (Enhanced ASCII)

```
WIREFRAME ASCII:
┌─[MODAL OVERLAY: 100% screen]───────────────────────────┐
│                                                        │
│    ┌─[MODAL: 500×300px centered]─────────────────────┐ │
│    │ ┌─[HEADER]──────────────────────────────────[✕]┐ │ │
│    │ │ Delete Document?                           │ │ │
│    │ └────────────────────────────────────────────────┘ │ │
│    │                                                │ │
│    │ Are you sure you want to delete this document?│ │
│    │ This action cannot be undone.                 │ │
│    │                                                │ │
│    │ ┌─[ACTIONS]─────────────────────────────────────┐ │ │
│    │ │           [Cancel] [Delete]                  │ │ │
│    │ └──────────────────────────────────────────────┘ │ │
│    └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Delete Document?</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this document? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 📊 Advanced Data Display

### Data Table with Sorting, Filtering, and Pagination

```
WIREFRAME ASCII:
╔═[DATA TABLE: Full featured with controls]══════════════════════════════════╗
║ ┌─[SEARCH BAR]─────┐ ┌─[FILTER DROPDOWN]─┐ ┌─[COLUMNS]─┐                ║
║ │ 🔍 Search docs... │ │ All statuses ▼    │ │ Columns ▼ │                ║
║ └───────────────────┘ └────────────────────┘ └───────────┘                ║
║                                                                            ║
║ ┌─[TABLE HEADER with sorting]──────────────────────────────────────────┐   ║
║ │ Name ↕ │ Status ↕ │ Created ↓ │ Size ↕ │ Actions     │                ║
║ ├─────────┼──────────┼───────────┼────────┼─────────────┤                ║
║ │ Doc1    │ ✅ Signed │ Jan 15    │ 2.1MB  │ ⋯ [Menu]    │                ║
║ │ Doc2    │ ⏳ Pending│ Jan 14    │ 1.8MB  │ ⋯ [Menu]    │                ║
║ │ Doc3    │ 📝 Draft  │ Jan 13    │ 900KB  │ ⋯ [Menu]    │                ║
║ └─────────┴──────────┴───────────┴────────┴─────────────┘                ║
║                                                                            ║
║ Showing 3 of 24 results  [← Prev] [1][2][3]...[8] [Next →]               ║
╚════════════════════════════════════════════════════════════════════════════╝

SHADCN/UI IMPLEMENTATION:
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"

const columns: ColumnDef<Document>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("status") === "signed" ? "success" : "warning"}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">⋯</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>View</DropdownMenuItem>
          <DropdownMenuItem>Download</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

<DataTable columns={columns} data={documents} searchKey="name" />
```

### Toast Notification Stack

```
WIREFRAME ASCII:
                                        ┌─[TOAST STACK: Fixed position top-right]─┐
                                        │ ✅ Document uploaded successfully!       │
                                        │    [Undo] [×]                           │
                                        ├─────────────────────────────────────────┤
                                        │ ⚠️ Connection lost. Retrying...         │
                                        │    [Retry] [×]                          │
                                        └─────────────────────────────────────────┘

SHADCN/UI IMPLEMENTATION:
import { toast } from "@/components/ui/use-toast"

// Success with action:
toast({
  title: "Document uploaded successfully!",
  action: <ToastAction onClick={handleUndo}>Undo</ToastAction>,
})

// Error with retry:
toast({
  variant: "destructive",
  title: "Connection lost",
  action: <ToastAction onClick={handleRetry}>Retry</ToastAction>,
})
```

---

## 📋 Form Patterns

### Advanced Multi-Step Form with Validation

```
WIREFRAME ASCII:
╔═[ADVANCED FORM: Multi-step with validation]════════════════════════════════╗
║                                                                            ║
║ Create New Workspace (Step 2 of 3) ──────────── [●●○]                    ║
║                                                                            ║
║ ┌─[INPUT: Workspace Name with validation]─────────────────────────────┐   ║
║ │ My Company ✅                                                        │   ║
║ │ Workspace name must be unique and 3-50 characters                   │   ║
║ └──────────────────────────────────────────────────────────────────────┘   ║
║                                                                            ║
║ ┌─[COMBOBOX: Plan Type with search]───────────────────────────────────┐   ║
║ │ Professional Plan (Recommended) ▼                                   │   ║
║ │ ░░░ $29/month • Up to 10 users • Advanced features ░░░             │   ║
║ └──────────────────────────────────────────────────────────────────────┘   ║
║                                                                            ║
║ [← Back]                                           [Continue →]             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

SHADCN/UI IMPLEMENTATION:
<Form {...form}>
  <div className="flex items-center justify-between mb-8">
    <h2>Create New Workspace</h2>
    <div className="flex space-x-2">
      <div className="w-2 h-2 bg-primary rounded-full" />
      <div className="w-2 h-2 bg-primary rounded-full" />
      <div className="w-2 h-2 bg-muted rounded-full" />
    </div>
  </div>

  <FormField
    control={form.control}
    name="workspaceName"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Workspace Name</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormDescription>
          Workspace name must be unique and 3-50 characters
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="planType"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Plan Type</FormLabel>
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <Button variant="outline" role="combobox">
                {field.value || "Select plan..."}
                <ChevronsUpDown className="ml-2 h-4 w-4" />
              </Button>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent>
            <Command>
              <CommandInput placeholder="Search plans..." />
              <CommandList>
                <CommandItem onSelect={() => field.onChange("professional")}>
                  Professional Plan (Recommended)
                  <br />
                  <small className="text-muted-foreground">
                    $29/month • Up to 10 users • Advanced features
                  </small>
                </CommandItem>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </FormItem>
    )}
  />
</Form>
```

---

## 🎨 Design Tokens Integration

### Color Mapping

```
WIREFRAME COLOR → SHADCN/UI TOKEN
#2563eb (Primary) → bg-primary, text-primary
#ef4444 (Error) → bg-destructive, text-destructive
#10b981 (Success) → bg-green-500 (or custom success variant)
#f3f4f6 (Muted) → bg-muted
#e5e7eb (Border) → border-input
#9ca3af (Placeholder) → text-muted-foreground
```

### Size Mapping

```
WIREFRAME SIZE → SHADCN/UI SIZE
Small buttons (120×36px) → size="sm"
Default buttons (200×40px) → size="default"
Large buttons (280×48px) → size="lg"
Input height (44px) → h-11 (default Input height)
```

---

## 🔄 State Variations

### Loading States

```
All ⏳ symbols in wireframes = <Loader2 className="animate-spin" />
All "Loading..." text = disabled state + spinner icon
All skeleton content = Skeleton component from shadcn/ui
```

### Error States

```
All ❌ symbols = variant="destructive"
All error text = text-destructive className
All error borders = border-destructive className
```

### Success States

```
All ✅ symbols = CheckCircle icon or Badge variant="success"
All success messages = Alert component or toast notification
```

---

This mapping document ensures that every ASCII element in your wireframes has a direct, implementation-ready shadcn/ui equivalent. Developers can reference this to convert wireframes to code efficiently and consistently.
