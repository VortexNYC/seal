/**
 * MCP OAuth authorization-server protocol config + metadata builders for Seal.
 *
 * ADDITIVE: this stands up the Better-Auth-backed MCP OAuth server in parallel
 * with the existing Clerk MCP/JWT path in `api/context.ts`. Mirrors crm's
 * `convex/mcpOAuth.ts`, adapted to Seal's API scopes + resource identifiers.
 */
import {
  buildAuthorizationServerMetadata as buildMetadata,
  buildEmptyJwks,
  buildMcpOAuthIssuer as buildIssuer,
  buildMcpOAuthPaths,
  buildProtectedResourceMetadata as buildResourceMetadata,
  createMcpOAuthProtocolConfig,
  createPkcePair,
  derivePkceChallenge,
  resolveRequestOrigin,
  type McpOAuthClient,
  type OAuthAuthorizationServerMetadata,
  type OAuthProtectedResourceMetadata,
  type PkcePair,
} from "@plasmapos/vortex-auth/mcp";

import {
  API_SCOPES,
  type ApiScope,
  MCP_OAUTH_AUDIENCE,
  MCP_OAUTH_RESOURCE_ID,
} from "./api/context";

// Audience + resource id live in api/context (the leaf the MCP modules already
// depend on); re-exported here so existing importers of "./mcpOAuth" are
// unaffected and there is a single source of truth with no import cycle.
export { MCP_OAUTH_AUDIENCE, MCP_OAUTH_RESOURCE_ID };

export const MCP_OAUTH_RESOURCE_SLUG = "seal-mcp";

// Read-mostly MCP allow-list. Keep it small; broaden later as Seal MCP tools land.
export const MCP_OAUTH_ALLOWED_SCOPES = [
  API_SCOPES.DOCUMENTS_READ,
  API_SCOPES.TEMPLATES_READ,
  API_SCOPES.MEMBERS_READ,
  API_SCOPES.CONTACTS_READ,
  API_SCOPES.AUDIT_READ,
] as const satisfies readonly ApiScope[];

const MCP_OAUTH_PROTOCOL_CONFIG = createMcpOAuthProtocolConfig({
  resourceSlug: MCP_OAUTH_RESOURCE_SLUG,
  resourceId: MCP_OAUTH_RESOURCE_ID,
  audience: MCP_OAUTH_AUDIENCE,
  scopesSupported: MCP_OAUTH_ALLOWED_SCOPES,
});

const MCP_OAUTH_PATHS = buildMcpOAuthPaths(MCP_OAUTH_PROTOCOL_CONFIG);

export const MCP_OAUTH_MCP_PATH = MCP_OAUTH_PATHS.mcpPath;
export const MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH =
  MCP_OAUTH_PATHS.authorizationServerMetadataPath;
export const MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH =
  MCP_OAUTH_PATHS.protectedResourceMetadataPath;
export const MCP_OAUTH_JWKS_PATH = MCP_OAUTH_PATHS.jwksPath;
export const MCP_OAUTH_AUTHORIZE_PATH = MCP_OAUTH_PATHS.authorizePath;
export const MCP_OAUTH_TOKEN_PATH = MCP_OAUTH_PATHS.tokenPath;
export const MCP_OAUTH_REGISTRATION_PATH = MCP_OAUTH_PATHS.registrationPath;
export const MCP_OAUTH_ISSUER_PATH = MCP_OAUTH_PATHS.issuerPath;

export const MCP_OAUTH_CODE_CHALLENGE_METHODS =
  MCP_OAUTH_PROTOCOL_CONFIG.codeChallengeMethodsSupported;
export const MCP_OAUTH_GRANT_TYPES = MCP_OAUTH_PROTOCOL_CONFIG.grantTypesSupported;
export const MCP_OAUTH_RESPONSE_TYPES = MCP_OAUTH_PROTOCOL_CONFIG.responseTypesSupported;
export const MCP_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS =
  MCP_OAUTH_PROTOCOL_CONFIG.tokenEndpointAuthMethodsSupported;

export type McpOAuthClientFixture = McpOAuthClient & {
  allowedScopes: readonly ApiScope[];
  pkceRequired: true;
};

export const MCP_OAUTH_DEFAULT_CLIENT: McpOAuthClientFixture = {
  clientId: "seal-mcp-dev-client",
  name: "Seal MCP Dev Client",
  redirectUris: ["http://127.0.0.1:8788/callback"],
  allowedScopes: MCP_OAUTH_ALLOWED_SCOPES,
  pkceRequired: true,
};

export const MCP_OAUTH_SECONDARY_CLIENT: McpOAuthClientFixture = {
  clientId: "seal-mcp-desktop-client",
  name: "Seal MCP Desktop Client",
  redirectUris: ["http://127.0.0.1:8799/callback"],
  allowedScopes: MCP_OAUTH_ALLOWED_SCOPES,
  pkceRequired: true,
};

export const MCP_OAUTH_CLIENTS = [
  MCP_OAUTH_DEFAULT_CLIENT,
  MCP_OAUTH_SECONDARY_CLIENT,
] as const satisfies readonly McpOAuthClientFixture[];

export function getMcpOAuthClient(clientId: string): McpOAuthClientFixture | null {
  return MCP_OAUTH_CLIENTS.find((client) => client.clientId === clientId) ?? null;
}

export { buildEmptyJwks, createPkcePair, derivePkceChallenge };
export type { OAuthAuthorizationServerMetadata, OAuthProtectedResourceMetadata, PkcePair };

export function buildMcpOAuthIssuer(origin: string): string {
  return buildIssuer(origin, MCP_OAUTH_PROTOCOL_CONFIG);
}

export function resolveMcpOAuthOrigin(request: Request): string {
  return resolveRequestOrigin(request);
}

export function buildAuthorizationServerMetadata(origin: string): OAuthAuthorizationServerMetadata {
  return buildMetadata(origin, MCP_OAUTH_PROTOCOL_CONFIG);
}

export function buildProtectedResourceMetadata(origin: string): OAuthProtectedResourceMetadata {
  return buildResourceMetadata(origin, MCP_OAUTH_PROTOCOL_CONFIG);
}
