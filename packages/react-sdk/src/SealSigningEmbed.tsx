import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import type { SealEvent, SealSigningEmbedProps, SealSigningEmbedRef } from "./types";

const DEFAULT_BASE_URL = "https://app.seal.nyc";
const SEAL_ORIGIN_PATTERN = /^https?:\/\/(app\.seal\.nyc|localhost:\d+)$/;

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
export const SealSigningEmbed = forwardRef<SealSigningEmbedRef, SealSigningEmbedProps>(
  function SealSigningEmbed(
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
    ref,
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const resolvedBaseUrl = baseUrl ?? DEFAULT_BASE_URL;

    const iframeSrc = useMemo(() => {
      const url = new URL(`/sign/${token}`, resolvedBaseUrl);
      url.searchParams.set("embed", "true");
      if (theme) url.searchParams.set("theme", theme);
      if (hideDecline) url.searchParams.set("hideDecline", "true");
      return url.toString();
    }, [token, resolvedBaseUrl, theme, hideDecline]);

    const handleMessage = useCallback(
      (event: MessageEvent) => {
        // Validate origin — allow configured base URL and localhost for development
        const origin = event.origin;
        const expectedOrigin = new URL(resolvedBaseUrl).origin;
        if (origin !== expectedOrigin && !SEAL_ORIGIN_PATTERN.test(origin)) {
          return;
        }

        const data = event.data as SealEvent | undefined;
        if (!data?.type?.startsWith("seal:")) return;

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
      [resolvedBaseUrl, onReady, onViewed, onSigned, onDeclined, onError],
    );

    useEffect(() => {
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [handleMessage]);

    useImperativeHandle(ref, () => ({
      getIframe: () => iframeRef.current,
      close: () => {
        iframeRef.current?.contentWindow?.postMessage({ type: "seal:close" }, resolvedBaseUrl);
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
  },
);
