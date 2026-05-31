import { z } from "astro/zod";

export const ProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["wip", "live"]).default("wip"),
  featured: z.boolean().default(false),
  repo: z.url({ protocol: /^https?$/ }).optional(),
  updated: z.coerce.date().optional(),
  thumbnail: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const QuerySchema = z.object({
  tag: z.string().optional(),
});

export type Query = z.infer<typeof QuerySchema>;
