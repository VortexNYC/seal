import type { CSSProperties } from "react";

/** Events emitted by the Seal signing embed (Seal → Host) */
export interface SealReadyEvent {
  type: "seal:ready";
  token: string;
}

export interface SealViewedEvent {
  type: "seal:viewed";
  token: string;
}

export interface SealSignedEvent {
  type: "seal:signed";
  token: string;
  recipientId: string;
}

export interface SealDeclinedEvent {
  type: "seal:declined";
  token: string;
  reason?: string;
}

export interface SealErrorEvent {
  type: "seal:error";
  token: string;
  code: string;
  message: string;
}

export type SealEvent =
  | SealReadyEvent
  | SealViewedEvent
  | SealSignedEvent
  | SealDeclinedEvent
  | SealErrorEvent;

/** Props for the SealSigningEmbed component */
export interface SealSigningEmbedProps {
  /** The signing token for the recipient */
  token: string;
  /** Base URL of the Seal app (defaults to https://app.seal.nyc) */
  baseUrl?: string;
  /** Force a specific theme */
  theme?: "light" | "dark";
  /** Hide the decline button in the signing UI */
  hideDecline?: boolean;
  /** Called when the signing page is loaded and ready */
  onReady?: (event: SealReadyEvent) => void;
  /** Called when the recipient views the document (ESIGN consent given) */
  onViewed?: (event: SealViewedEvent) => void;
  /** Called when the recipient completes signing */
  onSigned?: (event: SealSignedEvent) => void;
  /** Called when the recipient declines to sign */
  onDeclined?: (event: SealDeclinedEvent) => void;
  /** Called when an error occurs */
  onError?: (event: SealErrorEvent) => void;
  /** CSS class name for the iframe container */
  className?: string;
  /** Inline styles for the iframe */
  style?: CSSProperties;
}

/** Imperative handle for the SealSigningEmbed ref */
export interface SealSigningEmbedRef {
  /** Get the underlying iframe element */
  getIframe: () => HTMLIFrameElement | null;
  /** Send a close event to the signing page */
  close: () => void;
}
