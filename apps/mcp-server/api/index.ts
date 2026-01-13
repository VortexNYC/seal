/**
 * Vercel Node.js Runtime handler for Seal MCP Server
 *
 * This file exports the Express app as a Vercel Serverless Function.
 * All requests are handled by the Express router defined in src/index.ts.
 *
 * Note: Using Node.js runtime because MCP SDK requires Node.js APIs
 * (fs, path, crypto) that are not available in Edge runtime.
 *
 * Note: Importing from dist/index.js (pre-built bundle) because Vercel's
 * bundler doesn't properly resolve TypeScript imports from src/.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";

// @ts-expect-error - dist/index.js is built at deploy time, no type declarations
import { app as expressApp } from "../dist/index.js";

const app = expressApp as Express;

export const config = {
	runtime: "nodejs",
	maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Express app can be used directly as a request handler
	// This works because Express apps are compatible with the (req, res) signature
	return app(
		req as unknown as Parameters<Express>[0],
		res as unknown as Parameters<Express>[1],
	);
}
