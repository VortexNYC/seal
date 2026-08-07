import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fieldTypeTuple } from "../schemas/signature_fields";
import { timeline } from "../timeline";

/**
 * Shape of a single field in a timeline snapshot.
 * Excludes system fields (_id, _creationTime) and timestamps.
 */
const fieldSnapshotValidator = v.object({
  documentId: v.id("documents"),
  recipientId: v.optional(v.id("document_recipients")),
  templateFieldId: v.optional(v.id("template_fields")),
  fieldType: v.string(),
  label: v.string(),
  isRequired: v.boolean(),
  isMainSignature: v.optional(v.boolean()),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  page: v.number(),
  properties: v.optional(
    v.object({
      placeholder: v.optional(v.string()),
      defaultValue: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      maxLength: v.optional(v.number()),
      minLength: v.optional(v.number()),
      pattern: v.optional(v.string()),
      helpText: v.optional(v.string()),
    })
  ),
  validationRules: v.optional(
    v.object({
      required: v.optional(v.boolean()),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      pattern: v.optional(v.string()),
      customMessage: v.optional(v.string()),
    })
  ),
});

const timelineSnapshotValidator = v.object({
  fields: v.array(
    v.object({
      id: v.string(),
      data: fieldSnapshotValidator,
    })
  ),
});

type FieldSnapshot = {
  documentId: Id<"documents">;
  recipientId?: Id<"document_recipients">;
  templateFieldId?: Id<"template_fields">;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isMainSignature?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  properties?: {
    placeholder?: string;
    defaultValue?: string;
    options?: string[];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    helpText?: string;
  };
  validationRules?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
};

type TimelineSnapshot = {
  fields: Array<{
    id: string;
    data: FieldSnapshot;
  }>;
};

type CurrentField = Awaited<ReturnType<typeof getFieldsForDocument>>[number];

function timelineScope(documentId: Id<"documents">): string {
  return `fields:${documentId}`;
}

async function getFieldsForDocument(
  ctx: QueryCtx,
  documentId: Id<"documents">
) {
  const results = [];
  for await (const field of ctx.db
    .query("signature_fields")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    results.push(field);
  }
  return results;
}

function toSignatureFieldType(fieldType: string) {
  return parse(fieldTypeTuple, fieldType);
}

function needsFieldPatch(existing: CurrentField, data: FieldSnapshot): boolean {
  return (
    existing.x !== data.x ||
    existing.y !== data.y ||
    existing.width !== data.width ||
    existing.height !== data.height ||
    existing.page !== data.page ||
    existing.label !== data.label ||
    existing.isRequired !== data.isRequired ||
    existing.isMainSignature !== data.isMainSignature ||
    existing.recipientId !== data.recipientId ||
    JSON.stringify(existing.properties) !== JSON.stringify(data.properties) ||
    JSON.stringify(existing.validationRules) !==
      JSON.stringify(data.validationRules)
  );
}

async function deleteFieldIfMissing(
  ctx: MutationCtx,
  field: CurrentField,
  snapshotMap: Map<string, FieldSnapshot>
): Promise<void> {
  if (snapshotMap.has(field._id)) {
    return;
  }

  if (field.fieldType === "payment") {
    const paymentConfig = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", field._id))
      .unique();
    if (paymentConfig) {
      await ctx.db.delete("payment_field_configs", paymentConfig._id);
    }
  }

  await ctx.db.delete("signature_fields", field._id);
}

async function upsertSnapshotField(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  now: number,
  id: string,
  data: FieldSnapshot,
  currentMap: Map<string, CurrentField>
): Promise<void> {
  const existing = currentMap.get(id);
  if (!existing) {
    await ctx.db.insert("signature_fields", {
      ...data,
      documentId,
      fieldType: toSignatureFieldType(data.fieldType),
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  if (!needsFieldPatch(existing, data)) {
    return;
  }

  await ctx.db.patch("signature_fields", existing._id, {
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    page: data.page,
    label: data.label,
    isRequired: data.isRequired,
    isMainSignature: data.isMainSignature,
    recipientId: data.recipientId,
    properties: data.properties,
    validationRules: data.validationRules,
    updatedAt: now,
  });
}

function fieldToSnapshot(field: {
  _id: Id<"signature_fields">;
  documentId: Id<"documents">;
  recipientId?: Id<"document_recipients">;
  templateFieldId?: Id<"template_fields">;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isMainSignature?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  properties?: FieldSnapshot["properties"];
  validationRules?: FieldSnapshot["validationRules"];
}): { id: string; data: FieldSnapshot } {
  return {
    id: field._id,
    data: {
      documentId: field.documentId,
      recipientId: field.recipientId,
      templateFieldId: field.templateFieldId,
      fieldType: field.fieldType,
      label: field.label,
      isRequired: field.isRequired,
      isMainSignature: field.isMainSignature,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      page: field.page,
      properties: field.properties,
      validationRules: field.validationRules,
    },
  };
}

/**
 * Push a snapshot of all fields for a document onto the timeline.
 * Call this AFTER every field mutation (create, update, reposition, delete).
 */
export async function pushFieldSnapshot(
  ctx: MutationCtx,
  documentId: Id<"documents">
) {
  const fields = await getFieldsForDocument(ctx, documentId);
  const snapshot: TimelineSnapshot = {
    fields: fields.map(fieldToSnapshot),
  };
  await timeline.push(ctx, timelineScope(documentId), snapshot);
}

/**
 * Get the timeline status (canUndo, canRedo) for a document's fields.
 */
export async function getFieldTimelineStatus(
  ctx: QueryCtx,
  documentId: Id<"documents">
) {
  return await timeline.status(ctx, timelineScope(documentId));
}

/**
 * Undo the last field change. Returns true if undo was applied.
 */
export async function undoFieldChange(
  ctx: MutationCtx,
  documentId: Id<"documents">
) {
  const raw = await timeline.undo(ctx, timelineScope(documentId));
  if (raw === null) return false;
  const result = parse(timelineSnapshotValidator, raw);
  await reconcileFields(ctx, documentId, result);
  return true;
}

/**
 * Redo the last undone field change. Returns true if redo was applied.
 */
export async function redoFieldChange(
  ctx: MutationCtx,
  documentId: Id<"documents">
) {
  const raw = await timeline.redo(ctx, timelineScope(documentId));
  if (raw === null) return false;
  const result = parse(timelineSnapshotValidator, raw);
  await reconcileFields(ctx, documentId, result);
  return true;
}

/**
 * Reconcile DB fields with a timeline snapshot.
 * - Fields in snapshot but not in DB → insert
 * - Fields in DB but not in snapshot → delete
 * - Fields in both → patch if different
 */
async function reconcileFields(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  snapshot: TimelineSnapshot
) {
  const currentFields = await getFieldsForDocument(ctx, documentId);
  const currentMap = new Map(currentFields.map((f) => [f._id, f] as const));
  const snapshotMap = new Map(snapshot.fields.map((f) => [f.id, f.data]));
  const now = Date.now();

  for (const field of currentFields) {
    await deleteFieldIfMissing(ctx, field, snapshotMap);
  }

  for (const [id, data] of snapshotMap) {
    await upsertSnapshotField(ctx, documentId, now, id, data, currentMap);
  }
}
