import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "siteName",
      title: "Site Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "tagline",
      title: "Tagline",
      type: "string",
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
    }),
    defineField({
      name: "socialLinks",
      title: "Social Links",
      type: "object",
      fields: [
        defineField({ name: "twitter", title: "Twitter", type: "url" }),
        defineField({ name: "linkedin", title: "LinkedIn", type: "url" }),
        defineField({ name: "github", title: "GitHub", type: "url" }),
      ],
    }),
    defineField({
      name: "footerText",
      title: "Footer Text",
      type: "text",
    }),
    defineField({
      name: "announcement",
      title: "Announcement Bar",
      type: "object",
      fields: [
        defineField({
          name: "enabled",
          title: "Enabled",
          type: "boolean",
          initialValue: false,
        }),
        defineField({ name: "text", title: "Text", type: "string" }),
        defineField({ name: "link", title: "Link", type: "url" }),
        defineField({
          name: "style",
          title: "Style",
          type: "string",
          options: {
            list: [
              { title: "Info", value: "info" },
              { title: "Success", value: "success" },
              { title: "Warning", value: "warning" },
            ],
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site Settings" }),
  },
});
