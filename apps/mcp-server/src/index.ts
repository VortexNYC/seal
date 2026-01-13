/**
 * Seal MCP Server - Express + Clerk
 *
 * MCP server for Seal document management using:
 * - Express for HTTP handling
 * - @clerk/express for authentication middleware
 * - @clerk/mcp-tools for MCP-specific OAuth helpers
 * - @modelcontextprotocol/sdk for MCP protocol
 */
import { clerkMiddleware } from "@clerk/express";
import {
	authServerMetadataHandlerClerk,
	mcpAuthClerk,
	protectedResourceHandlerClerk,
	streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import cors from "cors";
import express from "express";
import { SealApiClient } from "./client";
import { getConfig } from "./config";
import { registerAllResources } from "./resources";
import { registerAllTools } from "./tools";
import { logger as sealLogger } from "./utils/logger";

// Get configuration
const config = getConfig();

// Create MCP server instance
const mcpServer = new McpServer({
	name: "seal-mcp-server",
	version: "0.0.1",
});

// Create API client
const apiClient = new SealApiClient(config);

// Register tools and resources
registerAllTools(mcpServer, apiClient);
registerAllResources(mcpServer, apiClient);

// Create Express app
const app = express();

// CORS configuration - expose WWW-Authenticate header for OAuth
app.use(
	cors({
		origin: "*",
		exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
	}),
);

// Clerk middleware for authentication
app.use(clerkMiddleware());

// JSON body parsing
app.use(express.json());

// =============================================================================
// Health & Info Endpoints
// =============================================================================

app.get("/", (_req, res) => {
	res.json({
		name: "Seal MCP Server",
		version: "0.0.1",
		description: "Model Context Protocol server for Seal document management",
		endpoints: {
			mcp: "/mcp",
			health: "/health",
			oauth_protected_resource: "/.well-known/oauth-protected-resource/mcp",
			oauth_authorization_server: "/.well-known/oauth-authorization-server",
		},
		documentation: "https://docs.seal.app/api/mcp",
	});
});

app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		name: "seal-mcp-server",
		version: "0.0.1",
	});
});

// =============================================================================
// OAuth Discovery Endpoints (RFC 8414 & RFC 9728)
// =============================================================================

/**
 * Protected Resource Metadata (RFC 9728)
 * Tells MCP clients where to authenticate
 */
app.get(
	"/.well-known/oauth-protected-resource/mcp",
	protectedResourceHandlerClerk({ scopes_supported: ["email", "profile"] }),
);

/**
 * Authorization Server Metadata (RFC 8414)
 * Points to Clerk's OAuth endpoints
 */
app.get(
	"/.well-known/oauth-authorization-server",
	authServerMetadataHandlerClerk,
);

// =============================================================================
// MCP Endpoint
// =============================================================================

/**
 * MCP endpoint - handles all MCP protocol messages
 * Uses Clerk OAuth for authentication via mcpAuthClerk middleware
 */
app.post("/mcp", mcpAuthClerk, streamableHttpHandler(mcpServer));

// =============================================================================
// Exports
// =============================================================================

// Named export for Vercel and imports
export { app };

// Default export for Vercel
export default app;

// =============================================================================
// Local Development Server
// =============================================================================

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

	app.listen(port, () => {
		sealLogger.info(`Server listening on port ${port}`);
	});
}

// Only start server when running directly (not imported via Vercel)
const isVercel = process.env.VERCEL === "1";
const isProduction = process.env.NODE_ENV === "production";

if (!isVercel && !isProduction) {
	startServer().catch((err: Error) => sealLogger.error(err.message));
}
