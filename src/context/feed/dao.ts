import type { z } from "astro/zod";
import {
  type CreateFeedReq,
  CreateFeedRes,
  ListFeedsRes,
  type RemoveFeedsParam,
  RemoveFeedsRes,
  type UpdateFeedParam,
  type UpdateFeedReq,
  UpdateFeedRes,
} from "./dto";
import {
  FeedNotFound,
  InternalServerError,
  SourceExistsError,
} from "./exceptions";

export class FeedDAO {
  constructor(private db: Env["DB"]) {}

  async create({ name, source_url }: z.infer<typeof CreateFeedReq>) {
    try {
      const { results } = await this.db
        .prepare(
          "INSERT INTO feeds(name, source_url) VALUES (?, ?) RETURNING *;",
        )
        .bind(name, source_url)
        .run();

      const output = CreateFeedRes.parse(results.at(0));
      return output;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        throw new SourceExistsError();
      }

      throw new InternalServerError();
    }
  }

  async retrieve() {
    const { results } = await this.db.prepare("SELECT * FROM feeds;").all();
    return ListFeedsRes.parse(results);
  }

  async update(
    { id }: z.infer<typeof UpdateFeedParam>,
    { name, source_url }: z.infer<typeof UpdateFeedReq>,
  ) {
    try {
      const { results, meta } = await this.db
        .prepare(
          "UPDATE feeds SET name = ?, source_url = ? WHERE id = ? RETURNING *;",
        )
        .bind(name, source_url, id)
        .run();

      if (meta.changes === 0) {
        throw new FeedNotFound();
      }

      return UpdateFeedRes.parse(results.at(0));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        throw new SourceExistsError();
      }

      throw new InternalServerError();
    }
  }

  async delete({ id }: z.infer<typeof RemoveFeedsParam>) {
    const { meta, results } = await this.db
      .prepare("DELETE FROM feeds WHERE id = ? RETURNING *;")
      .bind(id)
      .run();

    if (meta.changes === 0) {
      throw new FeedNotFound();
    }

    return RemoveFeedsRes.parse(results.at(0));
  }
}
