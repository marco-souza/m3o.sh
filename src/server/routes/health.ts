import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import { newRouter } from "../shared";

const healthCheckStatus = z.enum(["healthy", "unhealthy"]);

const healthRes = z.object({
  db: healthCheckStatus,
});

export const healthRouter = newRouter().get("/", async (c) => {
  let status: ContentfulStatusCode = 200;
  const checks: Record<string, z.infer<typeof healthCheckStatus>> = {};

  try {
    console.log(c.env);
    await c.env.DB.prepare("SELECT 1;").run();
    checks.db = "healthy";
  } catch (error) {
    console.warn(error);
    checks.db = "unhealthy";
    status = 503;
  }

  return c.json(healthRes.parse(checks), status);
});
