#!/usr/bin/env node
/**
 * Minimal webhook receiver sketch using @vortex-api/seal helpers.
 *
 *   WEBHOOK_SECRET=whsec_… node packages/sdk/examples/webhook-handler.mjs
 *
 * In production, use your framework's raw-body middleware and pass the exact
 * bytes Seal POSTed (see docs/webhooks/verification).
 */

import { createServer } from "node:http";

import {
  parseSealWebhookEnvelope,
  readSealWebhookHeaders,
  verifySealWebhookSignature,
} from "../dist/webhooks.js";

const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  console.error("WEBHOOK_SECRET is required");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/seal") {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const headers = readSealWebhookHeaders(req.headers);

  const ok = await verifySealWebhookSignature(
    raw,
    headers.signature,
    secret
  );
  if (!ok) {
    res.writeHead(401);
    res.end("invalid signature");
    return;
  }

  const event = parseSealWebhookEnvelope(raw);
  console.log("event", event.eventType, event.eventId, headers.deliveryId);

  res.writeHead(200);
  res.end("ok");
});

server.listen(3456, () => {
  console.log("listening on http://127.0.0.1:3456/webhooks/seal");
});
