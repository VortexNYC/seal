import { defineArrayMember, defineField, defineType } from "sanity";

// Reusable CTA object
const ctaFields = [
  defineField({ name: "text", title: "Text", type: "string" }),
  defineField({ name: "link", title: "Link", type: "string" }),
];

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
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
      name: "seo",
      title: "SEO",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Title", type: "string" }),
        defineField({
          name: "description",
          title: "Description",
          type: "text",
        }),
        defineField({ name: "ogImage", title: "OG Image", type: "image" }),
      ],
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      of: [
        // Hero
        defineArrayMember({
          type: "object",
          name: "hero",
          title: "Hero",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "subheadline",
              title: "Subheadline",
              type: "text",
            }),
            defineField({ name: "image", title: "Image", type: "image" }),
            defineField({
              name: "primaryCta",
              title: "Primary CTA",
              type: "object",
              fields: ctaFields,
            }),
            defineField({
              name: "secondaryCta",
              title: "Secondary CTA",
              type: "object",
              fields: ctaFields,
            }),
          ],
          preview: {
            select: { title: "headline" },
            prepare: ({ title }) => ({ title: `Hero: ${title}` }),
          },
        }),

        // Features Section
        defineArrayMember({
          type: "object",
          name: "featuresSection",
          title: "Features Section",
          fields: [
            defineField({ name: "eyebrow", title: "Eyebrow", type: "string" }),
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
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
                    }),
                    defineField({
                      name: "description",
                      title: "Description",
                      type: "text",
                    }),
                    defineField({
                      name: "icon",
                      title: "Icon",
                      type: "string",
                    }),
                  ],
                },
              ],
            }),
            defineField({
              name: "layout",
              title: "Layout",
              type: "string",
              options: {
                list: [
                  { title: "3 Column Grid", value: "grid-3" },
                  { title: "2 Column Grid", value: "grid-2" },
                  { title: "Alternating", value: "alternating" },
                ],
              },
            }),
          ],
          preview: {
            select: { title: "headline" },
            prepare: ({ title }) => ({
              title: `Features: ${title || "Untitled"}`,
            }),
          },
        }),

        // Testimonials Section
        defineArrayMember({
          type: "object",
          name: "testimonialsSection",
          title: "Testimonials Section",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "testimonials",
              title: "Testimonials",
              type: "array",
              of: [{ type: "reference", to: [{ type: "testimonial" }] }],
            }),
          ],
          preview: {
            prepare: () => ({ title: "Testimonials Section" }),
          },
        }),

        // Pricing Section
        defineArrayMember({
          type: "object",
          name: "pricingSection",
          title: "Pricing Section",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
            }),
            defineField({
              name: "tiers",
              title: "Tiers",
              type: "array",
              of: [{ type: "reference", to: [{ type: "pricingTier" }] }],
            }),
          ],
          preview: {
            prepare: () => ({ title: "Pricing Section" }),
          },
        }),

        // FAQ Section
        defineArrayMember({
          type: "object",
          name: "faqSection",
          title: "FAQ Section",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "faqs",
              title: "FAQs",
              type: "array",
              of: [{ type: "reference", to: [{ type: "faqItem" }] }],
            }),
          ],
          preview: {
            prepare: () => ({ title: "FAQ Section" }),
          },
        }),

        // CTA Section
        defineArrayMember({
          type: "object",
          name: "ctaSection",
          title: "CTA Section",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
            }),
            defineField({
              name: "primaryCta",
              title: "Primary CTA",
              type: "object",
              fields: ctaFields,
            }),
            defineField({
              name: "secondaryCta",
              title: "Secondary CTA",
              type: "object",
              fields: ctaFields,
            }),
            defineField({
              name: "style",
              title: "Style",
              type: "string",
              options: {
                list: [
                  { title: "Default", value: "default" },
                  { title: "Gradient", value: "gradient" },
                  { title: "Dark", value: "dark" },
                ],
              },
            }),
          ],
          preview: {
            select: { title: "headline" },
            prepare: ({ title }) => ({ title: `CTA: ${title}` }),
          },
        }),

        // Logo Cloud
        defineArrayMember({
          type: "object",
          name: "logoCloud",
          title: "Logo Cloud",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "logos",
              title: "Logos",
              type: "array",
              of: [{ type: "image" }],
            }),
          ],
          preview: {
            prepare: () => ({ title: "Logo Cloud" }),
          },
        }),

        // Comparison Table
        defineArrayMember({
          type: "object",
          name: "comparisonTable",
          title: "Comparison Table",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
            }),
            defineField({
              name: "competitors",
              title: "Competitors",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    defineField({
                      name: "name",
                      title: "Name",
                      type: "string",
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
                              name: "label",
                              title: "Label",
                              type: "string",
                            }),
                            defineField({
                              name: "supported",
                              title: "Supported",
                              type: "boolean",
                              initialValue: false,
                            }),
                          ],
                        },
                      ],
                    }),
                  ],
                },
              ],
            }),
            defineField({
              name: "sealFeatures",
              title: "Seal Features",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    defineField({
                      name: "label",
                      title: "Label",
                      type: "string",
                    }),
                    defineField({
                      name: "supported",
                      title: "Supported",
                      type: "boolean",
                      initialValue: false,
                    }),
                  ],
                },
              ],
            }),
          ],
          preview: {
            prepare: () => ({ title: "Comparison Table" }),
          },
        }),

        // Template Preview
        defineArrayMember({
          type: "object",
          name: "templatePreview",
          title: "Template Preview",
          fields: [
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
            }),
            defineField({
              name: "templates",
              title: "Templates",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    defineField({
                      name: "name",
                      title: "Name",
                      type: "string",
                    }),
                    defineField({
                      name: "description",
                      title: "Description",
                      type: "text",
                    }),
                    defineField({
                      name: "category",
                      title: "Category",
                      type: "string",
                    }),
                    defineField({
                      name: "image",
                      title: "Image",
                      type: "image",
                    }),
                  ],
                },
              ],
            }),
          ],
          preview: {
            select: { title: "headline" },
            prepare: ({ title }) => ({
              title: `Templates: ${title || "Untitled"}`,
            }),
          },
        }),

        // Legal Disclaimer
        defineArrayMember({
          type: "object",
          name: "legalDisclaimer",
          title: "Legal Disclaimer",
          fields: [
            defineField({
              name: "text",
              title: "Text",
              type: "text",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "style",
              title: "Style",
              type: "string",
              options: {
                list: [
                  { title: "Info", value: "info" },
                  { title: "Warning", value: "warning" },
                ],
              },
            }),
          ],
          preview: {
            prepare: () => ({ title: "Legal Disclaimer" }),
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `/${subtitle}` : "" };
    },
  },
});
