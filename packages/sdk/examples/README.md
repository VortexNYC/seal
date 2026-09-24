# SDK examples

Runnable snippets for `@vortex-api/seal`. OpenAPI remains the contract; these
only wrap documented paths.

## Node — send a document

```bash
pnpm --filter @vortex-api/seal run build
SEAL_API_KEY=seal_… node packages/sdk/examples/node-send.mjs
```

Creates a PDF, uploads it, adds a recipient, and prints `signing_url`.

## React — signing embed

See `react-embed.tsx`. Pass the token from the send response into
`SealSigningEmbed`. Agents do not sign; the embed is the human half.
