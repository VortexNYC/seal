import { type Infer, v } from "convex/values";

/**
 * Payment Field Config Type Schemas
 *
 * Shared payment type validators kept for type compatibility.
 */

export const paymentTypeTuple = v.union(
  v.literal("one_time"),
  v.literal("recurring"),
  v.literal("installments"),
  v.literal("deposit_balance")
);
export type PaymentType = Infer<typeof paymentTypeTuple>;

export const dueDateTermsTuple = v.union(
  v.literal("on_receipt"),
  v.literal("net_15"),
  v.literal("net_30"),
  v.literal("net_60"),
  v.literal("custom")
);
export type DueDateTerms = Infer<typeof dueDateTermsTuple>;

export const paymentMethodTuple = v.union(
  v.literal("card"),
  v.literal("ach_debit"),
  v.literal("apple_pay"),
  v.literal("google_pay"),
  v.literal("link")
);
export type PaymentMethod = Infer<typeof paymentMethodTuple>;

export const paymentStatusTuple = v.union(
  v.literal("pending"),
  v.literal("created"),
  v.literal("awaiting"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled")
);
export type PaymentStatus = Infer<typeof paymentStatusTuple>;
