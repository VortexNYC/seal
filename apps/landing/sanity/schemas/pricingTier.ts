import { defineField, defineType } from "sanity";

export const pricingTier = defineType({
  name: "pricingTier",
  title: "Pricing Tier",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
    }),
    defineField({
      name: "price",
      title: "Price",
      type: "number",
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: "billingPeriod",
      title: "Billing Period",
      type: "string",
      options: {
        list: [
          { title: "Monthly", value: "monthly" },
          { title: "Yearly", value: "yearly" },
          { title: "One-time", value: "one-time" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "features",
      title: "Features",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "highlighted",
      title: "Highlighted",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "ctaText",
      title: "CTA Text",
      type: "string",
    }),
    defineField({
      name: "ctaLink",
      title: "CTA Link",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "price" },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle !== null && subtitle !== undefined ? `$${subtitle}` : "Custom" };
    },
  },
});
