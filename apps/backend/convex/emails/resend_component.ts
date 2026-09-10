/**
 * Resend transport adapter.
 *
 * Seal sends transactional email directly through Resend's HTTP API and keeps
 * delivery-event audit logging in this file. This replaces the Convex Resend
 * component so the dependency graph does not pull in provider residue.
 */

import { parse } from "@vortexnyc/convex/helpers";
import { type Infer, v } from "convex/values";
import { Webhook } from "standardwebhooks";

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { logAction } from "../audit_logs/helpers";

export type EmailHeader = { name: string; value: string };

export type SendEmailOptions =
  | {
      from: string;
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string | string[];
      headers?: EmailHeader[] | Record<string, string>;
    }
  | {
      from: string;
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject?: string;
      template: {
        id: string;
        variables?: Record<string, string | number>;
      };
      html?: never;
      text?: never;
      replyTo?: string | string[];
      headers?: EmailHeader[] | Record<string, string>;
    };

export type SendEmailManualOptions = {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  replyTo?: string | string[];
  headers?: EmailHeader[] | Record<string, string>;
};

export type ResendEmailPayload = SendEmailOptions;

export type ResendEmailResult = {
  data: { id: string } | null;
  error: { message?: string; name?: string; statusCode?: number | null } | null;
};

function requireResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return apiKey;
}

function normalizeHeaders(
  headers: EmailHeader[] | Record<string, string> | undefined
) {
  if (!headers) return undefined;
  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers.map((header) => [header.name, header.value])
    );
  }
  return headers;
}

function toResendApiPayload(options: SendEmailOptions) {
  return {
    from: options.from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    html: "html" in options ? options.html : undefined,
    text: "text" in options ? options.text : undefined,
    reply_to: options.replyTo,
    headers: normalizeHeaders(options.headers),
    template: "template" in options ? options.template : undefined,
  };
}

function pickIdempotencyKey(
  headers: EmailHeader[] | Record<string, string> | undefined
) {
  const normalized = normalizeHeaders(headers);
  return normalized?.["Idempotency-Key"] ?? normalized?.["idempotency-key"];
}

export async function sendResendEmail(
  options: ResendEmailPayload
): Promise<ResendEmailResult> {
  const workerUrl = process.env.SIGN_API_EMAIL_URL;
  const workerKey = process.env.SIGN_API_EMAIL_KEY;
  if (workerUrl && workerKey) {
    const response = await fetch(`${workerUrl}/internal/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": workerKey,
      },
      body: JSON.stringify({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: "html" in options ? options.html : undefined,
        text: "text" in options ? options.text : undefined,
      }),
    });

    const raw = await response.text();
    const result = parse(
      v.optional(v.object({ success: v.boolean(), id: v.string() })),
      (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })()
    );

    if (result?.success && result.id) {
      return { data: { id: result.id }, error: null };
    }

    return {
      data: null,
      error: {
        message: result ? "Worker send failed" : "Worker returned invalid JSON",
        statusCode: response.status,
        name: "worker_email_error",
      },
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireResendApiKey()}`,
      "Content-Type": "application/json",
      ...(pickIdempotencyKey(options.headers)
        ? { "Idempotency-Key": pickIdempotencyKey(options.headers) }
        : {}),
    },
    body: JSON.stringify(toResendApiPayload(options)),
  });

  if (!response.ok) {
    const raw = await response.text();
    try {
      return { data: null, error: parse(vResendErrorBody, JSON.parse(raw)) };
    } catch {
      return {
        data: null,
        error: {
          message: response.statusText || "Resend request failed",
          statusCode: response.status,
          name: "resend_error",
        },
      };
    }
  }

  return {
    data: parseResendSendResponse(await response.json()),
    error: null,
  };
}

const vResendErrorBody = v.object({
  message: v.optional(v.string()),
  name: v.optional(v.string()),
  statusCode: v.optional(v.union(v.number(), v.null())),
});

function parseResendSendResponse(value: unknown): { id: string } {
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return { id: value.id };
  }
  throw new Error("Unexpected Resend send response shape");
}

export async function sendEmailFromAction(
  ctx: Pick<ActionCtx, "runMutation">,
  options: SendEmailOptions
): Promise<string> {
  const subject =
    "template" in options && options.subject === undefined
      ? `template:${options.template.id}`
      : sealAssertPresent(
          options.subject,
          "Expected Resend email subject to be present."
        );

  return await sendEmailManuallyFromAction(
    ctx,
    {
      from: options.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      replyTo: options.replyTo,
      headers: options.headers,
    },
    async (idempotencyKey) => {
      const { data, error } = await sendResendEmail({
        ...options,
        headers: {
          ...normalizeHeaders(options.headers),
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (error) throw new Error(error.message ?? "Resend request failed");
      return sealAssertPresent(data).id;
    }
  );
}

/**
 * Auth draft payload from `@vortexnyc/auth/convex` draft builders.
 * Per vortex-core's email-transport-recipe, Core owns policy/templates and
 * transport is intentionally consumer-owned — this seam is Seal's transport.
 */
export type AuthEmailDraft = {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
};

/**
 * Send a Core auth email draft through Seal's Resend transport seam.
 * Swapping providers (or adopting `@convex-dev/resend`) only changes
 * `sendResendEmail` internals — call sites stay.
 */
export async function sendAuthEmailDraft(
  ctx: Pick<ActionCtx, "runMutation">,
  draft: AuthEmailDraft,
  extra?: {
    readonly replyTo?: string | string[];
    readonly headers?: EmailHeader[] | Record<string, string>;
  }
): Promise<string> {
  return await sendEmailFromAction(ctx, {
    from: draft.from,
    to: draft.to,
    subject: draft.subject,
    html: draft.html,
    text: draft.text,
    ...(extra?.replyTo !== undefined ? { replyTo: extra.replyTo } : {}),
    ...(extra?.headers !== undefined ? { headers: extra.headers } : {}),
  });
}

export async function sendEmailManuallyFromAction(
  ctx: Pick<ActionCtx, "runMutation">,
  options: SendEmailManualOptions,
  sendCallback: (idempotencyKey: string) => Promise<string>
): Promise<string> {
  const idempotencyKey = crypto.randomUUID();
  try {
    return await sendCallback(idempotencyKey);
  } catch (error) {
    console.error("[email] failed to send via Resend", {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function handleResendEventWebhookFromAction(
  ctx: Pick<ActionCtx, "runMutation">,
  request: Request
): Promise<Response> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not set");
  }

  const raw = await request.text();
  const webhook = new Webhook(webhookSecret);
  const payload = parse(
    vEmailEvent,
    webhook.verify(raw, {
      "webhook-id":
        request.headers.get("svix-id") ??
        request.headers.get("webhook-id") ??
        "",
      "webhook-timestamp":
        request.headers.get("svix-timestamp") ??
        request.headers.get("webhook-timestamp") ??
        "",
      "webhook-signature":
        request.headers.get("svix-signature") ??
        request.headers.get("webhook-signature") ??
        "",
    })
  );

  await ctx.runMutation(internal.emails.resend_component.handleEmailEvent, {
    id: payload.data.email_id,
    event: payload,
  });

  return new Response(null, { status: 201 });
}

function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const vEmailHeaders = v.optional(
  v.array(
    v.object({
      name: v.string(),
      value: v.string(),
    })
  )
);

const vCommonEmailEventFields = {
  broadcast_id: v.optional(v.string()),
  created_at: v.string(),
  email_id: v.string(),
  from: v.union(v.string(), v.array(v.string())),
  to: v.union(v.string(), v.array(v.string())),
  cc: v.optional(v.union(v.string(), v.array(v.string()))),
  bcc: v.optional(v.union(v.string(), v.array(v.string()))),
  reply_to: v.optional(v.union(v.string(), v.array(v.string()))),
  headers: vEmailHeaders,
  subject: v.string(),
  tags: v.optional(
    v.union(
      v.record(v.string(), v.string()),
      v.array(v.object({ name: v.string(), value: v.string() }))
    )
  ),
};

const vEmailEvent = v.union(
  v.object({
    type: v.literal("email.sent"),
    created_at: v.string(),
    data: v.object(vCommonEmailEventFields),
  }),
  v.object({
    type: v.literal("email.delivered"),
    created_at: v.string(),
    data: v.object(vCommonEmailEventFields),
  }),
  v.object({
    type: v.literal("email.delivery_delayed"),
    created_at: v.string(),
    data: v.object(vCommonEmailEventFields),
  }),
  v.object({
    type: v.literal("email.complained"),
    created_at: v.string(),
    data: v.object(vCommonEmailEventFields),
  }),
  v.object({
    type: v.literal("email.bounced"),
    created_at: v.string(),
    data: v.object({
      ...vCommonEmailEventFields,
      bounce: v.object({
        message: v.optional(v.string()),
        subType: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    }),
  }),
  v.object({
    type: v.literal("email.opened"),
    created_at: v.string(),
    data: v.object({
      ...vCommonEmailEventFields,
      open: v.object({
        ipAddress: v.optional(v.string()),
        timestamp: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      }),
    }),
  }),
  v.object({
    type: v.literal("email.clicked"),
    created_at: v.string(),
    data: v.object({
      ...vCommonEmailEventFields,
      click: v.object({
        ipAddress: v.optional(v.string()),
        link: v.optional(v.string()),
        timestamp: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      }),
    }),
  }),
  v.object({
    type: v.literal("email.failed"),
    created_at: v.string(),
    data: v.object({
      ...vCommonEmailEventFields,
      failed: v.object({
        reason: v.optional(v.string()),
      }),
    }),
  })
);

const vOnEmailEventArgs = v.object({
  id: v.string(),
  event: vEmailEvent,
});

export type ValidatedResendEmailEvent = Infer<typeof vEmailEvent>;

/**
 * Handle email delivery events from Resend.
 *
 * Replicates the ESIGN audit logging from the old `resend_webhooks.ts`:
 * looks up the notification by Resend message ID to find the associated
 * document/org context, then writes an audit log entry.
 */
const auditableEvents = [
  "email.delivered",
  "email.opened",
  "email.bounced",
] as const;

type AuditableEvent = (typeof auditableEvents)[number];

function isAuditableEvent(
  eventType: ValidatedResendEmailEvent["type"]
): eventType is AuditableEvent {
  return auditableEvents.some((event) => event === eventType);
}

export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    const eventType = args.event.type;

    // Only audit delivery-related events
    if (!isAuditableEvent(eventType)) {
      return;
    }

    const resendMessageId = args.event.data.email_id;
    if (!resendMessageId) return;

    const recipientEmail = Array.isArray(args.event.data.to)
      ? args.event.data.to[0]
      : args.event.data.to;

    // Look up the notification by Resend message ID (same as old webhook handler)
    const notification = await ctx.db
      .query("notifications")
      .withIndex("by_email_message_id", (q) =>
        q.eq("emailMessageId", resendMessageId)
      )
      .first();

    if (!notification) {
      console.warn(
        `[Resend Component] No notification found for message ${resendMessageId} (${eventType})`
      );
      return;
    }

    // Extract IDs from the notification data (schema union narrows via `in`)
    const documentId =
      "documentId" in notification.data
        ? notification.data.documentId
        : undefined;
    const recipientId =
      "recipientId" in notification.data
        ? notification.data.recipientId
        : undefined;

    // Extract bounce info if applicable
    const bounceType =
      args.event.type === "email.bounced"
        ? args.event.data.bounce.type
        : undefined;

    await logAction(ctx, {
      organizationId: notification.organizationId,
      actorType: "system",
      action: eventType,
      resourceType: "email",
      resourceId: resendMessageId,
      documentId,
      recipientId,
      newValues: bounceType ? { bounceType } : undefined,
      metadata: {
        description: `Email ${eventType.split(".")[1]} to ${recipientEmail ?? "unknown"}`,
        source: "resend_component",
      },
      ipAddress: "webhook",
    });
  },
});

/**
 * Record that an email was queued through the direct Resend transport, with the
 * Resend message id and the recipient. Mirrors the audit shape produced by
 * `handleEmailEvent` for delivery events, so prod operators can trace an
 * email from "queued" through "delivered" / "opened" / "bounced" entirely
 * via the audit log. Called from action-side senders that can't write the
 * row directly.
 */
export const logEmailQueued = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    messageId: v.string(),
    to: v.string(),
    subject: v.string(),
    documentId: v.optional(v.id("documents")),
    recipientId: v.optional(v.id("document_recipients")),
  },
  handler: async (ctx, args) => {
    await logAction(ctx, {
      organizationId: args.organizationId,
      actorType: "system",
      actorId: "resend_component",
      action: "email.queued",
      resourceType: "email",
      resourceId: args.messageId,
      documentId: args.documentId,
      recipientId: args.recipientId,
      newValues: { to: args.to, subject: args.subject },
      metadata: {
        description: `Email queued to ${args.to}: ${args.subject}`,
        source: "resend_component",
      },
      ipAddress: "system",
    });
  },
});

/**
 * Clean up old email records from the direct Resend transport.
 * Scheduled via cron to run hourly.
 */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupResendEmails = internalMutation({
  args: {},
  handler: async () => {
    // Direct Resend sends do not create local component rows, so there is
    // nothing to clean up. Keep the mutation for cron compatibility.
    return { skipped: true, olderThan: ONE_WEEK_MS };
  },
});
