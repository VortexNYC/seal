# Component Interaction Matrix - shadcn/ui Integration Patterns

## Overview

This document maps how shadcn/ui components interact with each other, including data dependencies, event propagation, state management patterns, and compound component usage. Use this as a reference for understanding component relationships in wireframes.

---

## 🎯 Component Relationship Types

### **Composition Relationships**

- **Container → Child**: Parent components that wrap child components
- **Compound**: Multiple components that work together as a unit
- **Trigger → Content**: Components that control the visibility of other components

### **Data Flow Relationships**

- **Form Control**: Form fields that share validation state
- **Selection**: Components that maintain selected state
- **Filtering**: Components that control data display in other components

### **Event Relationships**

- **Click Handlers**: Components that respond to user interactions
- **Focus Management**: Components that control focus flow
- **State Synchronization**: Components that share reactive state

---

## 🔗 Core Interaction Patterns

### **Form Ecosystem (react-hook-form + zod)**

```
Form Component Hierarchy:
├─ <Form> (Root context provider)
│  ├─ <FormField> (Field wrapper with validation)
│  │  ├─ <FormItem> (Layout container)
│  │  ├─ <FormLabel> (Accessible label)
│  │  ├─ <FormControl> (Input wrapper)
│  │  │  └─ <Input|Select|Textarea|Checkbox> (Actual input)
│  │  ├─ <FormDescription> (Help text)
│  │  └─ <FormMessage> (Error display)
│  └─ <Button type="submit"> (Form submission)

Data Flow:
Form Context → FormField → FormControl → Input Component
Error State: zod validation → FormMessage (automatic display)
Submit Flow: Button → Form onSubmit → validation → success/error states
```

#### **Form Field Interactions**

```javascript
// Real-time validation example:
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input
          type="email"
          placeholder="john@example.com"
          {...field}
          onChange={(e) => {
            field.onChange(e) // Updates form state
            // Triggers real-time validation
            // Updates other dependent fields if needed
          }}
        />
      </FormControl>
      <FormMessage /> {/* Auto-displays validation errors */}
    </FormItem>
  )}
/>

// Field dependencies (e.g., confirm password):
<FormField
  control={form.control}
  name="confirmPassword"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input
          type="password"
          {...field}
          disabled={!form.watch("password")} // Depends on password field
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 🎛️ Overlay System Interactions

### **Dialog/Modal Ecosystem**

```
Dialog Component Tree:
├─ <Dialog> (State container: open/closed)
│  ├─ <DialogTrigger> (Opens dialog)
│  └─ <DialogContent> (Modal overlay)
│     ├─ <DialogHeader>
│     │  ├─ <DialogTitle>
│     │  └─ <DialogDescription>
│     ├─ <DialogBody> (Main content area)
│     └─ <DialogFooter> (Action buttons)

Interaction Flow:
Trigger Click → Dialog Opens → Focus Management → Action Buttons → Close/Submit
```

#### **Dialog State Management**

```javascript
// Controlled dialog pattern:
const [open, setOpen] = useState(false)

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button onClick={() => setOpen(true)}>Open Settings</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
    </DialogHeader>
    {/* Form or content that may need to close dialog */}
    <Form onSubmit={(data) => {
      handleSubmit(data)
      setOpen(false) // Close on success
    }}>
      {/* Form fields */}
    </Form>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button type="submit" form="settings-form">
        Save Changes
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### **Sheet (Mobile Drawer) Interactions**

```
Sheet vs Dialog Usage:
- Desktop: Dialog for focused tasks, Sheet for navigation/settings
- Mobile: Sheet becomes full-screen, Dialog stays centered
- Touch: Sheet supports swipe-to-close gestures

Sheet Component Flow:
├─ <Sheet> (Slide-in container)
│  ├─ <SheetTrigger> (Opens sheet from side)
│  └─ <SheetContent side="right|left|top|bottom">
│     ├─ <SheetHeader>
│     ├─ <SheetBody> (Scrollable content)
│     └─ <SheetFooter> (Sticky actions)
```

---

## 📊 Data Display Component Interactions

### **Table Ecosystem (TanStack Table + shadcn/ui)**

```
Data Table Component Hierarchy:
├─ <DataTable> (Root table container)
│  ├─ <DataTableToolbar> (Search, filters, actions)
│  │  ├─ <Input> (Search field)
│  │  ├─ <Select> (Filter dropdowns)
│  │  └─ <DropdownMenu> (Column visibility)
│  ├─ <Table> (Actual table element)
│  │  ├─ <TableHeader> (Column headers with sorting)
│  │  └─ <TableBody> (Data rows)
│  │     └─ <TableRow>
│  │        ├─ <TableCell> (Data cells)
│  │        └─ <DropdownMenu> (Row actions)
│  └─ <DataTablePagination> (Page controls)

Data Flow:
Search Input → Filter State → Table Re-render
Sort Click → Column State → Data Re-sort
Row Action → External State Update → Table Refresh
```

#### **Table State Interactions**

```javascript
// Table with external state management:
const [data, setData] = useState(documents)
const [sorting, setSorting] = useState([])
const [columnFilters, setColumnFilters] = useState([])
const [globalFilter, setGlobalFilter] = useState("")

const table = useReactTable({
  data,
  columns,
  state: {
    sorting,
    columnFilters,
    globalFilter,
  },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onGlobalFilterChange: setGlobalFilter,
})

// Components interact with table state:
<Input
  placeholder="Search documents..."
  value={globalFilter}
  onChange={(e) => setGlobalFilter(e.target.value)} // Updates all table data
/>

<Button onClick={() => setSorting([{ id: 'createdAt', desc: true }])}>
  Sort by Date
</Button>
```

---

## 🎨 Navigation Component Interactions

### **Tabs System**

```
Tabs Component Flow:
├─ <Tabs defaultValue="tab1"> (State container)
│  ├─ <TabsList> (Tab headers)
│  │  └─ <TabsTrigger value="tab1"> (Individual tabs)
│  └─ <TabsContent value="tab1"> (Content panels)

State Flow:
Tab Click → Active State Change → Content Panel Switch
External State → Programmatic Tab Change → UI Update
```

#### **Tabs with Form Integration**

```javascript
// Tabs that preserve form state across switches:
const [activeTab, setActiveTab] = useState("general")
const form = useForm() // Form state persists across tabs

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="security">Security</TabsTrigger>
  </TabsList>

  <Form {...form}>
    <TabsContent value="general">
      {/* General form fields */}
      <FormField name="name" ... />
    </TabsContent>

    <TabsContent value="security">
      {/* Security form fields - same form context */}
      <FormField name="password" ... />
    </TabsContent>

    {/* Submit button affects all tabs */}
    <Button type="submit">Save All Settings</Button>
  </Form>
</Tabs>
```

---

## 🔄 Command System Interactions

### **Command Palette (⌘K) Integration**

```
Command Component Hierarchy:
├─ <CommandDialog> (Full-screen overlay)
│  ├─ <CommandInput> (Search field)
│  ├─ <CommandList> (Results container)
│  │  ├─ <CommandEmpty> (No results state)
│  │  ├─ <CommandGroup> (Grouped results)
│  │  │  └─ <CommandItem> (Individual results)
│  │  │     └─ <CommandShortcut> (Keyboard hint)
│  └─ <CommandSeparator> (Visual dividers)

Interaction Patterns:
Keyboard Shortcut (⌘K) → Dialog Opens → Focus Input
Type Search → Filter Results → Navigate with Arrows
Select Item → Execute Action → Close Dialog
```

#### **Command Integration with App State**

```javascript
// Command palette that integrates with routing and actions:
const [open, setOpen] = useState(false)
const navigate = useNavigate()

// Global keyboard handler:
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

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandGroup heading="Navigation">
      <CommandItem onSelect={() => {
        navigate('/documents')
        setOpen(false) // Close after navigation
      }}>
        <FileText className="mr-2 h-4 w-4" />
        Documents
      </CommandItem>
    </CommandGroup>

    <CommandGroup heading="Actions">
      <CommandItem onSelect={() => {
        // Trigger external action
        createNewDocument()
        setOpen(false)
      }}>
        <Plus className="mr-2 h-4 w-4" />
        Create Document
        <CommandShortcut>⌘N</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

---

## 🔄 Toast Notification System

### **Toast State Management**

```
Toast Interaction Flow:
User Action → toast() Function Call → Toast Queue → Display → Auto-dismiss/User Action

Toast Types:
├─ Success: Green, auto-dismiss after 5s
├─ Error: Red, persist until user action
├─ Warning: Yellow, auto-dismiss after 8s
├─ Info: Blue, auto-dismiss after 4s
└─ Loading: Gray, persist until manually updated

Toast with Actions:
├─ Primary Action: <ToastAction> (Undo, Retry, etc.)
├─ Dismiss: <ToastClose> (X button)
└─ Auto-dismiss: setTimeout based on variant
```

#### **Toast Integration Patterns**

```javascript
// Toast with optimistic updates:
const handleDelete = async (id: string) => {
  // Optimistic update
  setDocuments(docs => docs.filter(d => d.id !== id))

  const { dismiss } = toast({
    title: "Document deleted",
    description: "Document has been removed.",
    action: (
      <ToastAction
        altText="Undo delete"
        onClick={() => {
          // Revert optimistic update
          setDocuments(originalDocuments)
          dismiss() // Close this toast
        }}
      >
        Undo
      </ToastAction>
    ),
  })

  try {
    await deleteDocument(id)
    // Success - toast auto-dismisses
  } catch (error) {
    // Revert on error
    setDocuments(originalDocuments)
    dismiss()

    toast({
      variant: "destructive",
      title: "Delete failed",
      description: "Could not delete document. Please try again.",
      action: (
        <ToastAction altText="Retry" onClick={() => handleDelete(id)}>
          Retry
        </ToastAction>
      ),
    })
  }
}
```

---

## 📱 Responsive Component Interactions

### **Sheet vs Dialog Responsive Behavior**

```javascript
// Conditional component based on screen size:
const isMobile = useMediaQuery("(max-width: 768px)");

const SettingsModal = () => {
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button>Settings</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <SettingsForm />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Settings</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsForm />
      </DialogContent>
    </Dialog>
  );
};
```

---

## 🎯 Complex Interaction Examples

### **Multi-Component Document Upload Flow**

```
Component Interaction Chain:
1. <Button> (Upload trigger)
2. <Dialog> (Upload modal opens)
3. <Form> (File selection form)
4. <Input type="file"> (File picker)
5. <Progress> (Upload progress)
6. <Alert> (Success/error feedback)
7. <Toast> (Global notification)
8. <DataTable> (Refresh document list)

State Dependencies:
├─ File Selection → Upload Form Validation
├─ Upload Progress → Progress Bar + Button States
├─ Upload Success → Dialog Close + Toast + Table Refresh
└─ Upload Error → Error Alert + Retry Options
```

```javascript
const DocumentUploadFlow = () => {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)

    try {
      await uploadWithProgress(file, (progress) => {
        setUploadProgress(progress) // Updates progress bar
      })

      // Success chain:
      setUploadOpen(false) // Close dialog
      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded.`,
      })

      // Refresh document list (external state)
      await refetchDocuments()

    } catch (error) {
      // Error handling - keep dialog open
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
        action: <ToastAction onClick={() => handleUpload(file)}>Retry</ToastAction>
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <>
      <Button onClick={() => setUploadOpen(true)}>
        Upload Document
      </Button>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <Form onSubmit={handleUpload}>
            <FormField
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="file"
                      disabled={uploading}
                      onChange={(e) => field.onChange(e.target.files[0])}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-muted-foreground">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </Form>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !form.watch("file")}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

---

## ✅ Component Interaction Checklist

### **When Designing Component Interactions**

- [ ] **State Dependencies**: Which components share state?
- [ ] **Event Propagation**: How do user actions flow between components?
- [ ] **Focus Management**: Where does focus go after interactions?
- [ ] **Error Handling**: How do errors affect related components?
- [ ] **Loading States**: Which components show loading during async operations?
- [ ] **Responsive Behavior**: How do interactions change on mobile vs desktop?
- [ ] **Accessibility**: Are all interactions keyboard and screen reader accessible?

### **Performance Considerations**

- [ ] **Re-render Optimization**: Minimize unnecessary component updates
- [ ] **State Locality**: Keep state as close to usage as possible
- [ ] **Event Delegation**: Use efficient event handling patterns
- [ ] **Memory Management**: Clean up subscriptions and timeouts

---

This interaction matrix ensures that all component relationships are clearly defined and consistently implemented throughout the application.
