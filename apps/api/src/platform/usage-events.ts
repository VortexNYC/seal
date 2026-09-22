import type { createD1 } from "../global/db.js";
import { usageEvents } from "../global/schema.js";

export type UsageEventType =
  | "document.created"
  | "document.sent"
  | "document.completed"
  | "storage.bytes"
  | string;

/** YYYY-MM period key in UTC. */
export function currentUsagePeriod(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function recordUsageEvent(
  db: ReturnType<typeof createD1>,
  input: {
    organizationId: string;
    eventType: UsageEventType;
    quantity?: number;
    period?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const quantity = input.quantity ?? 1;
  if (quantity <= 0) return;

  await db.insert(usageEvents).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    eventType: input.eventType,
    quantity,
    period: input.period ?? currentUsagePeriod(),
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
