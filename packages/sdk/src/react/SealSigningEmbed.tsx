import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import type {
  SealEvent,
  SealSigningEmbedProps,
  SealSigningEmbedRef,
} from "./types";

const DEFAULT_BASE_URL = "https://app.seal.nyc";
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/app\.seal\.nyc$/;

function resolveAllowedBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) return DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return DEFAULT_BASE_URL;
  }
  if (!ALLOWED_ORIGIN_PATTERN.test(url.origin)) {
    return DEFAULT_BASE_URL;
  }
  return url.origin;
}

const SEAL_EVENT_TYPES: ReadonlySet<string> = new Set<SealEvent["type"]>([
  "seal:ready",
  "seal:viewed",
  "seal:signed",
  "seal:declined",
  "seal:error",
]);

function isSealEvent(data: unknown): data is SealEvent {
  return (
    data !== null &&
    typeof data === "object" &&
    "type" in data &&
    typeof data.type === "string" &&
    SEAL_EVENT_TYPES.has(data.type)
  );
}

/**
 * Embed Seal's signing experience in your React app.
 *
 * @example
 * ```tsx
 * <SealSigningEmbed
 *   token="abc123..."
 *   onSigned={(e) => router.push("/thank-you")}
 *   onError={(e) => console.error(e.code, e.message)}
 *   style={{ width: "100%", height: "700px", border: "none" }}
 * />
 * ```
 */
export const SealSigningEmbed = forwardRef<
  SealSigningEmbedRef,
  SealSigningEmbedProps
>(function SealSigningEmbed(
  {
    token,
    baseUrl,
    theme,
    hideDecline,
    onReady,
    onViewed,
    onSigned,
    onDeclined,
    onError,
    className,
    style,
  },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const resolvedBaseUrl = resolveAllowedBaseUrl(baseUrl);

  const iframeSrc = useMemo(() => {
    const url = new URL(`/sign/${token}`, resolvedBaseUrl);
    url.searchParams.set("embed", "true");
    if (theme) url.searchParams.set("theme", theme);
    if (hideDecline) url.searchParams.set("hideDecline", "true");
    return url.toString();
  }, [token, resolvedBaseUrl, theme, hideDecline]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate origin — only accept messages from the configured Seal app origin
      if (event.origin !== resolvedBaseUrl) {
        return;
      }

      const data: unknown = event.data;
      if (!isSealEvent(data)) return;

      switch (data.type) {
        case "seal:ready":
          onReady?.(data);
          break;
        case "seal:viewed":
          onViewed?.(data);
          break;
        case "seal:signed":
          onSigned?.(data);
          break;
        case "seal:declined":
          onDeclined?.(data);
          break;
        case "seal:error":
          onError?.(data);
          break;
      }
    },
    [resolvedBaseUrl, onReady, onViewed, onSigned, onDeclined, onError]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
    close: () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "seal:close" },
        resolvedBaseUrl
      );
    },
  }));

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className={className}
      style={{
        border: "none",
        width: "100%",
        height: "700px",
        ...style,
      }}
      allow="clipboard-write"
      title="Seal Document Signing"
    />
  );
});
