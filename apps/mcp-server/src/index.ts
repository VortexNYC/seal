import { verifyToken } from "@clerk/backend";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SealApiClient } from "./client";
import { getConfig } from "./config";
import { registerAllResources } from "./resources";
import { registerAllTools } from "./tools";

// Types
type Variables = {
	mcpServer: McpServer;
	apiClient: SealApiClient;
};

const app = new Hono<{ Variables: Variables }>();

// Get configuration
const config = getConfig();

// Create reusable MCP server instance
const mcpServer = new McpServer({
	name: "seal-mcp-server",
	version: "0.0.1",
});

// Create API client
const apiClient = new SealApiClient(config);

// Register tools and resources
registerAllTools(mcpServer, apiClient);
registerAllResources(mcpServer, apiClient);

// Middleware
app.use("*", logger());

// CORS for OAuth metadata endpoints
app.use(
	"/.well-known/*",
	cors({
		origin: "*",
		allowMethods: ["GET", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);

// CORS for MCP endpoint
app.use(
	"/mcp",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
		exposeHeaders: ["Mcp-Session-Id"],
	}),
);

// Store server and client in context
app.use("*", async (c, next) => {
	c.set("mcpServer", mcpServer);
	c.set("apiClient", apiClient);
	await next();
});

// ============================================================================
// OAuth Discovery Endpoints (RFC 9728)
// ============================================================================

/**
 * Protected Resource Metadata (RFC 9728)
 * Tells MCP clients where to authenticate
 */
app.get("/.well-known/oauth-protected-resource", (c) => {
	const baseUrl = getBaseUrl(c.req.url);

	// Extract Clerk frontend API URL from publishable key
	const publishableKey =
		process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
	let authServerUrl = "https://clerk.com";

	if (publishableKey) {
		// Publishable key format: pk_test_xxx or pk_live_xxx
		// The base64 part after pk_test_ or pk_live_ contains the frontend API domain
		const keyPart = publishableKey
			.replace("pk_test_", "")
			.replace("pk_live_", "");
		try {
			const decoded = atob(keyPart);
			if (decoded.includes(".clerk.accounts.dev")) {
				authServerUrl = `https://${decoded}`;
			}
		} catch {
			// If decoding fails, use default
		}
	}

	return c.json({
		resource: `${baseUrl}/mcp`,
		authorization_servers: [authServerUrl],
		scopes_supported: ["profile", "email", "openid"],
		bearer_methods_supported: ["header"],
		resource_documentation: "https://docs.seal.app/api/mcp",
	});
});

/**
 * Authorization Server Metadata (RFC 8414)
 * Provides OAuth endpoints for clients
 */
app.get("/.well-known/oauth-authorization-server", async (c) => {
	const publishableKey =
		process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

	if (!publishableKey) {
		return c.json({ error: "Clerk not configured" }, 500);
	}

	// Extract Clerk frontend API from publishable key
	const keyPart = publishableKey
		.replace("pk_test_", "")
		.replace("pk_live_", "");
	let clerkFrontendApi = "";

	try {
		clerkFrontendApi = atob(keyPart);
	} catch {
		return c.json({ error: "Invalid Clerk publishable key" }, 500);
	}

	const issuer = `https://${clerkFrontendApi}`;

	return c.json({
		issuer,
		authorization_endpoint: `${issuer}/oauth/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		userinfo_endpoint: `${issuer}/oauth/userinfo`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,
		scopes_supported: ["openid", "profile", "email"],
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
		],
		code_challenge_methods_supported: ["S256"],
		// Dynamic client registration (RFC 7591)
		registration_endpoint: `${issuer}/oauth/register`,
	});
});

// ============================================================================
// MCP Endpoint
// ============================================================================

// Session storage for stateful connections
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

// Development auth bypass flag
const skipAuth =
	process.env.NODE_ENV !== "production" && process.env.SKIP_AUTH === "true";

/**
 * MCP endpoint - handles all MCP protocol messages (POST, GET, DELETE)
 * The WebStandardStreamableHTTPServerTransport handles all HTTP methods internally.
 */
app.all("/mcp", clerkMiddleware(), async (c) => {
	// Development mode: skip auth if SKIP_AUTH=true
	let userId = "dev-user";
	let sessionId = "dev-session";

	if (!skipAuth) {
		// Verify authentication in production
		const auth = getAuth(c);

		if (!auth?.userId) {
			return c.json(
				{
					type: "UNAUTHORIZED",
					status: 401,
					title: "Authentication required",
				},
				401,
				{
					"WWW-Authenticate": `Bearer resource_metadata="${getBaseUrl(c.req.url)}/.well-known/oauth-protected-resource"`,
				},
			);
		}

		userId = auth.userId;
		sessionId = auth.sessionId || "";
	} else {
		console.log("[Seal MCP] Auth bypassed (SKIP_AUTH=true)");
	}

	// Get or create session
	const mcpSessionId = c.req.header("Mcp-Session-Id");
	let transport: WebStandardStreamableHTTPServerTransport;

	const existingTransport = mcpSessionId
		? sessions.get(mcpSessionId)
		: undefined;
	if (existingTransport) {
		transport = existingTransport;
	} else {
		// Create new transport for this session
		transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
			onsessioninitialized: (newSessionId) => {
				sessions.set(newSessionId, transport);
			},
			onsessionclosed: (closedSessionId) => {
				sessions.delete(closedSessionId);
			},
		});

		// Connect to MCP server
		await mcpServer.connect(transport);
	}

	// Handle the request using the web standard transport
	// It handles GET (SSE), POST (messages), and DELETE (close session)
	const bearerToken = getBearerToken(c.req.header("Authorization"));
	const authInfo = bearerToken
		? await buildAuthInfo(bearerToken, userId, sessionId)
		: undefined;

	return transport.handleRequest(c.req.raw, { authInfo });
});

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", (c) => {
	return c.json({
		status: "ok",
		name: "seal-mcp-server",
		version: "0.0.1",
	});
});

// ============================================================================
// Helpers
// ============================================================================

function getBaseUrl(requestUrl: string): string {
	const url = new URL(requestUrl);
	return `${url.protocol}//${url.host}`;
}

function getBearerToken(
	authHeader: string | null | undefined,
): string | undefined {
	if (!authHeader) {
		return undefined;
	}

	const [scheme, token] = authHeader.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return undefined;
	}

	const trimmed = token.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

type TokenInfo = {
	scopes: string[];
	expiresAt?: number;
};

function extractScopesFromPayload(payload: Record<string, unknown>): string[] {
	const scope = payload.scope;
	if (typeof scope === "string") {
		return scope.split(" ").filter(Boolean);
	}

	const scp = payload.scp;
	if (Array.isArray(scp) && scp.every((value) => typeof value === "string")) {
		return scp;
	}

	return [];
}

async function resolveTokenInfo(token: string): Promise<TokenInfo | null> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	const jwtKey = process.env.CLERK_JWT_KEY;
	if (!secretKey && !jwtKey) {
		return null;
	}

	const verification = (await verifyToken(token, {
		secretKey,
		jwtKey,
	})) as { data?: Record<string, unknown> };

	if (!verification.data) {
		return null;
	}

	const payload = verification.data;
	const scopes = extractScopesFromPayload(payload);
	const expiresAt = typeof payload.exp === "number" ? payload.exp : undefined;

	return { scopes, expiresAt };
}

async function buildAuthInfo(
	token: string,
	userId: string,
	sessionId: string,
): Promise<{
	token: string;
	clientId: string;
	scopes: string[];
	expiresAt?: number;
	extra: { sessionId: string };
}> {
	const tokenInfo = await resolveTokenInfo(token);
	const scopes = tokenInfo?.scopes.length
		? tokenInfo.scopes
		: ["openid", "profile", "email"];

	return {
		token,
		clientId: userId,
		scopes,
		expiresAt: tokenInfo?.expiresAt,
		extra: { sessionId },
	};
}

// ============================================================================
// Exports
// ============================================================================

// Default export - used by api/index.ts for Vercel
// Don't export in development to prevent Bun's automatic dev server
export default process.env.NODE_ENV === "production" ? app : undefined;

// ============================================================================
// Local Development Server
// ============================================================================

async function startServer() {
	// Check if we should run in stdio mode (for MCP clients)
	const isStdioMode =
		process.argv.includes("--stdio") ||
		(process.stdin.isTTY === false && process.stdout.isTTY === false) ||
		process.env.MCP_TRANSPORT === "stdio";

	if (isStdioMode) {
		console.error(`[Seal MCP] Starting in stdio mode...`);
		const transport = new StdioServerTransport();
		await mcpServer.connect(transport);
		console.error(`[Seal MCP] MCP server connected via stdio`);
		return;
	}

	// HTTP mode (default for development)
	const port = Number.parseInt(process.env.PORT || "5183", 10);
	console.log(`[Seal MCP] Starting HTTP server on port ${port}...`);
	console.log(`[Seal MCP] MCP endpoint: http://localhost:${port}/mcp`);
	console.log(`[Seal MCP] Health check: http://localhost:${port}/health`);
	if (skipAuth) {
		console.log(`[Seal MCP] ⚠️  Auth bypass enabled (SKIP_AUTH=true)`);
	}

	// Use Bun's native server
	Bun.serve({
		port,
		fetch: app.fetch,
	});
}

// Only start server when running directly (not imported)
if (process.env.NODE_ENV !== "production") {
	startServer().catch(console.error);
}
