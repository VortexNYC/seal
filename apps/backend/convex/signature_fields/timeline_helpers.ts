import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { timeline } from "../timeline";

/**
 * Shape of a single field in a timeline snapshot.
 * Excludes system fields (_id, _creationTime) and timestamps.
 */
interface FieldSnapshot {
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
}

interface TimelineSnapshot {
  fields: Array<{
    id: string;
    data: FieldSnapshot;
  }>;
}

function timelineScope(documentId: Id<"documents">): string {
  return `fields:${documentId}`;
}

async function getFieldsForDocument(ctx: QueryCtx, documentId: Id<"documents">) {
  return await ctx.db
    .query("signature_fields")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
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
export async function pushFieldSnapshot(ctx: MutationCtx, documentId: Id<"documents">) {
  const fields = await getFieldsForDocument(ctx, documentId);
  const snapshot: TimelineSnapshot = {
    fields: fields.map(fieldToSnapshot),
  };
  await timeline.push(ctx, timelineScope(documentId), snapshot);
}

/**
 * Get the timeline status (canUndo, canRedo) for a document's fields.
 */
export async function getFieldTimelineStatus(ctx: QueryCtx, documentId: Id<"documents">) {
  return await timeline.status(ctx, timelineScope(documentId));
}

/**
 * Undo the last field change. Returns true if undo was applied.
 */
export async function undoFieldChange(ctx: MutationCtx, documentId: Id<"documents">) {
  const result = (await timeline.undo(ctx, timelineScope(documentId))) as TimelineSnapshot | null;
  if (!result) return false;
  await reconcileFields(ctx, documentId, result);
  return true;
}

/**
 * Redo the last undone field change. Returns true if redo was applied.
 */
export async function redoFieldChange(ctx: MutationCtx, documentId: Id<"documents">) {
  const result = (await timeline.redo(ctx, timelineScope(documentId))) as TimelineSnapshot | null;
  if (!result) return false;
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
  snapshot: TimelineSnapshot,
) {
  const currentFields = await getFieldsForDocument(ctx, documentId);
  const currentMap = new Map(currentFields.map((f) => [f._id as string, f]));
  const snapshotMap = new Map(snapshot.fields.map((f) => [f.id, f.data]));
  const now = Date.now();

  // Delete fields not in snapshot
  for (const field of currentFields) {
    if (!snapshotMap.has(field._id as string)) {
      // Cascade-delete payment config if payment field
      if (field.fieldType === "payment") {
        const paymentConfig = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .unique();
        if (paymentConfig) {
          await ctx.db.delete(paymentConfig._id);
        }
      }
      await ctx.db.delete(field._id);
    }
  }

  // Insert or update fields from snapshot
  for (const [id, data] of snapshotMap) {
    const existing = currentMap.get(id);
    if (!existing) {
      // Field was deleted — re-insert (gets new ID, which is fine in draft)
      await ctx.db.insert("signature_fields", {
        ...data,
        documentId,
        fieldType: data.fieldType as
          | "signature"
          | "text"
          | "number"
          | "date"
          | "checkbox"
          | "dropdown"
          | "radio"
          | "attachment"
          | "payment",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Field exists — patch if anything changed
      const needsPatch =
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
        JSON.stringify(existing.validationRules) !== JSON.stringify(data.validationRules);

      if (needsPatch) {
        await ctx.db.patch(existing._id, {
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
    }
  }
}
