/**
 * Documenso-class auto-signables (design reference only — no AGPL code).
 *
 * Their `AUTO_SIGNABLE_FIELD_TYPES` are NAME / INITIALS / EMAIL / DATE:
 * the server stamps them from recipient identity / now so the signer does
 * not click through date/name/email fields.
 *
 * Seal maps DATE → `date_signed` (signing-time stamp). Plain `date` stays
 * manually filled.
 */

import { and, eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { signatureFields, signatures } from "../global/schema.js";

export const AUTO_SIGNABLE_FIELD_TYPES = [
  "date_signed",
  "name",
  "email",
  "initials",
] as const;

export type AutoSignableFieldType = (typeof AUTO_SIGNABLE_FIELD_TYPES)[number];

export function isAutoSignableFieldType(
  fieldType: string
): fieldType is AutoSignableFieldType {
  return (AUTO_SIGNABLE_FIELD_TYPES as readonly string[]).includes(fieldType);
}

export function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const only = parts[0] ?? "";
    return only.slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

/** ISO date (YYYY-MM-DD) in the given timezone offset minutes, default UTC. */
export function stampDateSigned(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function autoValueForField(
  fieldType: AutoSignableFieldType,
  recipient: { name: string | null; email: string },
  now: Date = new Date()
): string {
  switch (fieldType) {
    case "date_signed":
      return stampDateSigned(now);
    case "name":
      return (recipient.name ?? recipient.email).trim();
    case "email":
      return recipient.email.trim();
    case "initials":
      return initialsFromName(recipient.name ?? recipient.email);
  }
}

/**
 * Upsert signature rows for empty auto-signable fields assigned to this
 * recipient. Returns how many fields were stamped.
 */
export async function autoStampRecipientFields(
  db: D1Client,
  args: {
    documentId: string;
    recipientId: string;
    recipientName: string | null;
    recipientEmail: string;
    signedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<number> {
  const fields = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.documentId, args.documentId),
        eq(signatureFields.recipientId, args.recipientId)
      )
    );

  let stamped = 0;
  for (const field of fields) {
    if (!isAutoSignableFieldType(field.fieldType)) continue;

    const value = autoValueForField(
      field.fieldType,
      { name: args.recipientName, email: args.recipientEmail },
      args.signedAt
    );
    if (!value) continue;

    const existing = await db
      .select()
      .from(signatures)
      .where(
        and(
          eq(signatures.documentId, args.documentId),
          eq(signatures.recipientId, args.recipientId),
          eq(signatures.fieldId, field.id)
        )
      )
      .limit(1);

    const row = existing[0];
    if (row?.value && row.value.trim().length > 0) {
      continue;
    }

    if (row) {
      await db
        .update(signatures)
        .set({
          value,
          ipAddress: args.ipAddress ?? row.ipAddress,
          userAgent: args.userAgent ?? row.userAgent,
          signedAt: args.signedAt,
          updatedAt: args.signedAt,
        })
        .where(eq(signatures.id, row.id));
    } else {
      await db.insert(signatures).values({
        id: crypto.randomUUID(),
        documentId: args.documentId,
        recipientId: args.recipientId,
        fieldId: field.id,
        value,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        signedAt: args.signedAt,
        createdAt: args.signedAt,
        updatedAt: args.signedAt,
      });
    }
    stamped += 1;
  }
  return stamped;
}
