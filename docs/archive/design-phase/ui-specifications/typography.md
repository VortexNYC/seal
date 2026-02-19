# Typography System - Inter Font + shadcn Neutral

**Professional typography system using Inter font family with shadcn neutral color palette for excellent readability and modern aesthetic.**

## Font Family Strategy

### Primary Font: Inter
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

**Why Inter:**
- Designed specifically for UI interfaces
- Excellent readability at all sizes
- Perfect letter spacing and character shapes
- Open source and widely supported
- Optimized for digital screens

### Font Loading Strategy
```html
<!-- Google Fonts CDN -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Font Weights Used:**
- **400 (Regular)** - Body text, descriptions
- **500 (Medium)** - Labels, captions, emphasized text
- **600 (SemiBold)** - Headings, section titles
- **700 (Bold)** - Major headings, hero text

## Typography Scale

### Heading Hierarchy
**Display Text (Hero Sections):**
```css
.text-display-2xl {
  font-size: 3.75rem;    /* 60px */
  line-height: 1.1;      /* 66px */
  font-weight: 700;      /* Bold */
  color: #171717;        /* neutral-900 */
  letter-spacing: -0.025em; /* Tight */
}

.text-display-xl {
  font-size: 3rem;       /* 48px */
  line-height: 1.1;      /* 53px */
  font-weight: 700;      /* Bold */
  color: #171717;        /* neutral-900 */
  letter-spacing: -0.025em;
}
```

**Main Headings:**
```css
.text-heading-xl {
  font-size: 2.25rem;    /* 36px */
  line-height: 1.2;      /* 43px */
  font-weight: 600;      /* SemiBold */
  color: #171717;        /* neutral-900 */
}

.text-heading-lg {
  font-size: 1.875rem;   /* 30px */
  line-height: 1.3;      /* 39px */
  font-weight: 600;      /* SemiBold */
  color: #171717;        /* neutral-900 */
}

.text-heading-md {
  font-size: 1.5rem;     /* 24px */
  line-height: 1.3;      /* 31px */
  font-weight: 600;      /* SemiBold */
  color: #171717;        /* neutral-900 */
}

.text-heading-sm {
  font-size: 1.25rem;    /* 20px */
  line-height: 1.4;      /* 28px */
  font-weight: 600;      /* SemiBold */
  color: #171717;        /* neutral-900 */
}

.text-heading-xs {
  font-size: 1.125rem;   /* 18px */
  line-height: 1.4;      /* 25px */
  font-weight: 600;      /* SemiBold */
  color: #171717;        /* neutral-900 */
}
```

### Body Text Styles
```css
.text-body-lg {
  font-size: 1.125rem;   /* 18px */
  line-height: 1.7;      /* 31px */
  font-weight: 400;      /* Regular */
  color: #525252;        /* neutral-600 */
}

.text-body-md {
  font-size: 1rem;       /* 16px */
  line-height: 1.6;      /* 26px */
  font-weight: 400;      /* Regular */
  color: #525252;        /* neutral-600 */
}

.text-body-sm {
  font-size: 0.875rem;   /* 14px */
  line-height: 1.5;      /* 21px */
  font-weight: 400;      /* Regular */
  color: #525252;        /* neutral-600 */
}

.text-body-xs {
  font-size: 0.75rem;    /* 12px */
  line-height: 1.4;      /* 17px */
  font-weight: 400;      /* Regular */
  color: #525252;        /* neutral-600 */
}
```

### Label and UI Text
```css
.text-label-lg {
  font-size: 0.875rem;   /* 14px */
  line-height: 1.4;      /* 20px */
  font-weight: 500;      /* Medium */
  color: #404040;        /* neutral-700 */
}

.text-label-md {
  font-size: 0.75rem;    /* 12px */
  line-height: 1.3;      /* 16px */
  font-weight: 500;      /* Medium */
  color: #404040;        /* neutral-700 */
}

.text-label-sm {
  font-size: 0.6875rem;  /* 11px */
  line-height: 1.3;      /* 14px */
  font-weight: 500;      /* Medium */
  color: #404040;        /* neutral-700 */
}
```

## Color Applications with Neutral Palette

### Text Color Hierarchy
```css
/* Primary text - Maximum contrast for headlines */
.text-primary {
  color: #171717;        /* neutral-900 */
}

/* Secondary text - Body content, readable */
.text-secondary {
  color: #525252;        /* neutral-600 */
}

/* Tertiary text - Supporting information */
.text-tertiary {
  color: #737373;        /* neutral-500 */
}

/* Muted text - Placeholders, captions */
.text-muted {
  color: #a3a3a3;        /* neutral-400 */
}

/* Subtle text - Timestamps, metadata */
.text-subtle {
  color: #d4d4d4;        /* neutral-300 */
}
```

### Contextual Text Colors
```css
/* Success text */
.text-success {
  color: #16a34a;        /* Green-600 */
}

/* Warning text */
.text-warning {
  color: #ca8a04;        /* Yellow-600 */
}

/* Error text */
.text-error {
  color: #dc2626;        /* Red-600 */
}

/* Info text */
.text-info {
  color: #2563eb;        /* Blue-600 */
}
```

## shadcn/ui Typography Component Usage

### Heading Component Implementation
```jsx
import { cn } from "@/lib/utils";

const Heading = ({ 
  level = 1, 
  size, 
  children, 
  className, 
  ...props 
}) => {
  const Tag = `h${level}`;
  
  const sizeClasses = {
    'display-2xl': 'text-6xl font-bold leading-none tracking-tight text-neutral-900',
    'display-xl': 'text-5xl font-bold leading-none tracking-tight text-neutral-900',
    'heading-xl': 'text-4xl font-semibold leading-tight text-neutral-900',
    'heading-lg': 'text-3xl font-semibold leading-tight text-neutral-900',
    'heading-md': 'text-2xl font-semibold leading-snug text-neutral-900',
    'heading-sm': 'text-xl font-semibold leading-snug text-neutral-900',
    'heading-xs': 'text-lg font-semibold leading-snug text-neutral-900',
  };
  
  const defaultSizes = {
    1: 'heading-xl',
    2: 'heading-lg',
    3: 'heading-md',
    4: 'heading-sm',
    5: 'heading-xs',
    6: 'heading-xs',
  };
  
  const appliedSize = size || defaultSizes[level];
  
  return (
    <Tag 
      className={cn(sizeClasses[appliedSize], className)} 
      {...props}
    >
      {children}
    </Tag>
  );
};
```

### Text Component Implementation
```jsx
const Text = ({ 
  size = 'md', 
  variant = 'secondary',
  children, 
  className, 
  as: Component = 'p',
  ...props 
}) => {
  const sizeClasses = {
    lg: 'text-lg leading-relaxed',
    md: 'text-base leading-normal', 
    sm: 'text-sm leading-normal',
    xs: 'text-xs leading-normal',
  };
  
  const variantClasses = {
    primary: 'text-neutral-900',
    secondary: 'text-neutral-600',
    tertiary: 'text-neutral-500',
    muted: 'text-neutral-400',
    subtle: 'text-neutral-300',
  };
  
  return (
    <Component 
      className={cn(
        sizeClasses[size], 
        variantClasses[variant],
        className
      )} 
      {...props}
    >
      {children}
    </Component>
  );
};
```

### Label Component Implementation
```jsx
const Label = ({ 
  size = 'md',
  required = false,
  children, 
  className,
  ...props 
}) => {
  const sizeClasses = {
    lg: 'text-sm font-medium leading-none',
    md: 'text-xs font-medium leading-none',
    sm: 'text-xs font-medium leading-none',
  };
  
  return (
    <label 
      className={cn(
        sizeClasses[size],
        'text-neutral-700',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )} 
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
};
```

## Responsive Typography

### Mobile Typography Adjustments
```css
/* Mobile-first approach */
@media (max-width: 639px) {
  .text-display-2xl { font-size: 2.5rem; }    /* 40px on mobile */
  .text-display-xl { font-size: 2rem; }       /* 32px on mobile */
  .text-heading-xl { font-size: 1.875rem; }   /* 30px on mobile */
  .text-heading-lg { font-size: 1.5rem; }     /* 24px on mobile */
  
  /* Ensure 16px minimum for body text (prevents iOS zoom) */
  .text-body-sm { font-size: 1rem; }          /* 16px minimum */
  .text-body-xs { font-size: 0.875rem; }      /* 14px minimum */
}
```

### Tablet Typography Optimizations
```css
@media (min-width: 768px) {
  .text-display-2xl { font-size: 3.5rem; }    /* 56px on tablet */
  .text-display-xl { font-size: 2.75rem; }    /* 44px on tablet */
  
  /* Comfortable reading line heights */
  .text-body-lg { line-height: 1.8; }
  .text-body-md { line-height: 1.7; }
}
```

### Desktop Typography Refinements
```css
@media (min-width: 1024px) {
  /* Full scale on desktop */
  .text-display-2xl { font-size: 3.75rem; }   /* 60px */
  .text-display-xl { font-size: 3rem; }       /* 48px */
  
  /* Tighter line heights for compact layouts */
  .text-body-lg { line-height: 1.6; }
  .text-body-md { line-height: 1.5; }
}
```

## Form Typography Patterns

### Input Field Typography
```jsx
const Input = ({ placeholder, ...props }) => {
  return (
    <input 
      className={cn(
        'text-base text-neutral-900',           // Primary text
        'placeholder:text-neutral-400',         // Muted placeholder
        'focus:placeholder:text-neutral-300',   // Subtle on focus
        // other styling...
      )}
      placeholder={placeholder}
      {...props}
    />
  );
};
```

### Button Typography
```jsx
const Button = ({ variant, size, children, ...props }) => {
  const textClasses = {
    primary: 'text-white font-medium',
    secondary: 'text-neutral-900 font-medium', 
    ghost: 'text-neutral-600 font-medium',
    link: 'text-neutral-900 font-normal underline',
  };
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-sm', 
    lg: 'text-base',
  };
  
  return (
    <button 
      className={cn(
        textClasses[variant],
        sizeClasses[size],
        // other styling...
      )}
      {...props}
    >
      {children}
    </button>
  );
};
```

## Document-Specific Typography

### Document Title Hierarchy
```jsx
// Main document title
<Heading level={1} size="heading-xl" className="mb-2">
  Contract Agreement
</Heading>

// Document description
<Text size="lg" variant="tertiary" className="mb-6">
  Master Service Agreement between Acme Corp and Client Co.
</Text>

// Document metadata
<Text size="sm" variant="muted">
  Created March 15, 2024 " 3 pages " Contract
</Text>
```

### Status and Badge Typography
```jsx
// Status badges
<Badge className="text-xs font-medium">
  Pending Signature
</Badge>

// Counts and statistics
<Text size="sm" variant="muted" className="font-medium">
  3 of 5 signatures collected
</Text>
```

### Email Typography (React Email)
```jsx
// Email headings use consistent Inter stack
<Heading className="text-2xl font-semibold text-neutral-900 mb-4">
  Please review and sign
</Heading>

<Text className="text-base text-neutral-600 leading-relaxed mb-6">
  John Smith has requested your signature on Contract Agreement.
</Text>

// Buttons maintain typography hierarchy
<Button className="text-base font-medium text-white">
  Review Document
</Button>
```

## Accessibility Considerations

### Color Contrast Compliance
- **neutral-900 on white**: 21:1 ratio (AAA)
- **neutral-600 on white**: 7:1 ratio (AAA) 
- **neutral-500 on white**: 4.6:1 ratio (AA)
- **neutral-400 on white**: 3:1 ratio (AA Large Text)

### Typography Accessibility
- Minimum 16px font size for body text on mobile
- 1.5 minimum line height for readability
- Adequate contrast ratios for all text
- Clear visual hierarchy with font weights and sizes
- No color-only information conveying

### Screen Reader Considerations
- Semantic heading hierarchy (h1 ’ h2 ’ h3)
- Proper heading levels for screen reader navigation
- Descriptive text for interactive elements
- Alternative text for decorative typography elements

This typography system creates a cohesive, professional reading experience across all platforms while maintaining the clean aesthetic of our shadcn neutral design system.