/**
 * Worker email transport adapter.
 *
 * Auth and dunning email is sent through the Cloudflare Worker
 * (apps/api) using its send_email binding. This module keeps the same
 * call-site contract so consumers (betterAuth, invitations, dunning) do
 * not change.
 */

import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";

import type { ActionCtx } from "../_generated/server";

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

export type WorkerEmailPayload = SendEmailOptions;

export type WorkerEmailResult = {
  data: { id: string } | null;
  error: { message?: string; name?: string; statusCode?: number | null } | null;
};

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

export async function sendWorkerEmail(
  options: WorkerEmailPayload
): Promise<WorkerEmailResult> {
  const workerUrl = process.env.SIGN_API_EMAIL_URL;
  const workerKey = process.env.SIGN_API_EMAIL_KEY;
  if (!workerUrl || !workerKey) {
    throw new Error("SIGN_API_EMAIL_URL and SIGN_API_EMAIL_KEY must be set");
  }

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

/**
 * Auth draft payload from `@vortexnyc/auth/convex` draft builders.
 */
export type AuthEmailDraft = {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
};

/**
 * Send a Core auth email draft through the Worker.
 */
export async function sendAuthEmailDraft(
  _ctx: Pick<ActionCtx, "runMutation">,
  draft: AuthEmailDraft,
  extra?: {
    readonly replyTo?: string | string[];
    readonly headers?: EmailHeader[] | Record<string, string>;
  }
): Promise<string> {
  return await sendEmailFromAction(_ctx, {
    from: draft.from,
    to: draft.to,
    subject: draft.subject,
    html: draft.html,
    text: draft.text,
    ...(extra?.replyTo !== undefined ? { replyTo: extra.replyTo } : {}),
    ...(extra?.headers !== undefined ? { headers: extra.headers } : {}),
  });
}

export async function sendEmailFromAction(
  _ctx: Pick<ActionCtx, "runMutation">,
  options: SendEmailOptions
): Promise<string> {
  const subject =
    "template" in options && options.subject === undefined
      ? `template:${options.template.id}`
      : sealAssertPresent(
          options.subject,
          "Expected email subject to be present."
        );

  return await sendEmailManuallyFromAction(
    _ctx,
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
      const { data, error } = await sendWorkerEmail({
        ...options,
        headers: {
          ...normalizeHeaders(options.headers),
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (error) throw new Error(error.message ?? "email send failed");
      return sealAssertPresent(data).id;
    }
  );
}

export async function sendEmailManuallyFromAction(
  _ctx: Pick<ActionCtx, "runMutation">,
  options: SendEmailManualOptions,
  sendCallback: (idempotencyKey: string) => Promise<string>
): Promise<string> {
  const idempotencyKey = crypto.randomUUID();
  try {
    return await sendCallback(idempotencyKey);
  } catch (error) {
    console.error("[email] failed to send", {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
