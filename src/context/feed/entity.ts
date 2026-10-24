import { z } from "zod";

export const FeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  source_url: z.string(),
});

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),

  feed_id: z.string(),
});
