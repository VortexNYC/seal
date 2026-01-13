/**
 * Vercel Node.js Runtime handler for Seal MCP Server
 *
 * This file exports the Hono app as a Vercel Serverless Function.
 * All requests are handled by the Hono router defined in src/index.ts.
 *
 * Note: Using Node.js runtime because MCP SDK requires Node.js APIs
 * (fs, path, crypto) that are not available in Edge runtime.
 */
import { handle } from "hono/vercel";
import { app } from "../src/index";

export const config = {
	runtime: "nodejs",
};

export default handle(app);
