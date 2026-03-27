---
name: tanstack-devtools
description: Centralized, extensible devtools panel for TanStack libraries with a plugin architecture.
---

<<<<<<< HEAD
=======

>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
## Overview

TanStack Devtools provides a unified debugging interface that consolidates devtools for TanStack Query, Router, and other libraries into a single panel. It features a framework-agnostic plugin architecture, real-time state inspection, and support for custom plugins. Built with Solid.js for lightweight performance.

**React:** `@tanstack/react-devtools`
**Core:** `@tanstack/devtools`
**Status:** Alpha

## Installation

```bash
npm install @tanstack/react-devtools
```

## Basic Setup

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
=======
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TanStackDevtools />
      {/* Your app content */}
      <MyApp />
    </QueryClientProvider>
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## Built-in Plugins

### Query Devtools

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
=======
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TanStackDevtools
        plugins={[
          {
<<<<<<< HEAD
            id: "react-query",
            name: "React Query",
=======
            id: 'react-query',
            name: 'React Query',
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
            render: () => <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
      <MyApp />
    </QueryClientProvider>
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

### Router Devtools

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
=======
import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function App() {
  return (
    <TanStackDevtools
      plugins={[
        {
<<<<<<< HEAD
          id: "router",
          name: "Router",
=======
          id: 'router',
          name: 'Router',
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
          render: () => <TanStackRouterDevtoolsPanel router={router} />,
        },
      ]}
    />
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

### Combined Setup

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
=======
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TanStackDevtools
        plugins={[
          {
<<<<<<< HEAD
            id: "react-query",
            name: "React Query",
            render: () => <ReactQueryDevtoolsPanel />,
          },
          {
            id: "router",
            name: "Router",
=======
            id: 'react-query',
            name: 'React Query',
            render: () => <ReactQueryDevtoolsPanel />,
          },
          {
            id: 'router',
            name: 'Router',
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
            render: () => <TanStackRouterDevtoolsPanel router={router} />,
          },
        ]}
      />
      <MyApp />
    </QueryClientProvider>
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

### AI Devtools

For debugging TanStack AI workflows:

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";
import { AIDevtoolsPanel } from "@tanstack/ai-react/devtools";
=======
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AIDevtoolsPanel } from '@tanstack/ai-react/devtools'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function App() {
  return (
    <TanStackDevtools
      plugins={[
        {
<<<<<<< HEAD
          id: "ai",
          name: "AI",
=======
          id: 'ai',
          name: 'AI',
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
          render: () => <AIDevtoolsPanel />,
        },
      ]}
    />
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

AI Devtools features:
<<<<<<< HEAD

=======
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
- **Message Inspector** - View full conversation history with metadata
- **Token Usage** - Track input/output tokens and costs per request
- **Streaming Visualization** - Real-time view of streaming chunks
- **Tool Call Debugging** - Inspect tool calls, parameters, and results
- **Thinking/Reasoning Viewer** - Debug reasoning tokens from thinking models
- **Adapter Switching** - Test different providers in development

## Plugin System

### Plugin Interface

```typescript
interface DevtoolsPlugin {
<<<<<<< HEAD
  id: string; // Unique identifier
  name: string; // Display name in the devtools panel
  render: () => JSX.Element; // React component to render
=======
  id: string          // Unique identifier
  name: string        // Display name in the devtools panel
  render: () => JSX.Element  // React component to render
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

### Custom Plugins

```tsx
<<<<<<< HEAD
import { TanStackDevtools } from "@tanstack/react-devtools";

// Custom state inspector plugin
const stateInspectorPlugin = {
  id: "state-inspector",
  name: "State",
  render: () => (
    <div style={{ padding: "16px" }}>
=======
import { TanStackDevtools } from '@tanstack/react-devtools'

// Custom state inspector plugin
const stateInspectorPlugin = {
  id: 'state-inspector',
  name: 'State',
  render: () => (
    <div style={{ padding: '16px' }}>
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
      <h3>Application State</h3>
      <pre>{JSON.stringify(appState, null, 2)}</pre>
    </div>
  ),
<<<<<<< HEAD
};

// Custom network logger plugin
const networkLoggerPlugin = {
  id: "network-logger",
  name: "Network",
  render: () => <NetworkLoggerPanel />,
};

function App() {
  return <TanStackDevtools plugins={[stateInspectorPlugin, networkLoggerPlugin]} />;
=======
}

// Custom network logger plugin
const networkLoggerPlugin = {
  id: 'network-logger',
  name: 'Network',
  render: () => <NetworkLoggerPanel />,
}

function App() {
  return (
    <TanStackDevtools
      plugins={[
        stateInspectorPlugin,
        networkLoggerPlugin,
      ]}
    />
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

### Dynamic Plugin Registration

```tsx
function App() {
<<<<<<< HEAD
  const [plugins, setPlugins] = useState<DevtoolsPlugin[]>([]);

  useEffect(() => {
    // Register plugins conditionally
    const activePlugins: DevtoolsPlugin[] = [];

    if (process.env.NODE_ENV === "development") {
      activePlugins.push({
        id: "debug",
        name: "Debug",
        render: () => <DebugPanel />,
      });
    }

    setPlugins(activePlugins);
  }, []);

  return <TanStackDevtools plugins={plugins} />;
=======
  const [plugins, setPlugins] = useState<DevtoolsPlugin[]>([])

  useEffect(() => {
    // Register plugins conditionally
    const activePlugins: DevtoolsPlugin[] = []

    if (process.env.NODE_ENV === 'development') {
      activePlugins.push({
        id: 'debug',
        name: 'Debug',
        render: () => <DebugPanel />,
      })
    }

    setPlugins(activePlugins)
  }, [])

  return <TanStackDevtools plugins={plugins} />
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## Vite Plugin Integration

```typescript
// vite.config.ts
<<<<<<< HEAD
import { defineConfig } from "vite";
import { tanstackDevtools } from "@tanstack/devtools/vite";

export default defineConfig({
  plugins: [tanstackDevtools()],
});
=======
import { defineConfig } from 'vite'
import { tanstackDevtools } from '@tanstack/devtools/vite'

export default defineConfig({
  plugins: [
    tanstackDevtools(),
  ],
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Production Considerations

```tsx
// Only include devtools in development
function App() {
  return (
    <>
<<<<<<< HEAD
      {process.env.NODE_ENV === "development" && <TanStackDevtools plugins={plugins} />}
      <MyApp />
    </>
  );
=======
      {process.env.NODE_ENV === 'development' && (
        <TanStackDevtools plugins={plugins} />
      )}
      <MyApp />
    </>
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}

// Or use lazy loading
const TanStackDevtools = lazy(() =>
<<<<<<< HEAD
  import("@tanstack/react-devtools").then((m) => ({ default: m.TanStackDevtools })),
);
=======
  import('@tanstack/react-devtools').then((m) => ({ default: m.TanStackDevtools }))
)
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Framework Support

<<<<<<< HEAD
| Framework | Package                      | Status  |
| --------- | ---------------------------- | ------- |
| React     | `@tanstack/react-devtools`   | Alpha   |
| Solid     | `@tanstack/solid-devtools`   | Planned |
| Vue       | `@tanstack/vue-devtools`     | Planned |
| Angular   | `@tanstack/angular-devtools` | Planned |
=======
| Framework | Package | Status |
|-----------|---------|--------|
| React | `@tanstack/react-devtools` | Alpha |
| Solid | `@tanstack/solid-devtools` | Planned |
| Vue | `@tanstack/vue-devtools` | Planned |
| Angular | `@tanstack/angular-devtools` | Planned |
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

## Features

- **Unified Panel** - Single interface for all TanStack debugging
- **Real-time Updates** - Live monitoring of state changes
- **Plugin Architecture** - Extensible with custom and third-party plugins
- **Built-in Plugins** - Query, Router, and AI devtools panels
- **Lightweight** - Built with Solid.js for minimal overhead
- **Type-safe** - Full TypeScript support for plugin definitions
- **Framework-agnostic Core** - Plugin logic works across frameworks

## Best Practices

1. **Conditionally include in production** - use environment checks or code splitting
2. **Use specific plugins** rather than loading all available ones
3. **Give plugins unique IDs** to prevent conflicts
4. **Keep plugin render functions lightweight** - avoid expensive computations
5. **Use the Vite plugin** for automatic setup in Vite-based projects
6. **Combine Query + Router + AI plugins** for full-stack TanStack debugging
7. **Create domain-specific plugins** for app-level state inspection
8. **Use AI devtools** when debugging streaming, tool calls, or token usage

## Common Pitfalls

- Including devtools in production builds without tree-shaking
- Using duplicate plugin IDs (causes rendering conflicts)
- Heavy render functions in plugins (slows down the devtools panel)
- Forgetting to wrap with QueryClientProvider when using Query plugin
- Not passing the router instance to Router devtools panel
