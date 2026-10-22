import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { newRouter } from "../shared";

const FeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  source_url: z.string(),
});

const CreateFeedReq = FeedSchema.omit({ id: true });
const CreateFeedRes = FeedSchema;

const ListFeedsRes = z.array(FeedSchema);

const UpdateFeedParam = FeedSchema.pick({ id: true });
const UpdateFeedReq = FeedSchema.omit({ id: true });
const UpdateFeedRes = FeedSchema;

const RemoveFeedsParam = FeedSchema.pick({ id: true });
const RemoveFeedsRes = FeedSchema;

export const feedsRouter = newRouter()
  .post("/", zValidator("json", CreateFeedReq), async (c) => {
    const { name, source_url } = c.req.valid("json");

    try {
      const { results } = await c.env.DB.prepare(
        "INSERT INTO feeds(name, source_url) VALUES (?, ?) RETURNING *;",
      )
        .bind(name, source_url)
        .run();

      const feedResponse = CreateFeedRes.parse(results.at(0));
      return c.json(feedResponse, 201);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        return c.json({ error: "Source URL already exists" }, 409);
      }

      return c.json({ error: "Internal Server Error" }, 500);
    }
  })

  .get("/", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM feeds;").all();
    return c.json(ListFeedsRes.parse(results), 200);
  })

  .put(
    "/:id",
    zValidator("param", UpdateFeedParam),
    zValidator("json", UpdateFeedReq),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, source_url } = c.req.valid("json");

      try {
        const { results, meta } = await c.env.DB.prepare(
          "UPDATE feeds SET name = ?, source_url = ? WHERE id = ? RETURNING *;",
        )
          .bind(name, source_url, id)
          .run();

        if (meta.changes === 0) {
          return c.json({ error: "Feed not found" }, 404);
        }

        return c.json(UpdateFeedRes.parse(results.at(0)), 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("UNIQUE constraint failed")
        ) {
          return c.json({ error: "Source URL already exists" }, 409);
        }

        return c.json({ error: "Internal Server Error" }, 500);
      }
    },
  )

  .delete("/:id", zValidator("param", RemoveFeedsParam), async (c) => {
    const { id } = c.req.valid("param");

    const { meta, results } = await c.env.DB.prepare(
      "DELETE FROM feeds WHERE id = ? RETURNING *;",
    )
      .bind(id)
      .run();

    if (meta.changes === 0) {
      return c.json({ error: "Feed not found" }, 404);
    }

    return c.json(RemoveFeedsRes.parse(results.at(0)));
  });
