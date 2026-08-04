import z from "zod";

// VAL-REAL-1776631742669

/**
 * Organization Schemas
 */

export const organizationTypeTupleZod = z.enum([
  "personal",
  "group",
  "company",
]);

export const organizationBaseSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  type: organizationTypeTupleZod,
  logo: z.string().url().optional(),
  metadata: z.string().optional(),
  timezone: z.string().default("UTC"),
  isActive: z.boolean().default(true),
});
export type OrganizationBaseSchema = z.infer<typeof organizationBaseSchema>;
