/**
 * Minimal React example: embed the recipient signing UI.
 *
 * Install: `pnpm add @vortex-api/seal react react-dom`
 *
 * Obtain `token` from the send response (`recipients[].signing_url` path
 * segment, or `signing_token`). Agents prepare the envelope; humans sign here.
 */

import { SealSigningEmbed } from "@vortex-api/seal/react";

export function SigningPage({ token }: { token: string }) {
  return (
    <SealSigningEmbed
      token={token}
      baseUrl="https://app.seal.nyc"
      style={{ width: "100%", height: "80vh", border: "none" }}
      onReady={() => console.log("signing ready")}
      onViewed={() => console.log("document viewed")}
      onSigned={(event) => console.log("signed", event.recipientId)}
      onDeclined={(event) => console.log("declined", event.reason)}
      onError={(event) => console.error(event.code, event.message)}
    />
  );
}
