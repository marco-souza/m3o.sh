import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { app } from "@/server/app";

export const ALL: APIRoute = async (context) => {
  return app.fetch(context.request, env);
};
