/**
 * Jam.dev integration utilities
 *
 * Uses @jam.dev/sdk for metadata registration and window.Jam for recording.
 * Scripts (capture.js + recorder.js) are loaded via index.html.
 */

import { jam } from "@jam.dev/sdk";

interface JamMetadataPayload {
  userId?: string;
  email?: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  route?: string;
}

let currentMetadata: JamMetadataPayload = {};

/**
 * Register a metadata callback with Jam. Called once at app init.
 * The callback is invoked at capture time so data is always fresh.
 */
export function registerJamMetadata(getter: () => JamMetadataPayload): void {
  jam.metadata(() => {
    currentMetadata = getter();
    return {
      ...currentMetadata,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
  });
}

/**
 * Trigger Jam screen recording programmatically.
 */
export function startJamRecording(): void {
  window.Jam?.startRecording?.();
}

/**
 * Clear stored metadata (call on sign-out).
 */
export function clearJamMetadata(): void {
  currentMetadata = {};
}
