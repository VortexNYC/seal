import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SealApiClient } from "./client";
import { getConfig } from "./config";
import { verifyAccessToken } from "./oauth/crypto";
import { oauthRoutes } from "./oauth/routes";
import { registerAllResources } from "./resources";
import { registerAllTools } from "./tools";
import { logger as sealLogger } from "./utils/logger";

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
// OAuth Discovery Endpoints (RFC 9728 & RFC 8414)
// Point to our own OAuth server (which proxies to Clerk for authentication)
// ============================================================================

/**
 * Protected Resource Metadata (RFC 9728)
 * Tells MCP clients where to authenticate
 */
app.get("/.well-known/oauth-protected-resource", (c) => {
	const baseUrl = getBaseUrl(c.req.url);

	return c.json({
		resource: `${baseUrl}/mcp`,
		authorization_servers: [baseUrl],
		scopes_supported: ["profile", "email"],
		bearer_methods_supported: ["header"],
		resource_documentation: "https://docs.seal.app/api/mcp",
	});
});

/**
 * Authorization Server Metadata (RFC 8414)
 * Points to our own OAuth endpoints
 */
app.get("/.well-known/oauth-authorization-server", (c) => {
	const baseUrl = getBaseUrl(c.req.url);

	return c.json({
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/oauth/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,
		registration_endpoint: `${baseUrl}/oauth/register`,
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		scopes_supported: ["profile", "email"],
		response_types_supported: ["code"],
		response_modes_supported: ["query"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none",
		],
		code_challenge_methods_supported: ["S256", "plain"],
	});
});

// Mount OAuth routes
app.route("/oauth", oauthRoutes);

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
 *
 * Authentication: Validates our own JWT access tokens issued by /oauth/token
 */
app.all("/mcp", async (c) => {
	// Development mode: skip auth if SKIP_AUTH=true
	let userId = "dev-user";
	let sessionId = "dev-session";
	let scopes: string[] = ["profile", "email"];
	let clientId = "dev-client";

	if (!skipAuth) {
		// Get bearer token from Authorization header
		const authHeader = c.req.header("Authorization");
		const token = getBearerToken(authHeader);

		if (!token) {
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

		// Verify our JWT access token
		const payload = await verifyAccessToken(token);

		if (!payload) {
			return c.json(
				{
					type: "UNAUTHORIZED",
					status: 401,
					title: "Invalid or expired access token",
				},
				401,
				{
					"WWW-Authenticate": `Bearer resource_metadata="${getBaseUrl(c.req.url)}/.well-known/oauth-protected-resource", error="invalid_token"`,
				},
			);
		}

		userId = payload.sub;
		clientId = payload.client_id;
		scopes = payload.scope.split(" ").filter(Boolean);
		sessionId = `${clientId}-${Date.now()}`;
	} else {
		sealLogger.debug("Auth bypassed (SKIP_AUTH=true)");
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
		? {
				token: bearerToken,
				clientId,
				scopes,
				extra: { sessionId, userId },
			}
		: undefined;

	return transport.handleRequest(c.req.raw, { authInfo });
});

// ============================================================================
// Root & Health Check
// ============================================================================

app.get("/", (c) => {
	return c.json({
		name: "Seal MCP Server",
		version: "0.0.1",
		description: "Model Context Protocol server for Seal document management",
		endpoints: {
			mcp: "/mcp",
			health: "/health",
			oauth_protected_resource: "/.well-known/oauth-protected-resource",
			oauth_authorization_server: "/.well-known/oauth-authorization-server",
		},
		documentation: "https://docs.seal.app/api/mcp",
	});
});

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

// ============================================================================
// Exports
// ============================================================================

// Named export for Vercel and imports
export { app };

// Default export for Vercel edge runtime
export default app;

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
		sealLogger.info("Starting in stdio mode...");
		const transport = new StdioServerTransport();
		await mcpServer.connect(transport);
		sealLogger.info("MCP server connected via stdio");
		return;
	}

	// HTTP mode (default for development)
	const port = Number.parseInt(process.env.PORT || "5183", 10);
	sealLogger.info(`Starting HTTP server on port ${port}...`);
	sealLogger.info(`MCP endpoint: http://localhost:${port}/mcp`);
	sealLogger.info(`Health check: http://localhost:${port}/health`);
	if (skipAuth) {
		sealLogger.warn("Auth bypass enabled (SKIP_AUTH=true)");
	}

	// Use Bun's native server
	Bun.serve({
		port,
		fetch: app.fetch,
	});
}

// Only start server when running directly (not imported via Vercel)
const isVercel = process.env.VERCEL === "1";
const isProduction = process.env.NODE_ENV === "production";

if (!isVercel && !isProduction) {
	startServer().catch((err: Error) => sealLogger.error(err.message));
}
