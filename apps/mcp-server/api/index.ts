/**
 * Vercel Node.js Runtime handler for Seal MCP Server
 *
 * This file exports the Hono app as a Vercel Serverless Function.
 * All requests are handled by the Hono router defined in src/index.ts.
 *
 * Note: Using Node.js runtime because MCP SDK requires Node.js APIs
 * (fs, path, crypto) that are not available in Edge runtime.
 *
 * Note: Importing from dist/index.js (pre-built bundle) because Vercel's
 * bundler doesn't properly resolve TypeScript imports from src/.
 */
import { handle } from "hono/vercel";
import { app } from "../dist/index.js";

export const config = {
	runtime: "nodejs",
};

export default handle(app);
