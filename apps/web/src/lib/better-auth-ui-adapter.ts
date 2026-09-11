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
    forgetPassword: (args) => c.requestPasswordReset(args),
    resetPassword: (args) => c.resetPassword(args),
    sendVerificationEmail: (args) => c.sendVerificationEmail(args),
    verifyEmail: (args) => c.verifyEmail(args),
    updateUser: (args) => c.updateUser(args),
    changeEmail: (args) => c.changeEmail(args),
    changePassword: (args) => c.changePassword(args),
    deleteUser: (args) => c.deleteUser(args),
    listSessions: () => c.listSessions(),
    revokeSession: (args) => c.revokeSession(args),
    revokeOtherSessions: () => c.revokeOtherSessions(),
    listAccounts: () => c.listAccounts(),
    linkSocial: (args) => c.linkSocial(args),
    unlinkAccount: (args) => c.unlinkAccount(args),
    ...(c.twoFactor !== undefined
      ? {
          twoFactor: {
            enable: (args) => c.twoFactor.enable(args),
            verifyTotp: (args) => c.twoFactor.verifyTotp(args),
            verifyBackupCode: (args) => c.twoFactor.verifyBackupCode(args),
            disable: (args) => c.twoFactor.disable(args),
            generateBackupCodes: (args) =>
              c.twoFactor.generateBackupCodes(args),
          },
        }
      : {}),
  };
}
