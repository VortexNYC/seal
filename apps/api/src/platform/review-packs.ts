/**
 * Review packs — bundled review-matrix templates (legal arc phase 5).
 *
 * Builtin packs are code (Vortex-authored, versioned with the repo);
 * org-authored packs live in D1. `POST /reviews` with `pack_id` expands a
 * pack into matrix columns so a matrix spawns pre-questioned, not blank.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { reviewPacks } from "../global/schema.js";
import { ZReviewColumn, type ReviewColumn } from "./review-matrix.js";

type Db = ReturnType<typeof createD1>;

export const ZReviewPackCreate = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  model: z.string().max(120).optional(),
  columns: z.array(ZReviewColumn).min(1).max(32),
});
export type ReviewPackCreate = z.infer<typeof ZReviewPackCreate>;

export type ApiReviewPack = {
  id: string;
  title: string;
  description: string | null;
  model: string | null;
  columns: ReviewColumn[];
  builtin: boolean;
  created_at: string;
};

/** Vortex-authored packs — shipped with the build, no data migration. */
export const BUILTIN_PACKS: ApiReviewPack[] = [
  {
    id: "builtin/nda",
    title: "NDA review",
    description:
      "Standard non-disclosure review: term, definition scope, exclusions, return/destruction, governing law.",
    model: null,
    columns: [
      {
        index: 0,
        name: "Term & survival",
        prompt:
          "How long do confidentiality obligations survive after termination? Flag terms over 5 years or perpetual obligations.",
      },
      {
        index: 1,
        name: "Definition scope",
        prompt:
          "Is 'Confidential Information' defined narrowly (marked/written) or broadly (all disclosures)? Flag if too broad for the receiving party.",
      },
      {
        index: 2,
        name: "Standard exclusions",
        prompt:
          "Does it exclude public-domain information, independently developed work, and compelled disclosures? Flag missing carve-outs.",
      },
      {
        index: 3,
        name: "Governing law & venue",
        prompt:
          "What governing law and venue applies? Flag unfavorable or unusual forums.",
      },
    ],
    builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin/msa",
    title: "MSA review",
    description:
      "Master services agreement: liability caps, indemnities, IP, termination.",
    model: null,
    columns: [
      {
        index: 0,
        name: "Liability cap",
        prompt:
          "What is the aggregate liability cap and what does it exclude? Flag uncapped liability or one-sided caps.",
      },
      {
        index: 1,
        name: "Indemnities",
        prompt:
          "List each indemnity obligation, who indemnifies whom, and for what. Flag broad third-party-claim indemnities.",
      },
      {
        index: 2,
        name: "IP ownership",
        prompt:
          "Who owns deliverables and pre-existing IP? Flag assignment language that captures background IP.",
      },
      {
        index: 3,
        name: "Termination",
        prompt:
          "What are the termination-for-convenience and termination-for-cause rights and notice periods?",
      },
    ],
    builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin/employment",
    title: "Employment agreement review",
    description:
      "Employment/contractor: compensation, IP assignment, non-compete/non-solicit, termination & severance.",
    model: null,
    columns: [
      {
        index: 0,
        name: "Compensation",
        prompt:
          "Summarize base comp, bonus terms, equity, and any clawbacks. Flag discretion-to-deny-bonus clauses.",
      },
      {
        index: 1,
        name: "IP & inventions",
        prompt:
          "How broad is the IP assignment? Flag assignments covering outside-work inventions without carve-outs.",
      },
      {
        index: 2,
        name: "Restrictive covenants",
        prompt:
          "Non-compete / non-solicit scope, geography, duration. Flag likely-unenforceable breadth or missing notice.",
      },
      {
        index: 3,
        name: "Termination & severance",
        prompt:
          "At-will? Cause definition? Severance terms and conditions on the release of claims.",
      },
    ],
    builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

export class ReviewPackError extends Error {
  readonly code: string;
  readonly status: 400 | 404;

  constructor(code: string, status: 400 | 404) {
    super(code);
    this.name = "ReviewPackError";
    this.code = code;
    this.status = status;
  }
}

function toApiPack(row: typeof reviewPacks.$inferSelect): ApiReviewPack {
  let columns: ReviewColumn[] = [];
  try {
    const parsed = z.array(ZReviewColumn).safeParse(JSON.parse(row.columns));
    if (parsed.success) columns = parsed.data;
  } catch {
    columns = [];
  }
  return {
    id: row.publicId,
    title: row.title,
    description: row.description,
    model: row.model,
    columns,
    builtin: false,
    created_at: row.createdAt.toISOString(),
  };
}

/** All packs visible to an org — builtins first, then org-authored. */
export async function listReviewPacks(
  db: Db,
  organizationId: string
): Promise<ApiReviewPack[]> {
  const rows = await db
    .select()
    .from(reviewPacks)
    .where(eq(reviewPacks.organizationId, organizationId))
    .orderBy(reviewPacks.createdAt);
  return [...BUILTIN_PACKS, ...rows.map(toApiPack)];
}

/** Resolve a pack by id — `builtin/*` resolves from code, else D1. */
export async function getReviewPack(
  db: Db,
  organizationId: string,
  publicId: string
): Promise<ApiReviewPack | null> {
  const builtin = BUILTIN_PACKS.find((p) => p.id === publicId);
  if (builtin) return builtin;
  const rows = await db
    .select()
    .from(reviewPacks)
    .where(
      and(
        eq(reviewPacks.publicId, publicId),
        eq(reviewPacks.organizationId, organizationId)
      )
    )
    .limit(1);
  return rows[0] ? toApiPack(rows[0]) : null;
}

export async function createReviewPack(
  db: Db,
  organizationId: string,
  input: ReviewPackCreate
): Promise<ApiReviewPack> {
  const rows = await db
    .insert(reviewPacks)
    .values({
      id: crypto.randomUUID(),
      publicId: `pack_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      organizationId,
      title: input.title,
      description: input.description ?? null,
      model: input.model ?? null,
      columns: JSON.stringify(input.columns),
      createdAt: new Date(),
    })
    .returning();
  const row = rows[0];
  if (!row) throw new ReviewPackError("create_failed", 400);
  return toApiPack(row);
}

export async function deleteReviewPack(
  db: Db,
  organizationId: string,
  publicId: string
): Promise<void> {
  if (publicId.startsWith("builtin/")) {
    throw new ReviewPackError("builtin_pack", 400);
  }
  const deleted = await db
    .delete(reviewPacks)
    .where(
      and(
        eq(reviewPacks.publicId, publicId),
        eq(reviewPacks.organizationId, organizationId)
      )
    )
    .returning({ id: reviewPacks.id });
  if (deleted.length === 0) throw new ReviewPackError("not_found", 404);
}
