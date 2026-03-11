import { renderOwnershipTransferred } from "@seal/transactional";
import { v } from "convex/values";
import { Resend } from "resend";

import { internalAction } from "../_generated/server";
import { resendComponent } from "../emails/resend_component";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";
const SITE_URL = process.env.SITE_URL ?? "https://app.seal.so";

function getResendSdk(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

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

    await resendComponent.sendEmailManually(
      ctx,
      {
        from: FROM_EMAIL,
        to: [args.newOwnerEmail],
        subject,
      },
      async (idempotencyKey: string) => {
        const resendSdk = getResendSdk();
        const { data, error } = await resendSdk.emails.send({
          from: FROM_EMAIL,
          to: [args.newOwnerEmail],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message);
        return data!.id;
      },
    );
  },
});
