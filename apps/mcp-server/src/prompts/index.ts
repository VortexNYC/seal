/**
 * @fileoverview Pre-built prompt templates for the Seal MCP server.
 *
 * Prompts guide AI assistants through common Seal workflows step-by-step,
 * so users don't need to know which tools to call or in what order.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers all prompt templates with the MCP server.
 */
export function registerAllPrompts(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Send Document
  // ---------------------------------------------------------------------------
  server.prompt(
    "send-document",
    "Guide through the complete workflow to upload a PDF and send it for signing — from file upload to notifying recipients.",
    {
      file_description: z
        .string()
        .optional()
        .describe("What the document is (e.g. 'NDA', 'service agreement', 'employment contract')"),
      recipient_count: z
        .string()
        .optional()
        .describe("Approximate number of signers (e.g. '1', '2-3', 'multiple')"),
    },
    ({ file_description, recipient_count }) => {
      const docDesc = file_description ? ` for a ${file_description}` : "";
      const recipientHint = recipient_count
        ? ` The user expects roughly ${recipient_count} signer(s).`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to send a document${docDesc} for signing.${recipientHint}

Please guide me through the full workflow:
1. Upload the PDF file (use seal_upload_file for local files or seal_upload_file_content for base64)
2. Create the document with seal_create_document using the returned storage_id
3. Add recipients with seal_add_recipient or seal_add_recipients_bulk
4. Send it with seal_send_document

Ask me for the file path or content, then for recipient details (name, email, and role: signer/approver/viewer). Walk me through each step.`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Check Signing Status
  // ---------------------------------------------------------------------------
  server.prompt(
    "check-signing-status",
    "Check the current signing status of documents — who has signed, who is pending, and whether to send reminders.",
    {
      document_title: z
        .string()
        .optional()
        .describe("Title or partial title of the document to check"),
    },
    ({ document_title }) => {
      const docHint = document_title ? ` specifically looking for "${document_title}"` : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to check the signing status of my documents${docHint}.

Please:
1. Use seal_list_documents to find the relevant document(s) — filter by status if helpful (sent, in_progress)
2. Use seal_get_document with include_recipients=true to see who has signed and who is pending
3. Summarize the status clearly: who signed, who hasn't, and the overall completion state
4. If there are pending recipients, ask whether I want to send reminders using seal_send_reminder`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Use Template
  // ---------------------------------------------------------------------------
  server.prompt(
    "use-template",
    "Create and send a document from a saved template — find the template, create the document, add recipients, and send.",
    {
      template_name: z.string().optional().describe("Name or partial name of the template to use"),
    },
    ({ template_name }) => {
      const templateHint = template_name
        ? ` I'm looking for a template called "${template_name}".`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to send a document using one of my saved templates.${templateHint}

Please:
1. Use seal_list_templates to show available templates
2. Once I pick one, use seal_get_template_fields to show what fields and signing zones it has
3. Create a new document from the template using seal_use_template
4. Add recipients with seal_add_recipient or seal_add_recipients_bulk — match recipients to the template's defined signing roles
5. Send with seal_send_document

Walk me through each step.`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Verify Signed Document
  // ---------------------------------------------------------------------------
  server.prompt(
    "verify-document",
    "Verify the cryptographic integrity of a signed document, review the full audit trail, and get the download URL.",
    {
      document_id: z.string().optional().describe("The document ID to verify, if already known"),
    },
    ({ document_id }) => {
      const idHint = document_id
        ? ` The document ID is: ${document_id}.`
        : " I'll need to find the document first.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to verify a signed document and get its audit trail.${idHint}

Please:
1. If no document ID given, use seal_list_documents filtered to status=completed to find it
2. Run seal_verify_document to check cryptographic integrity of all signatures
3. Use seal_get_audit_trail to show the full activity history (who viewed, signed, and when)
4. Use seal_download_document to provide the download URL for the signed PDF
5. Give me a clear summary: is the document tamper-proof? Who signed, when, and from where?`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Set Up Webhooks
  // ---------------------------------------------------------------------------
  server.prompt(
    "setup-webhooks",
    "Set up a webhook endpoint to receive real-time notifications for Seal events like document completions and signatures.",
    {
      endpoint_url: z
        .string()
        .optional()
        .describe("The HTTPS URL of the endpoint that will receive webhook events"),
    },
    ({ endpoint_url }) => {
      const urlHint = endpoint_url
        ? ` My endpoint URL is: ${endpoint_url}.`
        : " I'll need to provide the endpoint URL.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to set up webhooks to get notified about Seal events.${urlHint}

Please:
1. Use seal_list_webhook_event_types to show all available events with descriptions
2. Help me choose which events to subscribe to based on my use case
3. Create the webhook with seal_create_webhook — the signing secret will only be shown once, so I'll need to save it
4. Confirm the setup with seal_get_webhook and show the delivery stats

Important: After setup, tell me how to verify incoming webhooks — I'll need to check the X-Seal-Signature header using HMAC-SHA256 with my signing secret.`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Void / Cancel Document
  // ---------------------------------------------------------------------------
  server.prompt(
    "void-document",
    "Cancel a sent document and notify all recipients that it has been voided.",
    {
      document_title: z.string().optional().describe("Title of the document to void"),
    },
    ({ document_title }) => {
      const hint = document_title ? ` for "${document_title}"` : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I need to cancel/void a document${hint} and stop the signing process.

Please:
1. Use seal_list_documents to find the document — filter by status=sent or status=in_progress
2. Confirm with me that this is the right document and show its current signing state
3. Ask for a reason to include in the void notification (all recipients will be emailed)
4. Call seal_void_document with the reason

Note: Completed documents cannot be voided. Drafts should be deleted with seal_delete_document instead.`,
            },
          },
        ],
      };
    },
  );
}
