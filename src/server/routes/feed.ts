import { zValidator } from "@hono/zod-validator";
import { FeedDAO } from "@/context/feed/dao";
import {
  CreateFeedReq,
  RemoveFeedsParam,
  UpdateFeedParam,
  UpdateFeedReq,
} from "@/context/feed/dto";
import { DataAccessError } from "@/context/feed/exceptions";
import { newRouter } from "../shared";

export const feedsRouter = newRouter()
  .post("/", zValidator("json", CreateFeedReq), async (c) => {
    const { name, source_url } = c.req.valid("json");
    const dao = new FeedDAO(c.env.DB);

    try {
      const feedResponse = await dao.create({ name, source_url });
      return c.json(feedResponse, 201);
    } catch (error) {
      if (error instanceof DataAccessError) {
        return c.json({ error: error.message }, error.status);
      }

      return c.json({ error: "Internal Server Error" }, 500);
    }
  })

  .get("/", async (c) => {
    const dao = new FeedDAO(c.env.DB);
    const results = await dao.retrieve();
    return c.json(results, 200);
  })

  .put(
    "/:id",
    zValidator("param", UpdateFeedParam),
    zValidator("json", UpdateFeedReq),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, source_url } = c.req.valid("json");
      const dao = new FeedDAO(c.env.DB);

      try {
        const feedResponse = await dao.update({ id }, { name, source_url });
        return c.json(feedResponse, 200);
      } catch (error) {
        if (error instanceof DataAccessError) {
          return c.json({ error: error.message }, error.status);
        }

        return c.json({ error: "Internal Server Error" }, 500);
      }
    },
  )

  .delete("/:id", zValidator("param", RemoveFeedsParam), async (c) => {
    const { id } = c.req.valid("param");
    const dao = new FeedDAO(c.env.DB);

    try {
      const feedResponse = await dao.delete({ id });
      return c.json(feedResponse, 200);
    } catch (error) {
      if (error instanceof DataAccessError) {
        return c.json({ error: error.message }, error.status);
      }

      return c.json({ error: "Internal Server Error" }, 500);
    }
  });
