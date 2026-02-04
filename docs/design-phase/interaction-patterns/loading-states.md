# Loading States & Skeleton Screens

## Overview

Consistent loading patterns that maintain layout stability and provide clear feedback during asynchronous operations.

---

## 🎨 Core Loading Principles

### Progressive Loading Strategy

1. **Instant** (0-300ms): No loading indicator
2. **Brief** (300ms-1s): Subtle skeleton or spinner
3. **Extended** (1s-3s): Full skeleton with animation
4. **Long** (3s+): Progress indicator with messaging

### Visual Consistency

- Maintain layout structure during loading
- Prevent content shifting (CLS = 0)
- Match skeleton to actual content shape
- Smooth transitions from loading to loaded

---

## 🦴 Skeleton Screen Patterns

### Document List Skeleton

```
While Loading:
╔══════════════════════════════════════════════╗
║░░░░░░░░░░░░░░░░░░░░░░░░░     ░░░░░░░░░░░░░░║ ← Title skeleton
║░░░░░░░░░░░░░░░     ░░░░░░░░░    ░░░░░░░░░░║ ← Metadata skeleton
╠══════════════════════════════════════════════╣
║░░░░░░░░░░░░░░░░░░░░░░░░░     ░░░░░░░░░░░░░░║
║░░░░░░░░░░░░░░░     ░░░░░░░░░    ░░░░░░░░░░║
╠══════════════════════════════════════════════╣
║░░░░░░░░░░░░░░░░░░░░░░░░░     ░░░░░░░░░░░░░░║
║░░░░░░░░░░░░░░░     ░░░░░░░░░    ░░░░░░░░░░║
╚══════════════════════════════════════════════╝

Animation: Shimmer effect moving left to right
```

### Card Skeleton

```
╔══════════════════════════════════════════════╗
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║ ← Header
║                                              ║
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║ ← Content line 1
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                ║ ← Content line 2
║                                              ║
║░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░            ║ ← Action buttons
╚══════════════════════════════════════════════╝
```

### Form Skeleton

```
░░░░░░░░░░  ← Label skeleton
╔══════════════════════════════════════════════╗
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║ ← Input skeleton
╚══════════════════════════════════════════════╝

░░░░░░░░░░
╔══════════════════════════════════════════════╗
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║
╚══════════════════════════════════════════════╝

[░░░░░░░░░░░░░░░]  ← Button skeleton
```

---

## ⏳ Spinner Patterns

### Inline Spinners

```
Small (16px):  ⏳
Medium (24px): ⚙️
Large (32px):  🔄

Usage contexts:
- Button loading: [  ⏳ Saving...  ]
- Field validation: [            ] ⏳
- Inline refresh: Refresh ⏳
```

### Full Page Spinner

```



                   ⚙️

              Loading...



```

### Component-Level Loading

```
╔══════════════════════════════════════════════╗
║                    ⏳                         ║
║              Loading content...              ║
║                                              ║
║   This will be replaced with actual data    ║
╚══════════════════════════════════════════════╝
```

---

## 📊 Progress Indicators

### Linear Progress Bar

```
Upload Progress: 68%
▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 68%

Processing...
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 90%
```

### Step Progress

```
Step 2 of 4: Processing
◉ ── ◉ ── ○ ── ○
```

### Circular Progress (Text representation)

```
⭕ 25% Complete
⭕ 50% Complete
⭕ 75% Complete
✅ 100% Complete
```

---

## 📄 Document-Specific Loading States

### Document Upload Loading

```
┌────────────────────────────────────────────┐
│               📄 → 📁                       │
│                                            │
│         Uploading document...              │
│                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 75%                │
│                                            │
│         contract.pdf (2.4 MB)             │
└────────────────────────────────────────────┘
```

### Document Processing States

```
Processing Document:
┌────────────────────────────────────────────┐
│  ⚙️ Analyzing document structure...         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%                │
│                                            │
│  ⏳ Extracting signature fields...         │
│  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ 55%                 │
│                                            │
│  ⏹️ Preparing for signature...             │
│  ░░░░░░░░░░░░░░░░░░░░░ 0%                  │
└────────────────────────────────────────────┘
```

### Signature Field Placement Loading

```
╔══════════════════════════════════════════════╗
║                 PDF Content                  ║
║                                              ║
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║ ← Loading line
║                                              ║
║    [⏳ Detecting signature locations...]     ║
║                                              ║
║░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║ ← Loading line
║                                              ║
╚══════════════════════════════════════════════╝
```

---

## 📱 Mobile Loading Adaptations

### Mobile-Friendly Spinners

```
Large Touch Target Loading:
┌──────────────────────────────┐
│                              │
│           ⚙️                │
│       Loading...             │
│                              │
│    (Minimum 44px height)     │
└──────────────────────────────┘
```

### Mobile Progress Bars

```
Full-width progress on mobile:
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 85%
Uploading... (2 of 3 files)
```

---

## 🔄 Real-time Loading States

### Live Data Updates

```
┌────────────────────────────────────┐
│ 📊 Dashboard Analytics             │
├────────────────────────────────────┤
│ Last updated: 2 minutes ago   ⚙️   │
│                                    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Documents: 1,234 │
│ ░░░░░░░░░░░░░░░░░░ Loading...      │
│                                    │
└────────────────────────────────────┘
```

### Background Sync Loading

```
Sync Status: ⚙️ Syncing changes...
┌────────────────────────────────────┐
│ ✅ Document 1: Synced              │
│ ✅ Document 2: Synced              │
│ ⏳ Document 3: Syncing...          │
│ ⏹️ Document 4: Pending             │
└────────────────────────────────────┘
```

---

## ⚡ Performance Optimizations

### Skeleton Matching Strategy

- **Exact dimensions**: Skeleton matches loaded content size
- **Consistent spacing**: Maintain identical padding/margins
- **Visual hierarchy**: Preserve content structure in skeleton
- **Animation timing**: Smooth 1.5s shimmer cycle

### Loading State Priorities

1. **Critical data first**: Load essential content immediately
2. **Progressive enhancement**: Add non-essential content after
3. **Perceived performance**: Show skeleton before actual load time
4. **Error fallbacks**: Graceful handling when loading fails

---

## 📈 Loading Performance Metrics

### Target Performance

- **Skeleton render**: <100ms from state change
- **Shimmer animation**: Smooth 60fps throughout
- **State transitions**: <200ms between loading states
- **Content replacement**: <50ms skeleton to content swap

### Error Recovery

```
Loading Failed State:
┌────────────────────────────────────┐
│               ❌                   │
│        Loading failed              │
│                                    │
│    Network connection error        │
│                                    │
│         [Retry] [Cancel]           │
└────────────────────────────────────┘
```

---

## 🎯 Best Practices Summary

### Do's

- Show loading states for operations >300ms
- Match skeleton structure to actual content
- Provide clear progress indicators for long operations
- Use shimmer animation for better perceived performance
- Maintain layout stability during loading

### Don'ts

- Don't show spinners for <300ms operations
- Don't use generic skeletons that don't match content
- Don't leave users guessing about progress
- Don't block entire UI for partial loading
- Don't stack multiple loading indicators
