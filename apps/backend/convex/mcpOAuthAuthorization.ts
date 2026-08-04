import { canUserUseScope, type ApiScope } from "./api/context";

export type McpOAuthScopeAuthorizationError = {
  error: "invalid_scope";
  error_description: string;
};

export function validateRequestedOAuthScopes(args: {
  permissions: readonly string[];
  requestedScopes: readonly ApiScope[];
}): McpOAuthScopeAuthorizationError | null {
  const deniedScope = args.requestedScopes.find(
    (scope) => !canUserUseScope([...args.permissions], scope)
  );
  if (deniedScope === undefined) {
    return null;
  }

  return {
    error: "invalid_scope",
    error_description: `Scope not allowed for current user: ${deniedScope}`,
  };
}
