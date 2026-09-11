import type { AnyAuthClient } from "@vortexnyc/better-auth-ui";

import { betterAuthClient } from "./better-auth";

export function getBetterAuthUiClient(): AnyAuthClient | null {
  if (betterAuthClient === null) {
    return null;
  }

  const c = betterAuthClient;

  return {
    useSession: () => c.useSession(),
    signOut: () => c.signOut(),
    signIn: {
      email: (args) => c.signIn.email(args),
      ...(c.signIn.social !== undefined
        ? { social: (args) => c.signIn.social(args) }
        : {}),
    },
    signUp: {
      email: (args) => c.signUp.email(args),
    },
    forgetPassword: (args) =>
      c.requestPasswordReset
        ? c.requestPasswordReset(args)
        : Promise.reject("Password recovery not available."),
    ...(c.resetPassword !== undefined
      ? { resetPassword: (args) => c.resetPassword(args) }
      : {}),
    ...(c.sendVerificationEmail !== undefined
      ? { sendVerificationEmail: (args) => c.sendVerificationEmail(args) }
      : {}),
    ...(c.verifyEmail !== undefined
      ? { verifyEmail: (args) => c.verifyEmail(args) }
      : {}),
  };
}
