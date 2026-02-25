# Enhanced Loading States - shadcn/ui Skeleton Components

**Comprehensive loading patterns using shadcn/ui Skeleton component with neutral color palette for professional, consistent loading experiences.**

## shadcn/ui Skeleton Integration

### Core Skeleton Component

```jsx
// Base shadcn Skeleton with neutral colors
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200", // Using neutral-200
        className,
      )}
      {...props}
    />
  );
}
```

**Design Tokens:**

- Background: `neutral-200` (#e5e5e5)
- Animation: Built-in `animate-pulse`
- Border radius: `rounded-md` (6px)

## Document-Specific Skeleton Patterns

### Document List Skeleton

```jsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const DocumentListSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-neutral-200 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-4">
              {/* Document icon placeholder */}
              <Skeleton className="h-10 w-10 rounded bg-neutral-200" />

              {/* Document info */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[250px] bg-neutral-200" />
                <Skeleton className="h-3 w-[150px] bg-neutral-200" />
              </div>

              {/* Status badge */}
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm">
              <Skeleton className="h-3 w-24 bg-neutral-200" />
              <Skeleton className="h-3 w-16 bg-neutral-200" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

### Document Preparation Skeleton

```jsx
const DocumentPrepSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Document preview area */}
      <Card className="border-neutral-200 bg-white">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-neutral-200" />
        </CardHeader>
        <CardContent>
          <div className="flex aspect-[8.5/11] items-center justify-center rounded-lg bg-neutral-100">
            <Skeleton className="h-16 w-16 rounded bg-neutral-200" />
          </div>
        </CardContent>
      </Card>

      {/* Field palette */}
      <Card className="border-neutral-200 bg-white">
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-neutral-200" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-3 rounded-lg border border-neutral-200 p-3"
            >
              <Skeleton className="h-5 w-5 bg-neutral-200" />
              <Skeleton className="h-4 w-24 bg-neutral-200" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
```

### Analytics Dashboard Skeleton

```jsx
const AnalyticsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-neutral-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20 bg-neutral-200" />
              <Skeleton className="h-4 w-4 bg-neutral-200" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16 bg-neutral-200" />
              <Skeleton className="h-3 w-24 bg-neutral-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Area */}
      <Card className="border-neutral-200 bg-white">
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-neutral-200" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded bg-neutral-200" />
        </CardContent>
      </Card>
    </div>
  );
};
```

## Form Loading Patterns

### Form Field Skeletons

```jsx
const FormSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Form fields */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20 bg-neutral-200" /> {/* Label */}
          <Skeleton className="h-10 w-full bg-neutral-200" /> {/* Input */}
        </div>
      ))}

      {/* Text area */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 bg-neutral-200" />
        <Skeleton className="h-24 w-full bg-neutral-200" />
      </div>

      {/* Buttons */}
      <div className="flex space-x-2">
        <Skeleton className="h-10 w-20 bg-neutral-200" />
        <Skeleton className="h-10 w-20 bg-neutral-200" />
      </div>
    </div>
  );
};
```

### Upload Progress Enhanced

```jsx
import { Progress } from "@/components/ui/progress";

const UploadProgressSkeleton = ({ progress = 45, fileName = "document.pdf" }) => {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-100">📄</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900">{fileName}</p>
            <p className="text-xs text-neutral-500">{progress}% • 2.3 MB of 5.1 MB • 5 sec left</p>
          </div>
        </div>

        <Progress value={progress} className="h-2 bg-neutral-200" />
      </CardContent>
    </Card>
  );
};
```

## Table Loading Patterns

### Table Skeleton

```jsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TableSkeleton = ({ columns = 5, rows = 8 }) => {
  return (
    <div className="rounded-md border border-neutral-200">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20 bg-neutral-200" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columns }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-16 bg-neutral-200" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

## Loading Button States

### Button Loading with shadcn

```jsx
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

// Primary button loading
<Button disabled className="bg-neutral-900">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Saving...
</Button>

// Secondary button loading
<Button variant="outline" disabled className="border-neutral-300">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Processing...
</Button>

// Ghost button loading
<Button variant="ghost" disabled className="text-neutral-600">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

## Page-Level Loading States

### Dashboard Loading

```jsx
const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-neutral-200" />
        <Skeleton className="h-4 w-80 bg-neutral-200" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-neutral-200 bg-white">
            <CardContent className="p-6">
              <Skeleton className="mb-2 h-4 w-20 bg-neutral-200" />
              <Skeleton className="mb-1 h-8 w-12 bg-neutral-200" />
              <Skeleton className="h-3 w-16 bg-neutral-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content area */}
      <Card className="border-neutral-200 bg-white">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-neutral-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 py-3">
                <Skeleton className="h-8 w-8 rounded bg-neutral-200" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 bg-neutral-200" />
                  <Skeleton className="h-3 w-32 bg-neutral-200" />
                </div>
                <Skeleton className="h-6 w-16 bg-neutral-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

## Error and Empty State Components

### Enhanced Error State

```jsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const ErrorState = ({ title = "Something went wrong", message, onRetry }) => {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Card className="w-full max-w-md border-neutral-200 bg-white">
        <CardContent className="p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />

          <h3 className="mb-2 text-lg font-semibold text-neutral-900">{title}</h3>

          <p className="mb-4 text-neutral-600">
            {message || "Please try again or contact support if the problem persists."}
          </p>

          <div className="flex justify-center space-x-2">
            <Button onClick={onRetry} variant="outline">
              Try Again
            </Button>
            <Button variant="ghost">Get Help</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Enhanced Empty State

```jsx
import { FileX } from "lucide-react";

const EmptyState = ({
  icon: Icon = FileX,
  title = "No documents yet",
  description = "Upload your first document to get started",
  actionLabel = "Upload Document",
  onAction,
}) => {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <Icon className="mx-auto mb-4 h-12 w-12 text-neutral-400" />

        <h3 className="mb-2 text-lg font-semibold text-neutral-900">{title}</h3>

        <p className="mb-4 max-w-sm text-neutral-600">{description}</p>

        {onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </div>
  );
};
```

## Mobile-Optimized Skeletons

### Mobile Document List

```jsx
const MobileDocumentSkeleton = () => {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="border-neutral-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full bg-neutral-200" />
                <Skeleton className="h-3 w-3/4 bg-neutral-200" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full bg-neutral-200" />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <Skeleton className="h-3 w-20 bg-neutral-200" />
              <Skeleton className="h-6 w-6 rounded bg-neutral-200" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

## Performance Optimizations

### Skeleton Component Variants

```jsx
// Optimized skeleton with reduced motion support
const OptimizedSkeleton = ({ className, animate = true, ...props }) => {
  return (
    <div
      className={cn(
        "rounded-md bg-neutral-200",
        animate && "animate-pulse", // Respects prefers-reduced-motion
        className,
      )}
      {...props}
    />
  );
};

// CSS for reduced motion
// @media (prefers-reduced-motion: reduce) {
//   .animate-pulse {
//     animation: none;
//   }
// }
```

### Intersection Observer Loading

```jsx
// Lazy load skeleton components
const LazySkeletonSection = ({ children, fallback }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.1,
    });

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{isVisible ? children : fallback}</div>;
};
```

This enhanced loading system leverages shadcn/ui components with our neutral color palette to create professional, consistent loading experiences across all application features.
