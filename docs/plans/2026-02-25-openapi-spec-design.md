# OpenAPI Specification & SDK — Design Document

> **Status:** NOT STARTED

## Goal

Generate an OpenAPI 3.1 specification from Seal's existing REST API and Zod validation schemas. Serve the spec publicly, host interactive API documentation via Swagger UI, and publish a TypeScript SDK generated from the spec. This makes Seal's API discoverable, self-documenting, and easy to integrate with from any language.

## Current State

Seal has a REST API at `/api/v1/` with endpoints for documents, recipients, templates, signatures, and webhooks. Each endpoint uses Zod schemas for request/response validation (defined in `apps/backend/convex/validations/`). Authentication uses Clerk API keys with scoped permissions. The API works, but there is no machine-readable spec, no interactive docs page, and no published SDK. Developers must read code or internal docs to understand the API.

## Design

### Architecture Overview

```
Zod schemas (source of truth)
    |
    v
Build script (zod-to-openapi)
    |
    v
openapi.json (generated artifact)
    |
    +---> Swagger UI (frontend route /api/docs)
    +---> TypeScript SDK (npm package @seal/sdk)
    +---> Convex HTTP endpoint (GET /api/v1/openapi.json)
```

### User Flow

**For API consumers:**

1. Visit `https://app.seal.co/api/docs` — interactive Swagger UI with all endpoints, schemas, and "Try It Out" functionality
2. Download the spec at `/api/v1/openapi.json` for code generation in any language
3. Install `@seal/sdk` from npm for TypeScript/JavaScript projects

**For Seal developers:**

1. Define or update Zod schemas in `validations/` as usual
2. Annotate schemas with OpenAPI metadata (descriptions, examples) using `zod-openapi` extensions
3. Run `bun run generate:openapi` to regenerate the spec
4. Spec is committed to the repo and served at runtime

### Backend Implementation

#### Schema Annotation

Extend existing Zod schemas with OpenAPI metadata using `@asteasolutions/zod-to-openapi`:

```typescript
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Example: existing schema with OpenAPI extensions
export const createDocumentSchema = z
  .object({
    title: z.string().openapi({ description: "Document title", example: "Employment Agreement" }),
    templateId: z.string().optional().openapi({ description: "Template ID to create from" }),
    recipients: z.array(recipientSchema).openapi({ description: "List of recipients" }),
  })
  .openapi("CreateDocumentRequest");
```

#### API Route Registry

Create a registry that maps each API endpoint to its OpenAPI metadata:

```typescript
// api/openapi/registry.ts
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

const registry = new OpenAPIRegistry();

// Register each endpoint
registry.registerPath({
  method: "post",
  path: "/api/v1/documents",
  summary: "Create a document",
  description: "Creates a new document, optionally from a template.",
  tags: ["Documents"],
  security: [{ apiKey: [] }],
  request: {
    body: { content: { "application/json": { schema: createDocumentSchema } } },
  },
  responses: {
    200: {
      description: "Document created",
      content: { "application/json": { schema: documentResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Insufficient permissions" },
  },
});
```

#### Spec Generation Script

A build-time script that reads the registry and outputs `openapi.json`:

```typescript
// scripts/generate-openapi.ts
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../apps/backend/convex/api/openapi/registry";

const generator = new OpenApiGeneratorV31(registry.definitions);

const spec = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Seal API",
    version: "1.0.0",
    description: "Document signing and workflow management API",
    contact: { name: "Seal Support", url: "https://seal.co/support" },
  },
  servers: [{ url: "https://api.seal.co", description: "Production" }],
  security: [{ apiKey: [] }],
});

// Write to file
Bun.write("apps/backend/convex/api/openapi.json", JSON.stringify(spec, null, 2));
```

Run with: `bun run scripts/generate-openapi.ts`

Add to `package.json`:

```json
"generate:openapi": "bun run scripts/generate-openapi.ts"
```

#### Serve the Spec

A Convex HTTP endpoint that returns the generated spec:

```typescript
// In http.ts or api/index.ts
http.route({
  path: "/api/v1/openapi.json",
  method: "GET",
  handler: httpAction(async () => {
    // Return the spec from a stored constant or imported JSON
    return new Response(JSON.stringify(openapiSpec), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Public spec
      },
    });
  }),
});
```

The spec JSON should be stored in **Convex Storage** and served via a storage URL. Embedding large JSON as a constant in the Convex deployment bundle is problematic — it inflates the deployment size and may hit bundle limits. Store the spec file in Convex Storage during CI/deploy, and serve it via a redirect to the storage URL.

> **Zod v4 compatibility note**: This project uses Zod v4. Verify that `@asteasolutions/zod-to-openapi` supports Zod v4's API before adopting. If not, check for forks or alternatives like `zod-openapi` which may have v4 support.

#### API Endpoint Coverage

All existing v1 endpoints need OpenAPI annotations:

| Tag            | Endpoints                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Documents**  | POST /documents, GET /documents, GET /documents/{id}, POST /documents/{id}/send, DELETE /documents/{id}          |
| **Recipients** | POST /documents/{id}/recipients, GET /documents/{id}/recipients, PATCH /recipients/{id}, DELETE /recipients/{id} |
| **Templates**  | GET /templates, GET /templates/{id}                                                                              |
| **Signatures** | GET /documents/{id}/signatures                                                                                   |
| **Webhooks**   | POST /webhooks, GET /webhooks, DELETE /webhooks/{id}                                                             |

Each endpoint needs: summary, description, request schema (body + path params + query params), response schemas (success + each error type), and example values.

### Frontend

#### Swagger UI Route: `/api/docs`

A public (unauthenticated) frontend route that renders Swagger UI:

```typescript
// apps/web/src/routes/api.docs.tsx
// NOTE: swagger-ui-react is ~1.5MB gzipped. Consider lighter alternatives:
//   - Scalar (https://scalar.com) — modern, fast, ~200KB
//   - Redocly (@redocly/redoc) — popular, ~300KB
//   - Stoplight Elements — headless, composable
// For v1, Scalar is recommended for its smaller bundle and modern UX.
import { ApiReference } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export const Route = createFileRoute("/api/docs")({
  component: ApiDocsPage,
});

function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <ApiReference
        configuration={{
          spec: { url: "/api/v1/openapi.json" },
          theme: "default",
        }}
      />
    </div>
  );
}
```

Customizations:

- Seal branding in the header (logo, colors)
- "Try It Out" enabled by default
- API key input field in the auth section
- Grouped by tags (Documents, Recipients, Templates, etc.)

### SDK Generation

#### TypeScript SDK: `@seal/sdk`

Generate a typed SDK from the OpenAPI spec using `openapi-typescript-codegen` (or `openapi-fetch` for a lighter approach):

```bash
bun run openapi-typescript-codegen --input apps/backend/convex/api/openapi.json --output packages/sdk/src --client fetch
```

The SDK lives in `packages/sdk/` within the monorepo:

```
packages/sdk/
  src/
    index.ts           // Main entry point
    client.ts          // API client class
    types.ts           // Generated types
    services/
      DocumentsService.ts
      RecipientsService.ts
      TemplatesService.ts
      WebhooksService.ts
  package.json         // @seal/sdk
  tsconfig.json
```

Usage:

```typescript
import { SealClient } from "@seal/sdk";

const seal = new SealClient({ apiKey: "seal_..." });

const doc = await seal.documents.create({
  title: "NDA",
  recipients: [{ name: "Jane", email: "jane@example.com", role: "signer" }],
});

await seal.documents.send(doc.id);
```

#### SDK Publishing

- Published to npm as `@seal/sdk`
- Version tracks the API version (1.x.x for v1)
- CI pipeline: on API schema changes, regenerate SDK, bump version, publish
- Include README with installation, authentication, and usage examples

### Versioning Strategy

- OpenAPI spec version follows the API version: `1.0.0` for `/api/v1/`
- When `/api/v2/` is introduced, a separate `openapi-v2.json` is generated
- Both specs are served simultaneously at their respective paths
- SDK major version tracks API version (SDK 1.x = API v1, SDK 2.x = API v2)

### Permissions

- `GET /api/v1/openapi.json` — public, no authentication required
- `/api/docs` page — public, no authentication required
- "Try It Out" in Swagger UI requires the user to enter their API key
- API key access itself is Pro-gated (existing behavior)

### Plan Gating

| Feature                | Free        | Pro |
| ---------------------- | ----------- | --- |
| View API docs          | Yes         | Yes |
| Download OpenAPI spec  | Yes         | Yes |
| Use API (requires key) | No          | Yes |
| SDK usage              | No (no key) | Yes |

The docs and spec are public to encourage adoption. Actual API usage requires a Pro plan API key.

### What We Skip (v1)

- No multi-language SDK generation (TypeScript only) — other languages can use the OpenAPI spec with their own codegen tools
- No API changelog or diff tooling (e.g., optic, oasdiff)
- No webhook event schemas in the OpenAPI spec (only REST endpoints)
- No API versioning middleware (v2 is a separate set of routes, not a version header)
- No rate limit headers documented in the spec (can be added later)
- No Postman collection export (users can import OpenAPI spec into Postman directly)
- No API playground beyond Swagger UI (e.g., no Stoplight or Redoc)

### Key Files to Modify/Create

| File                                          | Action                                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| `apps/backend/convex/api/openapi/registry.ts` | Create — endpoint registry with OpenAPI metadata           |
| `apps/backend/convex/api/openapi/schemas.ts`  | Create — Zod schemas with `.openapi()` extensions          |
| `apps/backend/convex/api/openapi.json`        | Create (generated) — the OpenAPI 3.1 spec                  |
| `apps/backend/convex/http.ts`                 | Modify — add GET /api/v1/openapi.json route                |
| `apps/backend/convex/validations/*.ts`        | Modify — add `.openapi()` metadata to existing Zod schemas |
| `scripts/generate-openapi.ts`                 | Create — build script for spec generation                  |
| `apps/web/src/routes/api.docs.tsx`            | Create — Swagger UI page                                   |
| `packages/sdk/`                               | Create — generated TypeScript SDK package                  |
| `packages/sdk/package.json`                   | Create — npm package config for @seal/sdk                  |
| `package.json` (root)                         | Modify — add `generate:openapi` script                     |
