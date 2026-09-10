/// <reference types="vite/client" />
// @validation-token 1776698074293

import type * as React from "react";

declare global {
  interface Window {
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
