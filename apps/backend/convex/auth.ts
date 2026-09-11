/**
 * Auth barrel — single entry for Convex handlers.
 *
 * Wrappers live in `auth/wrappers.ts` (RLS + unified permission context).
 * Context resolution lives in `auth/auth.permissions.ts` (glue identity +
 * ROLE_TEMPLATES catalog). Do not add a second wrapper stack here.
 */

import { ConvexError } from "convex/values";

export {
  getAuthContext,
  getAuthContextWithPermissions,
  type AuthContext,
  type AuthContextWithPermissions,
} from "./auth/auth.permissions";

export {
  adminAction,
  adminMutation,
  adminQuery,
  authAction,
  authMutation,
  authQuery,
  memberMutation,
  memberQuery,
  ownerMutation,
  ownerQuery,
  permissionAllMutation,
  permissionAllQuery,
  permissionAnyMutation,
  permissionAnyQuery,
  permissionMutation,
  permissionQuery,
} from "./auth/wrappers";

/**
 * Authentication error types (string codes for legacy callers / tests).
 */
export const AuthErrorType = {
  NO_IDENTITY: "NO_IDENTITY",
  NO_USER_RECORD: "NO_USER_RECORD",
  NO_MEMBER_RECORD: "NO_MEMBER_RECORD",
  NO_ORGANIZATION: "NO_ORGANIZATION",
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_PENDING: "ACCOUNT_PENDING",
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
  WRONG_ORGANIZATION: "WRONG_ORGANIZATION",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
} as const;

export class AuthError extends Error {
  type: keyof typeof AuthErrorType;
  metadata?: Record<string, unknown>;

  constructor(
    type: keyof typeof AuthErrorType,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AuthError";
    this.type = type;
    this.metadata = metadata;
  }
}

export function createAuthError(
  type: keyof typeof AuthErrorType,
  message?: string,
  metadata?: Record<string, unknown>
): AuthError {
  const defaultMessages: Record<keyof typeof AuthErrorType, string> = {
    NO_IDENTITY: "User identity not found",
    NO_USER_RECORD: "User record not found",
    NO_MEMBER_RECORD: "Member record not found",
    NO_ORGANIZATION: "Organization not found",
    NO_SUBSCRIPTION: "Subscription not found",
    INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
    INSUFFICIENT_ROLE: "Insufficient role level",
    ACCOUNT_INACTIVE: "Account is inactive",
    ACCOUNT_SUSPENDED: "Account is suspended",
    ACCOUNT_PENDING: "Account is pending approval",
    ACCOUNT_BLOCKED: "Account is blocked",
    WRONG_ORGANIZATION: "Cannot access resources from different organization",
    SUBSCRIPTION_EXPIRED: "Subscription has expired",
    SUBSCRIPTION_REQUIRED: "Active subscription required",
  };

  return new AuthError(type, message || defaultMessages[type], metadata);
}

/** Throw a ConvexError carrying the AuthError message (legacy helper). */
export function throwAuthError(
  type: keyof typeof AuthErrorType,
  message?: string,
  metadata?: Record<string, unknown>
): never {
  throw new ConvexError(createAuthError(type, message, metadata).message);
}
