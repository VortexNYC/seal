/**
 * JobRunner — per-org Durable Object scheduler for async jobs.
 *
 * The D1 `jobs` table is the source of truth; this DO is only a pump.
 * `wake()` (called right after a job row is inserted) sets an alarm; the
 * alarm drains queued jobs for the org via `drainJobs`, and re-arms while
 * work remains. Sequential per org by design — fan-out is per-org DOs.
 */

import { DurableObject } from "cloudflare:workers";

import { createD1 } from "../global/db.js";
import { drainJobs, hasPendingJobs } from "./jobs.js";

const DRAIN_BATCH = 10;

export class JobRunner extends DurableObject<CloudflareBindings> {
  /**
   * POST /wake — schedule a drain. The DO name is the organizationId.
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/wake" && request.method === "POST") {
      await this.ctx.storage.setAlarm(Date.now());
      return new Response(null, { status: 202 });
    }
    return new Response("not found", { status: 404 });
  }

  override async alarm(): Promise<void> {
    const organizationId = this.ctx.id.name;
    if (!organizationId) return;

    try {
      await drainJobs(this.env, organizationId, DRAIN_BATCH);

      const db = createD1(this.env.D1);
      if (await hasPendingJobs(db, organizationId)) {
        // Re-arm — the batch drained but work remains (or a run was requeued).
        await this.ctx.storage.setAlarm(Date.now() + 500);
      }
    } catch {
      // Alarm threw — re-arm with backoff so a bad tick doesn't wedge the org.
      await this.ctx.storage.setAlarm(Date.now() + 5000);
    }
  }
}
