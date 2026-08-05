import { createBetterAuthConvexRuntime } from "@vortexnyc/auth/better-auth/convex";
import type { BetterAuthConvexRuntime } from "@vortexnyc/auth/better-auth/convex";
import {
  createEmailVerificationEmailDraft,
  createPasswordResetEmailDraft,
} from "@vortexnyc/auth/convex";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { betterAuthConvexProvider } from "./auth.config";
import { authComponent as consumerAuthComponent } from "./betterAuthClient";
import { sendAuthEmailDraft } from "./emails/resend_component";

/** Auth-email from-address (same source as Seal's transactional senders). */
function authEmailFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";
}

const betterAuthRuntime: BetterAuthConvexRuntime<DataModel> =
  createBetterAuthConvexRuntime<DataModel>({
    components: {
      betterAuth: components.betterAuth,
    },
    authComponent: consumerAuthComponent,
    authProvider: betterAuthConvexProvider,
    refs: {
      upsertUserFromBetterAuth: internal.users.upsertFromBetterAuth,
      provisionIdentityFromIdentity:
        components.vortexAuth.identity.provisionFromIdentity,
      // rateLimitAuthRequest intentionally omitted for P0 (pile pattern) —
      // the runtime's built-in rateLimit below still applies.
    },
    twoFactor: {
      enabled: true,
      issuer: "Seal",
    },
    // Send a verification email on sign-up; don't HARD-block sign-in on it
    // yet (tighten `required` at P8 once the cutover flow is exercised).
    emailVerification: {
      sendOnSignUp: true,
      required: false,
    },
    // Transport seam: the package owns POLICY (when/what kind + the tokenized
    // url); Seal owns RENDER + SEND. Render with the package's shipped draft
    // builders (no hand-rolled HTML — pile's lesson) and send via the same
    // direct Resend transport the rest of Seal's mail uses.
    sendEmail: async ({ ctx, kind, to, url }) => {
      const from = authEmailFromAddress();
      const draft =
        kind === "verify-email"
          ? await createEmailVerificationEmailDraft({
              from,
              to,
              verifyUrl: url,
            })
          : await createPasswordResetEmailDraft({ from, to, resetUrl: url });
      if ("status" in draft) {
        // not_configured (missing from/url) — log loudly, don't silently drop.
        console.error(
          `[auth-email] ${kind} not sent to ${to}: ${draft.reason}`
        );
        return;
      }
      // Better Auth invokes sendEmail inside a mutation-capable handler ctx;
      // the seam types it as the broad GenericCtx, so narrow to the sender's
      // expected ctx (which needs runMutation).
      const sendCtx = ctx as unknown as Parameters<
        typeof sendAuthEmailDraft
      >[0];
      await sendAuthEmailDraft(sendCtx, draft);
    },
    // Captcha is a PROVEN opt-in capability (Cloudflare Turnstile,
    // sign-up/reset scoped). Kept DISABLED on the shared dev deployment
    // because it requires every caller to present an x-captcha-response
    // token, which would break the headless proof suite. Production opts
    // in with a real secretKey.
    captcha: {
      enabled: false,
      secretKey: "1x0000000000000000000000000000000AA",
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    trustedOrigins: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      // Any localhost port (Vite dev assigns a dynamic port under portless).
      "http://localhost:*",
      "http://127.0.0.1:*",
      // portless dev origin used by the test protocol.
      "http://seal.localhost:1355",
      // Staging + production web app origins.
      "https://app.seal.nyc",
      "https://staging.seal.nyc",
    ],
  });

export const authComponent = betterAuthRuntime.authComponent;
export const createAuth = betterAuthRuntime.createAuth;
export const registerAuthRoutes = betterAuthRuntime.registerRoutes;
export const resolveTrustedOrigins = betterAuthRuntime.resolveTrustedOrigins;
