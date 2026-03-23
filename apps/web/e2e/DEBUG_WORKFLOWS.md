# Debugging Workflows with Chrome DevTools MCP

This guide explains how to use the Chrome DevTools MCP server to debug failed tests and analyze performance issues.

## Prerequisites

1. Chrome DevTools MCP server must be configured in `.claude/mcp.json`
2. Chrome browser must be installed
3. Application must be running locally

## Common Debugging Workflows

### 1. Investigating Failed Tests

When a test fails, use Chrome DevTools MCP to:

**Step 1: Navigate to the failing page**

```typescript
// Use Chrome DevTools MCP to navigate
(await mcp__chrome) -
  devtools__navigate_page({
    type: "url",
    url: "http://localhost:5173/test-org/documents",
  });
```

**Step 2: Take a snapshot of the page**

```typescript
// Get accessibility snapshot to understand page state
(await mcp__chrome) - devtools__take_snapshot({});
```

**Step 3: Check console errors**

```typescript
// List console messages to find JavaScript errors
(await mcp__chrome) -
  devtools__list_console_messages({
    types: ["error"],
    pageSize: 50,
  });
```

**Step 4: Inspect network requests**

```typescript
// Check for failed API calls
(await mcp__chrome) -
  devtools__list_network_requests({
    resourceTypes: ["fetch", "xhr"],
    pageSize: 50,
  });
```

**Step 5: Evaluate JavaScript state**

```typescript
// Check application state
(await mcp__chrome) -
  devtools__evaluate_script({
    function: `() => {
    return {
      isAuthenticated: !!window.__CLERK_LOADED__,
      convexState: window.convex?.connectionState,
      reactVersion: React.version
    };
  }`,
  });
```

### 2. Performance Analysis

**Start performance trace:**

```typescript
(await mcp__chrome) -
  devtools__performance_start_trace({
    reload: true,
    autoStop: true,
  });
```

**Analyze Core Web Vitals:**

```typescript
// Get LCP (Largest Contentful Paint) insights
(await mcp__chrome) -
  devtools__performance_analyze_insight({
    insightSetId: "insight-set-id-from-trace",
    insightName: "LCPBreakdown",
  });
```

**Check slow network requests:**

```typescript
(await mcp__chrome) -
  devtools__list_network_requests({
    resourceTypes: ["document", "script", "stylesheet", "image"],
    pageSize: 100,
  });
```

### 3. Debugging Clerk Authentication Issues

**Check Clerk session state:**

```typescript
(await mcp__chrome) -
  devtools__evaluate_script({
    function: `() => {
    return {
      clerkLoaded: window.Clerk !== undefined,
      session: window.Clerk?.session,
      user: window.Clerk?.user?.emailAddresses
    };
  }`,
  });
```

**Monitor authentication network calls:**

```typescript
(await mcp__chrome) -
  devtools__list_network_requests({
    resourceTypes: ["fetch"],
    pageSize: 50,
  });

// Filter for clerk.* domains in the results
```

### 4. Debugging Convex Real-Time Updates

**Check WebSocket connections:**

```typescript
(await mcp__chrome) -
  devtools__list_network_requests({
    resourceTypes: ["websocket"],
    pageSize: 20,
  });
```

**Inspect Convex client state:**

```typescript
(await mcp__chrome) -
  devtools__evaluate_script({
    function: `() => {
    return {
      connectionState: window.convex?.connectionState,
      queryResults: window.convex?._queryResults?.size,
      activeQueries: Array.from(window.convex?._queries?.keys() || [])
    };
  }`,
  });
```

### 5. Debugging PDF Rendering Issues

**Check canvas rendering:**

```typescript
(await mcp__chrome) -
  devtools__evaluate_script({
    function: `() => {
    const canvas = document.querySelector('canvas');
    return {
      canvasExists: !!canvas,
      width: canvas?.width,
      height: canvas?.height,
      context: canvas?.getContext('2d') !== null
    };
  }`,
  });
```

**Take screenshot of specific element:**

```typescript
(await mcp__chrome) -
  devtools__take_screenshot({
    element: "Document canvas",
    ref: "canvas-element-ref-from-snapshot",
  });
```

### 6. Form Interaction Debugging

**Fill form and monitor submission:**

```typescript
// Take snapshot to identify form fields
(await mcp__chrome) - devtools__take_snapshot({});

// Fill form fields
(await mcp__chrome) -
  devtools__fill_form({
    elements: [{ uid: "uid-from-snapshot", value: "test value" }],
  });

// Check console for validation errors
(await mcp__chrome) -
  devtools__list_console_messages({
    types: ["error", "warn"],
  });
```

### 7. Responsive Design Testing

**Resize viewport:**

```typescript
(await mcp__chrome) -
  devtools__resize_page({
    width: 375, // iPhone size
    height: 667,
  });

(await mcp__chrome) - devtools__take_screenshot({});
```

## Integration with Playwright Tests

### Adding Debug Points in Tests

```typescript
import { test, expect } from "@playwright/test";

test("debug example", async ({ page }) => {
  // Your test code
  await page.goto("/documents");

  // If test fails here, use Chrome DevTools MCP to:
  // 1. Navigate to the same URL
  // 2. Take snapshot
  // 3. Check console
  // 4. Inspect network

  // Add debug breakpoint
  await page.pause(); // Opens Playwright Inspector
});
```

### Screenshot Comparison Workflow

1. Take baseline screenshot:

```typescript
(await mcp__chrome) -
  devtools__take_screenshot({
    filePath: "e2e/screenshots/baseline.png",
  });
```

2. Make changes and compare:

```typescript
(await mcp__chrome) -
  devtools__take_screenshot({
    filePath: "e2e/screenshots/current.png",
  });

// Use image comparison tool to diff
```

## Autonomous Testing Loop

When Claude Code runs tests autonomously, it will:

1. **Execute tests** using Playwright
2. **Detect failures** from test output
3. **Launch Chrome DevTools MCP** to debug
4. **Navigate to failing page**
5. **Collect diagnostic data**:
   - Console errors
   - Network failures
   - Performance metrics
   - DOM state
6. **Analyze root cause**
7. **Propose fixes** based on findings
8. **Apply fixes** to code
9. **Re-run tests** to verify

## Tips

- Always start with `take_snapshot()` to understand page structure
- Use `list_console_messages()` for JavaScript errors
- Check `list_network_requests()` for API failures
- Use `performance_start_trace()` for performance issues
- Take screenshots for visual regression debugging
- Use `evaluate_script()` to inspect runtime state

## Example Complete Debug Session

```typescript
// 1. Navigate to failing page
(await mcp__chrome) -
  devtools__navigate_page({
    type: "url",
    url: "http://localhost:5173/test-org/documents/doc123",
  });

// 2. Get page snapshot
const snapshot = (await mcp__chrome) - devtools__take_snapshot({});

// 3. Check console
const console =
  (await mcp__chrome) -
  devtools__list_console_messages({
    types: ["error"],
  });

// 4. Check network
const network =
  (await mcp__chrome) -
  devtools__list_network_requests({
    resourceTypes: ["fetch", "xhr"],
  });

// 5. Take screenshot
(await mcp__chrome) -
  devtools__take_screenshot({
    filePath: "debug-failure.png",
  });

// 6. Inspect state
const state =
  (await mcp__chrome) -
  devtools__evaluate_script({
    function: `() => ({
    auth: !!window.Clerk?.session,
    convex: window.convex?.connectionState
  })`,
  });

// 7. Analyze and fix based on findings
```

## Environment Setup

Create `.env.test` for test-specific configuration:

```bash
# Test user credentials
TEST_USER_EMAIL=test@seal-test.com
TEST_EMAIL_CODE=424242
# Optional when the Clerk test account is configured for password auth.
TEST_USER_PASSWORD=TestPassword123!

# Convex
VITE_CONVEX_URL=https://test-deployment.convex.cloud

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Playwright
PLAYWRIGHT_BASE_URL=http://localhost:5173
```
