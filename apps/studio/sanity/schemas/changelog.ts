import { defineField, defineType } from "sanity";

export const changelog = defineType({
  name: "changelog",
  title: "Changelog",
  type: "document",
  fields: [
    defineField({
      name: "version",
      title: "Version",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "releaseDate",
      title: "Release Date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "features",
      title: "Features",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
            }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              fields: [
                defineField({
                  name: "alt",
                  title: "Alt Text",
                  type: "string",
                }),
              ],
            }),
          ],
          preview: {
            select: { title: "title" },
          },
        },
      ],
    }),
    defineField({
      name: "improvements",
      title: "Improvements",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "fixes",
      title: "Fixes",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "breakingChanges",
      title: "Breaking Changes",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
  orderings: [
    {
      title: "Release Date (newest)",
      name: "releaseDateDesc",
      by: [{ field: "releaseDate", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "version" },
  },
});
