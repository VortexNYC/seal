/**
 * @fileoverview Product knowledge resources for the Seal MCP server.
 *
 * These static resources let AI assistants answer "how does X work" questions
 * about Seal without requiring the user to read docs themselves.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveTemplateVariable } from "./variables";

const KNOWLEDGE_BASE: Record<string, { title: string; content: string }> = {
  overview: {
    title: "Seal — Product Overview",
    content: `# Seal — Product Overview

Seal is an intelligent document platform for signing, payment collection, and workflow automation.

## Core Concepts

- **Documents**: PDFs uploaded to Seal that get routed to recipients for signing or approval.
- **Recipients**: People who receive a document — they can be signers, approvers, or viewers.
- **Templates**: Reusable document layouts with pre-placed signature fields. Create a template once, use it for every NDA, contract, or agreement.
- **Fields**: Signing zones placed on document pages — signature, text, date, checkbox, dropdown, radio, or file attachment.
- **Audit Trail**: A tamper-evident log of every action on a document (viewed, signed, declined) with timestamps and IP addresses.
- **Webhooks**: HTTP callbacks fired in real-time when document events occur.

## Key Capabilities

- **AI field detection**: Automatically detect where signature fields belong on uploaded PDFs.
- **Agent field placement**: seal_create_document_field, seal_place_field_candidates, seal_get_field_suggestions / seal_apply_field_suggestions, and seal_apply_document_bindings let agents place and fill fields without the web UI.
- **Agent document power**: seal_get_document_annotations / generate, seal_preview_document (markdown|structured|pdf|original), seal_split_document, seal_annotate_document_pdf (highlight/text/rect/redact).
- **Sequential signing**: Route a document through signers in a specific order before the next group receives it.
- **Payment collection**: Collect payments as part of the signing flow through Vortex Payments.
- **ESIGN compliance**: Full U.S. ESIGN Act compliance with consent capture and audit trail.
- **Cryptographic verification**: Every signature is hashed with SHA-256 — tamper detection is built in.
- **REST API**: Full programmatic access to every feature.
- **MCP server**: AI-native access via the Model Context Protocol.

## Typical Workflow

1. Upload a PDF → Seal stores it securely
2. Create a document → add title, description, deadline
3. Add recipients → assign roles and signing order
4. Send → recipients receive email invitations with secure signing links
5. Monitor → track signing progress in real-time
6. Complete → all parties receive the signed PDF; audit certificate generated`,
  },

  "document-states": {
    title: "Document States & Lifecycle",
    content: `# Document States & Lifecycle

Documents move through a state machine from creation to completion.

## States

| State | Description |
|-------|-------------|
| \`draft\` | Being prepared. Can be edited, recipients added, fields placed. Not yet sent. |
| \`sent\` | Sent to all recipients. Waiting for the first action. |
| \`in_progress\` | At least one recipient has taken action (signed, approved, or viewed). |
| \`completed\` | All required recipients have signed/approved. The document is final. |
| \`cancelled\` | Voided by the sender. No further action is possible. |
| \`declined\` | A recipient declined to sign. The workflow is stopped. |

## State Transitions

\`\`\`
draft → sent → in_progress → completed
                    ↓
                 declined
draft → cancelled
sent  → cancelled
in_progress → cancelled
\`\`\`

## Rules

- Only **draft** documents can be edited or have recipients/fields changed.
- Only **draft** documents can be deleted (use void for sent documents).
- **Completed** documents cannot be voided.
- When a document is voided (\`cancelled\`), all recipients are notified by email.
- When a document is \`completed\`, a certificate of completion is generated and all parties receive the signed PDF.

## Deadlines

Documents can have a signing deadline. Expired documents trigger a \`document.expired\` webhook event. Recipients are reminded automatically per the organization's notification schedule.`,
  },

  "recipient-roles": {
    title: "Recipient Roles & Signing Order",
    content: `# Recipient Roles & Signing Order

## Roles

| Role | Description | Can Sign Fields | Blocks Completion |
|------|-------------|-----------------|-------------------|
| \`signer\` | Must sign the document. Has signature, initials, and field inputs to complete. | Yes | Yes — all signers must sign |
| \`approver\` | Reviews and approves without placing a formal signature. Gets an approve/decline button. | No | Yes — all approvers must approve |
| \`viewer\` | Receives access to view the document only. No action required. | No | No |

## Sequential vs. Parallel Signing

### Parallel (default)
All recipients receive invitations at the same time. They can sign in any order.

### Sequential
Recipients are assigned an \`order\` number (1, 2, 3...). Seal waits for group 1 to complete before sending invitations to group 2.

To set up sequential signing, pass \`order\` when adding recipients:
- Recipients with \`order: 1\` sign first
- Recipients with \`order: 2\` are notified only after all order-1 recipients are done
- Recipients with the same order number sign in parallel within that group

## Recipient Statuses

| Status | Meaning |
|--------|---------|
| \`pending\` | Invited but hasn't opened the document yet |
| \`viewed\` | Opened the document but not yet signed |
| \`signed\` | Completed their signature |
| \`approved\` | Approved (approver role) |
| \`declined\` | Declined to sign — stops the workflow |`,
  },

  "field-types": {
    title: "Field Types",
    content: `# Field Types

Fields are placed on document pages to collect information from recipients.

## Available Field Types

| Type | Description | Stored As |
|------|-------------|-----------|
| \`signature\` | Handwritten, typed, or uploaded signature | Image (PNG) |
| \`text\` | Free-text input (name, address, custom info) | String |
| \`date\` | Date picker, defaults to signing date | ISO date string |
| \`checkbox\` | One or more checkboxes — supports multi-select | JSON array of selected values |
| \`dropdown\` | Single selection from a list of options | String |
| \`radio\` | Single selection from mutually exclusive options | String |
| \`attachment\` | File upload by the recipient (e.g. ID document) | R2 storage key |

## Field Properties

All fields have:
- \`page\`: Page number (1-indexed)
- \`x\`, \`y\`: Position as percentage of page dimensions (0–100)
- \`width\`, \`height\`: Dimensions as percentage of page dimensions
- \`is_required\`: Whether the field must be completed before signing
- \`label\`: Display label shown to the recipient

Optional:
- \`placeholder\`: Hint text shown inside the field
- \`default_value\`: Pre-filled value
- \`options\`: Array of options for checkbox, dropdown, and radio fields

## AI Field Detection

Seal's AI can automatically detect where fields should go based on document content. Common patterns it recognizes: signature lines, "Date:", "Print Name:", "Initial here", checkbox lists.`,
  },

  "sequential-signing": {
    title: "Sequential Signing",
    content: `# Sequential Signing

Sequential signing routes a document through signers in a defined order — no one in group 2 is notified until everyone in group 1 has completed.

## How It Works

1. Assign an \`order\` to each recipient when adding them (1, 2, 3...)
2. Recipients with the same order number form a **group** and sign in parallel
3. When all members of group N complete, group N+1 automatically receives their invitation emails
4. The document moves through groups until all are done, then marks as completed

## Example: 3-Party Contract

\`\`\`
Order 1: Legal review (approver) — must approve before anyone signs
Order 2: Employee (signer) + Manager (signer) — sign in parallel
Order 3: HR (signer) — countersigns last
\`\`\`

API calls:
\`\`\`json
[
  { "email": "legal@company.com", "role": "approver", "order": 1 },
  { "email": "employee@company.com", "role": "signer", "order": 2 },
  { "email": "manager@company.com", "role": "signer", "order": 2 },
  { "email": "hr@company.com", "role": "signer", "order": 3 }
]
\`\`\`

## Reminders

Automatic reminders are sent to **the current active group** only — not to future groups who haven't been notified yet. You can also trigger manual reminders with \`seal_send_reminder\`.`,
  },

  webhooks: {
    title: "Webhooks",
    content: `# Webhooks

Webhooks deliver real-time HTTP POST notifications to your server when Seal events occur.

## Available Events

### Document Events
| Event | Fired When |
|-------|-----------|
| \`document.created\` | A new document is created |
| \`document.sent\` | A document is sent to recipients |
| \`document.viewed\` | Any recipient opens the document |
| \`document.completed\` | All required signatures collected |
| \`document.voided\` | Document cancelled by sender |
| \`document.expired\` | Signing deadline passed |
| \`document.declined\` | A recipient declined to sign |

### Recipient Events
| Event | Fired When |
|-------|-----------|
| \`recipient.added\` | Recipient added to a document |
| \`recipient.viewed\` | Recipient opened the document |
| \`recipient.signed\` | Recipient signed |
| \`recipient.approved\` | Recipient approved |
| \`recipient.declined\` | Recipient declined |
| \`recipient.reminded\` | Reminder email sent |

### Template Events
| Event | Fired When |
|-------|-----------|
| \`template.created\` | New template created |
| \`template.updated\` | Template modified |
| \`template.used\` | Document created from template |

## Payload Format

\`\`\`json
{
  "id": "evt_...",
  "type": "document.completed",
  "created_at": "2025-01-27T10:30:00Z",
  "data": {
    "document_id": "...",
    "title": "Service Agreement",
    "status": "completed"
  }
}
\`\`\`

## Signature Verification

Every webhook is signed with HMAC-SHA256. Verify using the \`X-Seal-Signature\` header:

\`\`\`typescript
import crypto from "crypto";

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

## Limits & Retry

- Maximum 10 webhook endpoints per organization
- Delivery timeout: 30 seconds
- Retry policy: exponential backoff, up to 3 attempts
- Endpoint URL must use HTTPS`,
  },

  limits: {
    title: "Limits & Quotas",
    content: `# Limits & Quotas

## API Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 60 per API key |
| Requests per hour | 1,000 per API key |

Rate limit headers are included in every response:
\`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## File Limits

| Limit | Value |
|-------|-------|
| Maximum file size | 25 MB |
| Supported formats | PDF only |
| Maximum pages | 500 pages |

## Pagination

List endpoints default to 20 items, maximum 100 per request. Use the \`cursor\` from the response for the next page.

## Webhooks

| Limit | Value |
|-------|-------|
| Endpoints per organization | 10 |
| Delivery timeout | 30 seconds |
| Retry attempts | 3 (exponential backoff) |

## Recipients

| Limit | Value |
|-------|-------|
| Recipients per document | 50 |
| Bulk add per request | 50 recipients |

## Templates

Templates are stored indefinitely. There is no limit on the number of templates per organization.`,
  },

  authentication: {
    title: "Authentication & API Keys",
    content: `# Authentication & API Keys

## API Key Format

Seal API keys use Bearer token authentication:
\`\`\`
Authorization: Bearer ak_your_api_key_here
\`\`\`

Keys are prefixed with \`ak_\` and are scoped to specific permissions.

## Scopes

| Scope | Access |
|-------|--------|
| \`seal:documents:read\` | List and read documents |
| \`seal:documents:write\` | Create, update, send, void documents |
| \`seal:recipients:read\` | List and read recipients |
| \`seal:recipients:write\` | Add, update, remove recipients |
| \`seal:templates:read\` | List and read templates |
| \`seal:templates:write\` | Create, update, delete templates |
| \`seal:signatures:read\` | Read signatures and audit trails |
| \`seal:webhooks:manage\` | Full webhook endpoint management |

## Security Best Practices

- Never expose API keys in client-side code or public repositories
- Use environment variables to store keys (\`SEAL_API_KEY\`)
- Create scoped keys with only the permissions your integration needs
- Rotate keys immediately if compromised using the Seal dashboard
- Keys are organization-scoped — they can only access data from the organization they belong to

## MCP Authentication

The MCP server uses OAuth 2.0. When connecting via Claude Desktop or another MCP client, you'll be redirected to Seal's OAuth flow to authorize access. The MCP server requests the same scopes as above based on which tools it needs.`,
  },
};

const VALID_TOPICS = Object.entries(KNOWLEDGE_BASE);
const VALID_TOPIC_KEYS = Object.keys(KNOWLEDGE_BASE);

/**
 * Registers product knowledge resources with the MCP server.
 * These are static resources — no auth token required.
 */
export function registerDocsResources(server: McpServer): void {
  // Index resource — lists all available topics
  server.resource(
    "docs-index",
    "seal://docs",
    {
      description:
        "Seal product documentation index. Lists all available knowledge topics.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const topicList = VALID_TOPICS.map(
        ([topic, entry]) =>
          `- [${entry.title}](seal://docs/${topic}) — \`seal://docs/${topic}\``
      ).join("\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Seal Knowledge Base

Read any topic using its URI (e.g. \`seal://docs/overview\`).

## Available Topics

${topicList}`,
          },
        ],
      };
    }
  );

  // Individual topic resource template
  server.resource(
    "docs-topic",
    new ResourceTemplate("seal://docs/{topic}", { list: undefined }),
    {
      description:
        "Seal product knowledge on a specific topic. Valid topics: " +
        VALID_TOPIC_KEYS.join(", "),
      mimeType: "text/markdown",
    },
    async (uri, { topic }) => {
      const topicKey = resolveTemplateVariable(topic);
      const entry = KNOWLEDGE_BASE[topicKey];

      if (!entry) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# Topic Not Found\n\nNo documentation found for topic: \`${topicKey}\`\n\nAvailable topics: ${VALID_TOPIC_KEYS.join(", ")}`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: entry.content,
          },
        ],
      };
    }
  );
}
