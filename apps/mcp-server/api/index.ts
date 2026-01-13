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
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Hono } from "hono";

// @ts-expect-error - dist/index.js is built at deploy time, no type declarations
import { app as honoApp } from "../dist/index.js";

const app = honoApp as Hono;

export const config = {
	runtime: "nodejs",
	maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Convert Vercel request to web Request
	const url = new URL(req.url || "/", `https://${req.headers.host}`);
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value) {
			headers.set(key, Array.isArray(value) ? value.join(", ") : value);
		}
	}

	const request = new Request(url.toString(), {
		method: req.method,
		headers,
		body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
	});

	// Handle with Hono
	const response = await app.fetch(request);

	// Convert web Response to Vercel response
	res.status(response.status);
	response.headers.forEach((value: string, key: string) => {
		res.setHeader(key, value);
	});

	const body = await response.text();
	res.send(body);
}
