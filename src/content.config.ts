import { defineCollection, reference } from "astro:content";

import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    author: reference("authors"),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
  }),
});

const authors = defineCollection({
  loader: file("./src/data/authors.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    headline: z.string(),
    email: z.email(),
    avatar: z.url(),
  }),
});

export const collections = {
  blog,
  authors,
};
