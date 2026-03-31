/// <reference types="vite/client" />

import type { ConvexReactClient } from "convex/react";
import type { api } from "@seal/backend/convex/_generated/api";

// Extend Window interface for E2E testing support
declare global {
  interface Window {
    __convexClient?: ConvexReactClient;
    __convexApi?: typeof api;
  }
}
