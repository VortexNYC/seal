# Embedded Signing (iFrame SDK) — Design Document

> **Status:** IMPLEMENTED — iFrame SDK and React component merged to staging (`dc5751b`).

## Goal

Allow SaaS companies and developers to embed Seal's signing experience directly within their own applications via iFrame, so recipients never leave the host app. This is table-stakes for platforms like DocuSign (embedded signing is their most-used integration pattern) and critical for Seal's developer-first positioning.

## Current State

- Signing page at `/sign/{token}` is a standalone full-page experience
- `X-Frame-Options: DENY` in `vercel.json` blocks all iframe loading
- No `postMessage` or cross-origin communication — page does `window.location.reload()` after signing
- Authentication is already token-only (no Clerk required) — iframe-friendly by default
- No SDK or JavaScript library for embedding
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` globally blocks camera (irrelevant for signing but noted)

## Design

### Two Integration Modes

| Mode           | How It Works                                                  | Use Case                                  |
| -------------- | ------------------------------------------------------------- | ----------------------------------------- |
| **iFrame URL** | Embed `/sign/{token}?embed=true` in an `<iframe>`             | Any platform (PHP, Rails, vanilla JS)     |
| **React SDK**  | `<SealSigningEmbed token={token} onSigned={...} />` component | React/Next.js apps (our primary audience) |

Both modes use the same underlying mechanism: iFrame + postMessage.

### URL Parameters for Embedded Mode

When `/sign/{token}` receives `?embed=true`:

1. **Header hidden** — no Seal branding header (just document name inline)
2. **No navigation chrome** — no back links, no external links
3. **Events via postMessage** — instead of `window.location.reload()`, emit events to parent
4. **Compact layout** — sidebar content moves to bottom sheet on all screen sizes
5. **Optional params**:
   - `&theme=light|dark` — force theme (ignore system preference)
   - `&locale=en|es|fr|...` — force locale (future i18n support)
   - `&hideDecline=true` — hide the decline button (host app handles cancellation)

### postMessage Event Protocol

All events sent via `window.parent.postMessage()` with origin validation.

**Events emitted (Seal → Host):**

```typescript
// Document loaded and ready
{ type: "seal:ready", token: string }

// Recipient viewed the document (ESIGN consent given)
{ type: "seal:viewed", token: string }

// Recipient completed signing
{ type: "seal:signed", token: string, recipientId: string }

// Recipient declined to sign
{ type: "seal:declined", token: string, reason?: string }

// An error occurred
{ type: "seal:error", token: string, code: string, message: string }

// Field value changed (opt-in via &fieldEvents=true)
{ type: "seal:field:changed", token: string, fieldId: string, value: string }
```

**Events received (Host → Seal):**

```typescript
// Navigate to specific field
{ type: "seal:navigate", fieldId: string }

// Close/cleanup the signing session
{ type: "seal:close" }
```

**Origin validation:** The signing page validates `event.origin` against an allowed-origins list configured when the document is sent (stored on the document or recipient record). If no origin is configured, postMessage is sent with `"*"` (less secure but simpler for getting started).

### Security: Frame Embedding Controls

#### Header Changes (`vercel.json`)

Replace the blanket `X-Frame-Options: DENY` with route-specific `Content-Security-Policy: frame-ancestors`:

- **All routes except `/sign/*`**: Keep `X-Frame-Options: DENY` (dashboard must never be embedded)
- **`/sign/*` routes**: Remove `X-Frame-Options`, add `Content-Security-Policy: frame-ancestors 'self' *` (allow embedding from any origin — the token itself is the security boundary)

**Why allow all origins by default:** The signing token is already the access credential. Restricting frame-ancestors to specific domains would require senders to pre-configure embedding domains, which adds friction for no security gain (the token is unguessable and expires).

**Optional per-document restriction:** If a sender wants to restrict embedding to specific domains (e.g., `app.acme.com`), they can configure `allowedEmbedOrigins` on the document. The backend would then set `frame-ancestors` to that specific list instead of `*`.

#### CORS for Convex

The Convex WebSocket connection and API calls from the embedded iFrame should work without CORS changes since they connect directly to `*.convex.cloud`, not to the host domain. The iFrame loads Seal's origin, so same-origin policy applies normally within the frame.

The `/api/v1/ip` endpoint already has `Access-Control-Allow-Origin: *` — no change needed.

### Schema Changes

#### Modify: `documents`

```typescript
// Add to document schema
embeddingConfig: v.optional(
  v.object({
    enabled: v.boolean(), // Allow this document to be embedded
    allowedOrigins: v.optional(v.array(v.string())), // Restrict to specific domains (empty = allow all)
    hideDeclineButton: v.optional(v.boolean()), // Hide decline in embedded mode
    redirectUrl: v.optional(v.string()), // URL to redirect after signing (non-embedded fallback)
  })
);
```

### React SDK (`@vortex-api/seal/react`)

A lightweight npm package wrapping the iFrame:

```typescript
import { SealSigningEmbed } from "@vortex-api/seal/react";

function MyApp() {
  return (
    <SealSigningEmbed
      token="abc123..."
      onReady={() => console.log("Document loaded")}
      onSigned={(e) => {
        console.log("Signed!", e.recipientId);
        router.push("/thank-you");
      }}
      onDeclined={(e) => console.log("Declined:", e.reason)}
      onError={(e) => console.error(e.code, e.message)}
      theme="light"
      style={{ width: "100%", height: "700px", border: "none" }}
    />
  );
}
```

**Package internals:**

- Creates an `<iframe>` pointing to `https://app.seal.nyc/sign/{token}?embed=true`
- Attaches `message` event listener, filters by `seal:*` event types
- Validates `event.origin` matches Seal's domain
- Calls user-provided callbacks
- Provides `ref` for imperative control (`ref.current.navigateToField(id)`)

### Signing Page Changes (`sign.$token.tsx`)

Detect embedded mode from URL search params:

```
const isEmbedded = new URLSearchParams(window.location.search).has("embed");
```

**When `isEmbedded` is true:**

1. Hide the full header → show minimal inline document name
2. Replace sidebar with bottom sheet (or collapsible panel)
3. After sign/decline: emit postMessage event instead of `window.location.reload()`
4. On mount: emit `seal:ready`
5. On ESIGN consent: emit `seal:viewed`
6. Listen for incoming `seal:navigate` and `seal:close` messages

**Layout changes are CSS-only** — no new components needed. Add `data-embedded` attribute to the root container and use it for conditional styles.

### API Integration

Existing REST API endpoints already support the embedded workflow:

1. **Create document** via `POST /api/v1/documents` → get document ID
2. **Add recipients** via `POST /api/v1/documents/{id}/recipients` → get signing tokens
3. **Send document** via `POST /api/v1/documents/{id}/send`
4. **Embed** the signing token in an iFrame URL
5. **Listen** for `seal:signed` postMessage event
6. **Verify** completion via `GET /api/v1/documents/{id}` (check `workflowStatus`)

No new API endpoints needed — the REST API + iFrame events cover the full flow.

### Webhook Integration

Existing document webhooks (`document.completed`, `recipient.signed`, etc.) fire regardless of whether signing happened via direct link or embedded iFrame. No changes needed — webhooks are the server-side confirmation path.

### What We Skip (v1)

- **JavaScript SDK (non-React)** — vanilla JS wrapper can come in v2; the iFrame URL works for any platform
- **Signing URL API** — some competitors provide a "create signing URL" endpoint that returns a short-lived URL; our existing token system already serves this purpose
- **Custom CSS injection** — host apps can't inject CSS into the iframe (same-origin policy); use the `theme` param and branding settings (from Custom Branding feature) instead
- **Mobile SDK (React Native / Swift / Kotlin)** — use WebView with the embed URL for now
- **Collaborative/real-time embedded signing** — one recipient at a time per embed instance

### Permissions

No new permissions — embedding is controlled by document-level `embeddingConfig`, which is set by whoever has `documents:edit` permission.

### Plan Gating

| Feature                       | Free | Pro |
| ----------------------------- | ---- | --- |
| Embedded signing (iFrame URL) | Yes  | Yes |
| React SDK                     | Yes  | Yes |
| Custom allowed origins        | No   | Yes |
| Hide decline button           | No   | Yes |

Embedded signing itself is free — it drives adoption. Advanced configuration options are Pro.

### Key Files to Modify/Create

| File                                          | Action                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/web/vercel.json`                        | Modify — route-specific headers for `/sign/*`                                   |
| `apps/web/src/routes/sign.$token.tsx`         | Modify — detect `?embed=true`, conditional layout, postMessage events           |
| `apps/backend/convex/schemas/documents.ts`    | Modify — add `embeddingConfig`                                                  |
| `packages/sdk/src/react/`                     | Create — `@vortex-api/seal/react` npm package with `SealSigningEmbed` component |
| `packages/sdk/src/react/SealSigningEmbed.tsx` | Create — iFrame wrapper component                                               |
| `packages/sdk/src/react/types.ts`             | Create — event type definitions                                                 |
| `packages/sdk/package.json`                   | Create — package config                                                         |
| `docs/embedded-signing.md`                    | Create — developer documentation                                                |
