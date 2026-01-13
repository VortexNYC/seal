/**
 * Vercel Edge Runtime handler for Seal MCP Server
 *
 * This file exports the Hono app as a Vercel Edge Function.
 * All requests are handled by the Hono router defined in src/index.ts.
 */
import { app } from "../src/index";

export const config = {
	runtime: "edge",
};

export default app;
