import { defineCollections, defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/docs",
});

const imageSchema = z.object({
  alt: z.string().optional(),
  height: z.number().optional(),
  src: z.string(),
  width: z.number().optional(),
});

export const changelog = defineCollections({
  dir: "content/changelog",
  schema: z.object({
    breakingChanges: z.array(z.string()).optional(),
    coverImage: imageSchema.optional(),
    description: z.string().optional(),
    features: z
      .array(
        z.object({
          description: z.string().optional(),
          image: imageSchema.optional(),
          title: z.string(),
        }),
      )
      .optional(),
    fixes: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    releaseDate: z.string(),
    summary: z.string().optional(),
    title: z.string(),
    version: z.string(),
  }),
  type: "doc",
});

export default defineConfig({
  plugins: [lastModified()],
});
