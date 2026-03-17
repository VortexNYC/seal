/**
 * @fileoverview Converts webhook event payloads to Slack Block Kit messages.
 *
 * Each event type gets a human-readable Slack message with contextual details.
 * Uses Slack's Block Kit format: https://api.slack.com/block-kit
 *
 * @module webhooks/slack_formatter
 */

type WebhookPayload = {
  id: string;
  type: string;
  api_version: string;
  created_at: string;
  organization_id: string;
  data: Record<string, unknown>;
};

type SlackBlock =
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "context"; elements: { type: "mrkdwn"; text: string }[] }
  | { type: "divider" };

type SlackMessage = {
  text: string;
  blocks: SlackBlock[];
};

const EVENT_EMOJI: Record<string, string> = {
  "document.created": ":page_facing_up:",
  "document.sent": ":outbox_tray:",
  "document.viewed": ":eyes:",
  "document.completed": ":white_check_mark:",
  "document.voided": ":no_entry_sign:",
  "document.expired": ":hourglass:",
  "document.declined": ":x:",
  "recipient.added": ":bust_in_silhouette:",
  "recipient.viewed": ":eyes:",
  "recipient.signed": ":black_nib:",
  "recipient.approved": ":thumbsup:",
  "recipient.declined": ":thumbsdown:",
  "recipient.reminded": ":mega:",
  "template.created": ":clipboard:",
  "template.updated": ":pencil2:",
  "template.used": ":arrow_right:",
  "test.ping": ":wave:",
};

const EVENT_LABEL: Record<string, string> = {
  "document.created": "Document Created",
  "document.sent": "Document Sent",
  "document.viewed": "Document Viewed",
  "document.completed": "Document Completed",
  "document.voided": "Document Voided",
  "document.expired": "Document Expired",
  "document.declined": "Document Declined",
  "recipient.added": "Recipient Added",
  "recipient.viewed": "Recipient Viewed Document",
  "recipient.signed": "Recipient Signed",
  "recipient.approved": "Recipient Approved",
  "recipient.declined": "Recipient Declined",
  "recipient.reminded": "Recipient Reminded",
  "template.created": "Template Created",
  "template.updated": "Template Updated",
  "template.used": "Template Used",
  "test.ping": "Test Ping",
};

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildDetailLines(data: Record<string, unknown>, eventType: string): string[] {
  const lines: string[] = [];

  // Document fields
  if (data.document_title) lines.push(`*Document:* ${str(data.document_title)}`);
  if (data.document_id) lines.push(`*ID:* \`${str(data.document_id)}\``);

  // Recipient fields
  if (data.recipient_name) lines.push(`*Recipient:* ${str(data.recipient_name)}`);
  if (data.recipient_email) lines.push(`*Email:* ${str(data.recipient_email)}`);

  // Template fields
  if (data.template_name) lines.push(`*Template:* ${str(data.template_name)}`);

  // Completion fields
  if (eventType === "document.completed" && data.signed_count) {
    lines.push(`*Signatures:* ${str(data.signed_count)} of ${str(data.total_count)}`);
  }

  // Expiry fields
  if (data.expires_at) lines.push(`*Expires:* ${str(data.expires_at)}`);

  // Decline reason
  if (data.reason) lines.push(`*Reason:* ${str(data.reason)}`);

  // Test ping
  if (data.message) lines.push(str(data.message));

  return lines;
}

/**
 * Convert a webhook payload to a Slack Block Kit message.
 */
export function formatSlackMessage(payload: WebhookPayload): SlackMessage {
  const emoji = EVENT_EMOJI[payload.type] ?? ":bell:";
  const label = EVENT_LABEL[payload.type] ?? payload.type;
  const fallbackText = `${label} — ${payload.type}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${label}*`,
      },
    },
  ];

  const details = buildDetailLines(payload.data, payload.type);
  if (details.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: details.join("\n"),
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Seal · \`${payload.type}\` · ${payload.created_at}`,
      },
    ],
  });

  return { text: fallbackText, blocks };
}
