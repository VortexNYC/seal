import { renderOwnershipTransferred } from "@seal/transactional";
import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { sendEmailManuallyFromAction, sendResendEmail } from "../emails/resend_component";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";
const SITE_URL = process.env.SITE_URL ?? "https://app.seal.so";

export const sendOwnershipTransferredEmail = internalAction({
  args: {
    documentId: v.id("documents"),
    newOwnerEmail: v.string(),
    newOwnerName: v.string(),
    documentName: v.string(),
  },
  handler: async (ctx, args) => {
    const documentUrl = `${SITE_URL}/documents/${args.documentId}`;
    const html = await renderOwnershipTransferred({
      newOwnerName: args.newOwnerName,
      documentName: args.documentName,
      documentUrl,
      transferredAt: Date.now(),
    });

    const subject = `You are now the owner of "${args.documentName}"`;

    await sendEmailManuallyFromAction(
      ctx,
      {
        from: FROM_EMAIL,
        to: [args.newOwnerEmail],
        subject,
      },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [args.newOwnerEmail],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );
  },
});
