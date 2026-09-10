/// <reference types="vite/client" />
// @validation-token 1776698074293

import type { api } from "@seal/backend/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import type * as React from "react";

// Extend Window interface for E2E testing support
declare global {
  interface Window {
    __convexClient?: ConvexReactClient;
    __convexApi?: typeof api;
    Jam?: { startRecording?: () => void };
  }
}

// Allow CSS custom properties in style objects without type assertions
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BETTER_AUTH_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_CONVEX_URL?: string;
}
