/**
 * Upsert org contacts from document recipients (SEA-98).
 * Contacts stay a first-class address book; recipients seed it on write + list.
 */

import { and, eq, inArray } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { contacts, documents, recipients } from "../global/schema.js";

type Db = ReturnType<typeof createD1>;

export function splitRecipientName(
  name: string | null | undefined,
  email: string
): { firstName: string; lastName: string; fullName: string } {
  const trimmed = name?.trim() ?? "";
  if (trimmed.length > 0) {
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0] ?? trimmed;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return {
      firstName,
      lastName,
      fullName: trimmed,
    };
  }

  const local = email.split("@")[0]?.trim() || "Contact";
  return {
    firstName: local,
    lastName: "",
    fullName: local,
  };
}

export async function ensureContactsFromRecipients(
  db: Db,
  input: {
    organizationId: string;
    createdBy: string;
    people: Array<{ email: string; name?: string | null }>;
  }
): Promise<number> {
  if (input.people.length === 0) return 0;

  const byEmail = new Map<string, { email: string; name?: string | null }>();
  for (const person of input.people) {
    const email = person.email.trim().toLowerCase();
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, name: person.name });
    }
  }

  if (byEmail.size === 0) return 0;

  const emails = [...byEmail.keys()];
  const existing = await db
    .select({ email: contacts.email })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, input.organizationId),
        inArray(contacts.email, emails)
      )
    );

  const existingSet = new Set(existing.map((row) => row.email.toLowerCase()));
  const now = new Date();
  const toInsert = [...byEmail.values()]
    .filter((person) => !existingSet.has(person.email))
    .map((person) => {
      const names = splitRecipientName(person.name, person.email);
      return {
        id: crypto.randomUUID(),
        publicId: crypto.randomUUID(),
        organizationId: input.organizationId,
        firstName: names.firstName,
        lastName: names.lastName,
        fullName: names.fullName,
        email: person.email,
        status: "active",
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        lastContactedAt: now,
      };
    });

  if (toInsert.length === 0) return 0;

  await db.insert(contacts).values(toInsert);
  return toInsert.length;
}

export async function syncContactsFromOrganizationRecipients(
  db: Db,
  input: { organizationId: string; createdBy: string }
): Promise<number> {
  const orgDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.organizationId, input.organizationId));

  if (orgDocs.length === 0) return 0;

  const people = await db
    .select({
      email: recipients.email,
      name: recipients.name,
    })
    .from(recipients)
    .where(
      inArray(
        recipients.documentId,
        orgDocs.map((doc) => doc.id)
      )
    );

  return ensureContactsFromRecipients(db, {
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    people,
  });
}
