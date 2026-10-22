import handler from "@astrojs/cloudflare/entrypoints/server";
import { cronHandler } from "./crons";

const fetch = handler.fetch;

function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
) {
  console.log(`Cron job triggered pattern: ${controller.cron}`);

  cronHandler(controller.cron, env, ctx);
}

export default { fetch, scheduled };
