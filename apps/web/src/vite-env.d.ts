/// <reference types="vite/client" />
// @validation-token 1776698074293

import type { api } from "@seal/backend/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";

// Extend Window interface for E2E testing support
declare global {
  interface Window {
    __convexClient?: ConvexReactClient;
    __convexApi?: typeof api;
  }
}
