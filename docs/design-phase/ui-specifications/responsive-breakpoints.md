# Responsive Breakpoints - Mobile-First Design System

**Using TailwindCSS v4 + NativeWind with shadcn/ui components for consistent responsive behavior across web and mobile.**

## Core Breakpoint Strategy

### TailwindCSS v4 Breakpoints
```typescript
// Mobile-first approach (min-width)
const breakpoints = {
  sm: '640px',    // Large phones landscape, small tablets
  md: '768px',    // Tablets portrait
  lg: '1024px',   // Small laptops, tablets landscape  
  xl: '1280px',   // Desktop monitors
  '2xl': '1536px', // Large desktop monitors
}
```

### Device Context Mapping
```
Mobile:    320px - 639px   (Primary target)
Tablet:    640px - 1023px  (Secondary target)  
Desktop:   1024px+         (Enhanced experience)
```

## shadcn/ui Component Responsive Behavior

### Button Component Breakpoints
**Mobile (default):**
- Height: 44px (touch-friendly)
- Padding: `px-6 py-3`
- Text: `text-base` (16px)
- Full width for primary actions

**Tablet (md:):**
- Height: 40px
- Padding: `px-4 py-2`
- Auto width with max-width constraints
- Side-by-side button layouts

**Desktop (lg:):**
- Height: 36px
- Compact padding: `px-3 py-2`
- Inline button groups
- Hover states activated

### Form Component Responsive Patterns
**Mobile Layout:**
```jsx
<form className="space-y-4">
  <div className="space-y-2">
    <Label>Document Title</Label>
    <Input className="w-full h-12 text-base" /> {/* 48px height */}
  </div>
  <div className="space-y-2">
    <Label>Description</Label>
    <Textarea className="w-full min-h-[120px] text-base" />
  </div>
  <Button className="w-full h-12">Upload Document</Button>
</form>
```

**Tablet Layout (md:):**
```jsx
<form className="space-y-4">
  <div className="grid md:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label>Document Title</Label>
      <Input className="w-full h-10 text-sm" /> {/* 40px height */}
    </div>
    <div className="space-y-2">
      <Label>Category</Label>
      <Select>
        <SelectTrigger className="w-full h-10">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
      </Select>
    </div>
  </div>
  <Button className="md:w-auto px-8 h-10">Upload Document</Button>
</form>
```

**Desktop Layout (lg:):**
```jsx
<form className="space-y-6">
  <div className="grid lg:grid-cols-3 gap-4">
    <div className="space-y-2">
      <Label className="text-sm">Document Title</Label>
      <Input className="h-9 text-sm" /> {/* 36px height */}
    </div>
    <div className="space-y-2">
      <Label className="text-sm">Category</Label>
      <Select>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
      </Select>
    </div>
    <div className="space-y-2">
      <Label className="text-sm">Priority</Label>
      <Select>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
      </Select>
    </div>
  </div>
</form>
```

## Navigation Component Breakpoints

### Mobile Navigation Pattern
```jsx
<div className="lg:hidden">
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon">
        <Menu className="h-6 w-6" />
      </Button>
    </SheetTrigger>
    <SheetContent side="left" className="w-80">
      <nav className="flex flex-col space-y-4 mt-8">
        <Link className="text-lg font-medium">Dashboard</Link>
        <Link className="text-lg font-medium">Documents</Link>
        <Link className="text-lg font-medium">Templates</Link>
        <Link className="text-lg font-medium">Recipients</Link>
      </nav>
    </SheetContent>
  </Sheet>
</div>
```

### Desktop Navigation Pattern
```jsx
<nav className="hidden lg:flex items-center space-x-8">
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Documents</NavigationMenuTrigger>
        <NavigationMenuContent>
          <div className="grid gap-3 p-4 md:w-[400px] lg:w-[500px]">
            <NavigationMenuLink>All Documents</NavigationMenuLink>
            <NavigationMenuLink>Templates</NavigationMenuLink>
            <NavigationMenuLink>Upload</NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</nav>
```

## Table Component Responsive Design

### Mobile Table (Card View)
```jsx
<div className="lg:hidden space-y-4">
  {documents.map((doc) => (
    <Card key={doc.id} className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center">
            =Ä
          </div>
          <div>
            <h4 className="font-medium text-sm">{doc.title}</h4>
            <p className="text-xs text-neutral-500">{doc.description}</p>
          </div>
        </div>
        <Badge variant={doc.status === 'completed' ? 'default' : 'secondary'}>
          {doc.status}
        </Badge>
      </div>
      
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Created {doc.createdAt}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Download</DropdownMenuItem>
            <DropdownMenuItem>Share</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  ))}
</div>
```

### Desktop Table View
```jsx
<div className="hidden lg:block">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Document</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Signers</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {documents.map((doc) => (
        <TableRow key={doc.id}>
          <TableCell>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center">
                =Ä
              </div>
              <div>
                <div className="font-medium">{doc.title}</div>
                <div className="text-sm text-neutral-500">{doc.description}</div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge>{doc.status}</Badge>
          </TableCell>
          <TableCell>{doc.signers}</TableCell>
          <TableCell>{doc.createdAt}</TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Download</DropdownMenuItem>
                <DropdownMenuItem>Share</DropdownMenuItem>
                <DropdownMenuItem>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

## Dialog/Modal Responsive Behavior

### Mobile Modal (Full Screen)
```jsx
<Dialog>
  <DialogContent className="sm:max-w-full sm:h-full sm:max-h-full sm:rounded-none lg:max-w-2xl lg:h-auto lg:rounded-lg">
    <DialogHeader className="sm:p-6 lg:p-4">
      <DialogTitle className="text-lg sm:text-xl">Document Settings</DialogTitle>
    </DialogHeader>
    
    <div className="sm:p-6 lg:p-4 sm:flex-1 sm:overflow-y-auto">
      {/* Content adapts to full screen on mobile */}
    </div>
    
    <DialogFooter className="sm:p-6 lg:p-4 sm:flex-col lg:flex-row sm:space-y-2 lg:space-y-0">
      <Button variant="outline" className="sm:w-full lg:w-auto">Cancel</Button>
      <Button className="sm:w-full lg:w-auto">Save Changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Container and Layout Breakpoints

### Page Container Pattern
```jsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
  {/* Content with responsive padding */}
</div>
```

### Grid Layout Responsive Pattern
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
  {/* Cards that stack on mobile, 2-col on tablet, 3-col on desktop, 4-col on wide screens */}
</div>
```

### Dashboard Layout Pattern
```jsx
<div className="min-h-screen bg-neutral-50">
  {/* Mobile: Stack everything vertically */}
  <div className="lg:flex">
    {/* Sidebar - hidden on mobile, drawer on tablet, persistent on desktop */}
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:bg-white lg:border-r lg:border-neutral-200">
      {/* Sidebar content */}
    </aside>
    
    {/* Main content */}
    <main className="lg:pl-64">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Main content with responsive padding */}
      </div>
    </main>
  </div>
</div>
```

## React Native (NativeWind) Adaptations

### Responsive Hooks for Native
```jsx
import { useDeviceOrientation, useDimensions } from '@react-native-community/hooks';

const ResponsiveComponent = () => {
  const { screen } = useDimensions();
  const { portrait } = useDeviceOrientation();
  
  const isTablet = screen.width >= 768;
  const isLargeScreen = screen.width >= 1024;
  
  return (
    <View className={cn(
      'p-4',
      isTablet && 'p-6',
      isLargeScreen && 'p-8'
    )}>
      {/* Content adapts based on screen size */}
    </View>
  );
};
```

### Native Button Responsive Pattern
```jsx
const NativeButton = ({ children, className, ...props }) => {
  const { screen } = useDimensions();
  const isTablet = screen.width >= 768;
  
  return (
    <Pressable 
      className={cn(
        'bg-neutral-900 rounded-md items-center justify-center',
        isTablet ? 'h-10 px-4' : 'h-12 px-6', // Smaller on tablet
        className
      )}
      {...props}
    >
      <Text className={cn(
        'text-white font-medium',
        isTablet ? 'text-sm' : 'text-base'
      )}>
        {children}
      </Text>
    </Pressable>
  );
};
```

## Touch Target Guidelines

### Minimum Touch Targets
```
Mobile:   44px × 44px (Apple HIG)
Tablet:   40px × 40px  
Desktop:  36px × 36px (mouse precision)
```

### Implementation in Components
```jsx
// Mobile-first button sizing
<Button className="h-11 px-6 md:h-10 md:px-4 lg:h-9 lg:px-3">
  Click me
</Button>

// Touch-friendly input fields
<Input className="h-12 md:h-10 lg:h-9 text-base" />

// Adequate checkbox touch targets
<div className="flex items-center space-x-3 py-2">
  <Checkbox className="w-5 h-5" />
  <Label>Option</Label>
</div>
```

## Content Density by Screen Size

### Information Hierarchy
**Mobile:** 
- Focus on single primary action
- Minimal information per screen
- Generous spacing (16px+)
- Large typography (16px+)

**Tablet:**
- 2-column layouts possible
- Medium information density
- Moderate spacing (12px-16px)
- Mixed typography scales

**Desktop:**
- 3+ column layouts
- High information density
- Compact spacing (8px-12px)
- Smaller typography acceptable (14px+)

### Responsive Typography Scale
```jsx
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Main Heading
</h1>

<p className="text-base sm:text-lg lg:text-base leading-relaxed">
  Body text that scales appropriately
</p>

<span className="text-sm sm:text-base lg:text-sm text-neutral-500">
  Supporting text
</span>
```

This responsive system ensures our shadcn/ui components work beautifully across all device sizes while maintaining our neutral design aesthetic and following mobile-first principles.