/**
 * Contacts schema
 *
 * Contacts/CRM module for managing organization contacts.
 * Contacts can be linked to document recipients and tracked
 * with status, tags, and interaction history.
 */

import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const contactStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("lead"),
);
export type ContactStatus = Infer<typeof contactStatusValidator>;

export const contactsTable = defineTable({
  organizationId: v.id("organizations"),
  firstName: v.string(),
  lastName: v.string(),
  fullName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  company: v.optional(v.string()),
  title: v.optional(v.string()),
  status: contactStatusValidator,
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  lastContactedAt: v.optional(v.number()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_email", ["email"])
  .index("by_org_email", ["organizationId", "email"])
  .index("by_org_status", ["organizationId", "status"])
  .searchIndex("search_contacts", {
    searchField: "fullName",
    filterFields: ["organizationId", "status"],
  });
