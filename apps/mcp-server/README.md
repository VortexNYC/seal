# Seal MCP Server

An MCP (Model Context Protocol) server that enables AI assistants like Claude to interact with the Seal document signing platform.

## Features

### Tools (25 total)

**Documents (8 tools)**
- `list_documents` - List documents with pagination and status filtering
- `get_document` - Get document details with optional recipient info
- `create_document` - Create a new document in draft status
- `update_document` - Update document metadata
- `delete_document` - Delete a draft document
- `send_document` - Send a document for signing
- `void_document` - Void/cancel a document
- `download_document` - Get document download URL

**Templates (7 tools)**
- `list_templates` - List templates with pagination
- `get_template` - Get template details
- `get_template_fields` - Get template field definitions
- `create_template` - Create template from document
- `update_template` - Update template metadata
- `delete_template` - Delete a template
- `use_template` - Create document from template

**Recipients (6 tools)**
- `list_recipients` - List document recipients
- `get_recipient` - Get recipient details
- `add_recipient` - Add recipient to document
- `update_recipient` - Update recipient details
- `remove_recipient` - Remove recipient from document
- `send_reminder` - Send signing reminder

**Signatures (4 tools)**
- `list_signatures` - List document signatures
- `get_signature` - Get signature details
- `verify_document` - Verify signature integrity
- `get_audit_trail` - Get document audit trail

### Resources
- `seal://documents` - List of all documents
- `seal://documents/{id}` - Single document details
- `seal://templates` - List of all templates
- `seal://templates/{id}` - Single template with fields

## Transport Modes

The MCP server supports two transport modes:

### HTTP Transport (Recommended for Production)

Deploy to Vercel for hosted access with OAuth authentication via Clerk.

```json
{
  "mcpServers": {
    "seal": {
      "type": "http",
      "url": "https://mcp.seal.app/mcp"
    }
  }
}
```

The HTTP transport uses Clerk OAuth for authentication. When connecting, MCP clients will:
1. Fetch `/.well-known/oauth-protected-resource` to discover the auth server
2. Redirect users to Clerk for authentication
3. Use the JWT token to authenticate requests

### Stdio Transport (Local Development)

For local development and testing:

```json
{
  "mcpServers": {
    "seal": {
      "type": "stdio",
      "command": "bun",
      "args": ["/path/to/seal/apps/mcp-server/src/index.ts", "--stdio"],
      "env": {
        "SEAL_API_KEY": "your_api_key_here",
        "SEAL_API_BASE_URL": "https://your-deployment.convex.site/api/v1"
      }
    }
  }
}
```

Note: `upload_file` is only available in stdio mode because it reads local file paths. For HTTP transport, upload via the Seal API and pass the `storage_id` to `create_document`.

## Configuration

### Environment Variables

```bash
# Optional: API key for server-to-server auth fallback (used if no user JWT is forwarded)
SEAL_API_KEY=sk_your_api_key

# Required for HTTP mode: Clerk secret key for JWT validation
CLERK_SECRET_KEY=sk_live_xxx

# Required for OAuth discovery: Clerk publishable key
CLERK_PUBLISHABLE_KEY=pk_live_xxx

# Optional: API base URL (defaults to production)
SEAL_API_BASE_URL=https://seal.convex.site/api/v1

# Optional: Request timeout in ms (default: 30000)
SEAL_REQUEST_TIMEOUT=30000

# Optional: Enable debug logging
SEAL_DEBUG=true

# Optional: Server port for local development (default: 5183)
PORT=5183
```

## Development

```bash
# Install dependencies
bun install

# Run HTTP server in development mode (with hot reload)
SEAL_API_KEY=your_key CLERK_SECRET_KEY=your_secret bun run dev

# Build for production
bun run build

# Run production build
bun run start
```

## Deployment to Vercel

Vercel has zero-configuration support for Hono apps. Simply:

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `SEAL_API_KEY` (optional if forwarding Clerk JWTs)
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `SEAL_API_BASE_URL`
3. Deploy

The MCP server exports a default Hono app that Vercel automatically detects.

## Clerk OAuth Setup

For HTTP transport with OAuth authentication:

1. In Clerk Dashboard, enable "Machine Token Authentication"
2. Configure allowed OAuth scopes: `openid`, `profile`, `email`
3. Set your MCP server URL as an allowed redirect origin
4. The server automatically provides OAuth discovery endpoints:
   - `/.well-known/oauth-protected-resource` (RFC 9728)
   - `/.well-known/oauth-authorization-server` (RFC 8414)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Main MCP protocol endpoint |
| `/mcp` | GET | SSE stream for server-sent events |
| `/mcp` | DELETE | Close MCP session |
| `/health` | GET | Health check |
| `/.well-known/oauth-protected-resource` | GET | OAuth resource metadata |
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata |

## Usage Examples

### Complete Document Workflow

**1. Upload a PDF file:**
```bash
# In stdio mode (local development)
upload_file(file_path="/path/to/contract.pdf")

# In HTTP mode (production)
upload_file_content(file_name="contract.pdf", content_base64="...")
```

**2. Create a document:**
```bash
create_document(
  title="Q4 Partnership Agreement",
  description="Partnership agreement for Q4 2024",
  storage_id="storage_123456789",
  file_size=245760,
  file_type="application/pdf",
  page_count=5
)
```

**3. Add recipients:**
```bash
add_recipient(
  document_id="doc_123456789",
  name="Alice Johnson",
  email="alice@company.com",
  role="signer",
  order=1
)

add_recipient(
  document_id="doc_123456789",
  name="Bob Smith",
  email="bob@company.com",
  role="approver",
  order=2
)
```

**4. Send for signing:**
```bash
send_document(
  id="doc_123456789",
  message="Please review and sign this partnership agreement"
)
```

**5. Monitor progress:**
```bash
get_document(id="doc_123456789", include_recipients=true)
```

### Template Management

**Create a template from existing document:**
```bash
create_template(
  document_id="doc_123456789",
  name="Partnership Agreement Template",
  description="Standard partnership agreement template"
)
```

**Use template to create new document:**
```bash
use_template(
  template_id="tmpl_123456789",
  title="New Partnership with XYZ Corp"
)
```

### Document Administration

**List documents with filtering:**
```bash
list_documents(status="sent", limit=10)
```

**Void a document:**
```bash
void_document(id="doc_123456789", reason="Terms changed")
```

**Get audit trail:**
```bash
get_audit_trail(document_id="doc_123456789")
```

### Bulk Recipient Management

**Add multiple recipients at once:**
```bash
add_recipients_bulk(
  document_id="doc_123456789",
  recipients=[
    {
      name="Alice Johnson",
      email="alice@company.com",
      role="signer",
      order=1
    },
    {
      name="Bob Smith",
      email="bob@company.com",
      role="approver",
      order=2
    }
  ]
)
```

**Update multiple recipients:**
```bash
update_recipients_bulk(
  document_id="doc_123456789",
  updates=[
    {
      id="recipient_abc123",
      role="approver"
    },
    {
      id="recipient_def456",
      name="Robert Smith"
    }
  ]
)
```

## API Reference

### Documents

| Tool | Parameters | Response |
|------|------------|----------|
| `list_documents` | `limit?: number, cursor?: string, status?: DocumentStatus` | `{ data: Document[], has_more: boolean }` |
| `get_document` | `id: string, include_recipients?: boolean` | `Document` with optional recipients array |
| `create_document` | `title: string, storage_id: string, file_size: number, file_type: string, ...` | `{ id: string }` |
| `update_document` | `id: string, title?: string, description?: string, deadline?: string` | `{ success: boolean }` |
| `delete_document` | `id: string` | `{ success: boolean }` |
| `send_document` | `id: string, message?: string` | `{ success: boolean }` |
| `void_document` | `id: string, reason?: string` | `{ success: boolean }` |
| `download_document` | `id: string` | `{ url: string }` |

### Templates

| Tool | Parameters | Response |
|------|------------|----------|
| `list_templates` | `limit?: number, cursor?: string, status?: TemplateStatus` | `{ data: Template[], has_more: boolean }` |
| `get_template` | `id: string` | `Template` |
| `get_template_fields` | `id: string` | `Field[]` |
| `create_template` | `document_id: string, name: string, description?: string` | `{ id: string }` |
| `update_template` | `id: string, name?: string, description?: string, status?: TemplateStatus` | `{ success: boolean }` |
| `delete_template` | `id: string` | `{ success: boolean }` |
| `use_template` | `template_id: string, title: string` | `{ id: string }` |

### Recipients

| Tool | Parameters | Response |
|------|------------|----------|
| `list_recipients` | `document_id: string` | `Recipient[]` |
| `get_recipient` | `document_id: string, recipient_id: string` | `Recipient` |
| `add_recipient` | `document_id: string, name: string, email: string, role: RecipientRole, order?: number` | `{ id: string }` |
| `add_recipients_bulk` | `document_id: string, recipients: AddRecipientInput[]` | `{ added: number, recipients: { id: string, email: string }[] }` |
| `update_recipient` | `document_id: string, recipient_id: string, name?: string, email?: string, role?: RecipientRole` | `{ success: boolean }` |
| `update_recipients_bulk` | `document_id: string, updates: UpdateRecipientInput[]` | `{ updated: number }` |
| `remove_recipient` | `document_id: string, recipient_id: string` | `{ success: boolean }` |
| `send_reminder` | `document_id: string, recipient_id: string` | `{ success: boolean }` |

### Signatures

| Tool | Parameters | Response |
|------|------------|----------|
| `list_signatures` | `document_id: string` | `Signature[]` |
| `get_signature` | `document_id: string, signature_id: string` | `Signature` |
| `verify_document` | `document_id: string` | `{ valid: boolean, details: object }` |
| `get_audit_trail` | `document_id: string` | `AuditEntry[]` |

### Uploads

| Tool | Parameters | Response |
|------|------------|----------|
| `upload_file` | `file_path: string` *(stdio mode only)* | `{ storage_id: string, file_name: string, file_size: number }` |
| `upload_file_content` | `file_name: string, content_base64: string` | `{ storage_id: string, file_name: string, file_size: number }` |

## API Scopes

The MCP server requires a Clerk API key with these scopes:

- `seal:documents:read` - Read document metadata and content
- `seal:documents:write` - Create, update, delete documents
- `seal:templates:read` - Read template metadata and fields
- `seal:templates:write` - Create, update, delete templates
- `seal:recipients:read` - Read recipient information
- `seal:recipients:write` - Manage document recipients
- `seal:signatures:read` - Read signature data and verification
