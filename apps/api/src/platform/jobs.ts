/**
 * Async job runner — ADR-006 + the Smallpdf-parity long-op substrate.
 *
 * D1 is the source of truth (`jobs` table); the `JobRunner` Durable Object
 * is only the scheduler — per-org, alarm-driven, drains `queued` rows
 * sequentially. Executors live here so the DO stays a thin pump and every
 * executor is unit-testable without an alarm.
 */

import { and, eq, inArray } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { jobs } from "../global/schema.js";
import { generateReviewMatrix } from "./review-matrix-store.js";

type Db = ReturnType<typeof createD1>;

export type JobStatus = "queued" | "running" | "done" | "error";

export type JobRecord = typeof jobs.$inferSelect;

export type ApiJob = {
  id: string;
  type: string;
  status: JobStatus;
  error: string | null;
  result: unknown;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export class JobError extends Error {
  readonly code: string;
  readonly status: 400 | 404;

  constructor(code: string, status: 400 | 404) {
    super(code);
    this.name = "JobError";
    this.code = code;
    this.status = status;
  }
}

function newJobPublicId(): string {
  return `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function toApiJob(row: JobRecord): ApiJob {
  let result: unknown = null;
  if (row.result) {
    try {
      result = JSON.parse(row.result);
    } catch {
      result = null;
    }
  }
  return {
    id: row.publicId,
    type: row.type,
    status: row.status as JobStatus,
    error: row.error,
    result,
    created_at: row.createdAt.toISOString(),
    started_at: row.startedAt?.toISOString() ?? null,
    finished_at: row.finishedAt?.toISOString() ?? null,
  };
}

/** Registered job types. Dispatch is explicit — no free-form payloads run. */
const JOB_TYPES = new Set(["review-generate"]);

export async function createJob(
  db: Db,
  args: {
    organizationId: string;
    type: string;
    payload?: Record<string, unknown>;
  }
): Promise<JobRecord> {
  if (!JOB_TYPES.has(args.type)) {
    throw new JobError("unknown_job_type", 400);
  }
  const now = new Date();
  const rows = await db
    .insert(jobs)
    .values({
      id: crypto.randomUUID(),
      publicId: newJobPublicId(),
      organizationId: args.organizationId,
      type: args.type,
      status: "queued",
      payload: JSON.stringify(args.payload ?? {}),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new JobError("job_insert_failed", 400);
  return row;
}

export async function getJob(
  db: Db,
  organizationId: string,
  publicId: string
): Promise<JobRecord> {
  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.publicId, publicId), eq(jobs.organizationId, organizationId))
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new JobError("not_found", 404);
  return row;
}

const MAX_ATTEMPTS = 3;

/**
 * Execute one job by id. Dispatch is explicit — unknown types fail the row.
 * Exported so both the DO alarm tick and tests can drive it.
 */
export async function runJob(
  env: CloudflareBindings,
  db: Db,
  jobId: string
): Promise<void> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job || job.status !== "running") return;

  let result: unknown = null;
  let error: string | null = null;

  try {
    const payload = JSON.parse(job.payload) as Record<string, unknown>;
    if (job.type === "review-generate") {
      const matrixId = payload.matrixId;
      if (typeof matrixId !== "string" || !matrixId) {
        throw new JobError("invalid_payload", 400);
      }
      result = await generateReviewMatrix(
        db,
        env,
        job.organizationId,
        matrixId
      );
    } else {
      throw new JobError("unknown_job_type", 400);
    }
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 500) : "job_failed";
  }

  const attempts = job.attempts + 1;
  if (error === null) {
    await db
      .update(jobs)
      .set({
        status: "done",
        result: JSON.stringify(result),
        error: null,
        attempts,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    return;
  }

  // Transient failure → back to queued until attempts run out.
  const exhausted = attempts >= MAX_ATTEMPTS;
  await db
    .update(jobs)
    .set({
      status: exhausted ? "error" : "queued",
      error,
      attempts,
      ...(exhausted ? { finishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}

/**
 * Drain queued jobs for one org — claims rows then runs them in order.
 * Returns ids of jobs that finished (done or permanently errored).
 */
export async function drainJobs(
  env: CloudflareBindings,
  organizationId: string,
  limit = 10
): Promise<string[]> {
  const db = createD1(env.D1);
  const finished: string[] = [];

  for (let i = 0; i < limit; i++) {
    // Claim the oldest queued row — CAS so two alarms can't double-run.
    const queued = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(eq(jobs.organizationId, organizationId), eq(jobs.status, "queued"))
      )
      .orderBy(jobs.createdAt)
      .limit(1);
    const next = queued[0];
    if (!next) break;

    const claimed = await db
      .update(jobs)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobs.id, next.id), eq(jobs.status, "queued")))
      .returning({ id: jobs.id });
    if (claimed.length === 0) continue; // raced — another runner took it

    await runJob(env, db, next.id);
    finished.push(next.id);
  }

  return finished;
}

/**
 * Poke the org's JobRunner DO to drain. Best-effort — if the binding is
 * absent (self-host/test), jobs stay queued until a manual drain.
 */
export async function wakeJobRunner(
  env: CloudflareBindings,
  organizationId: string
): Promise<void> {
  if (!env.JOB_RUNNER) return;
  try {
    const id = env.JOB_RUNNER.idFromName(organizationId);
    await env.JOB_RUNNER.get(id).fetch("http://internal/wake", {
      method: "POST",
    });
  } catch {
    // Wake failed — the job row is durable; the next wake or a manual
    // drain will pick it up.
  }
}

/** Any queued/running work left for this org → alarm chains another tick. */
export async function hasPendingJobs(
  db: Db,
  organizationId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        inArray(jobs.status, ["queued", "running"])
      )
    )
    .limit(1);
  return rows.length > 0;
}
