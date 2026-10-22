import * as midnightCleanUp from "./midnightCleanUp";

export function cronHandler(cronExp: string, env: Env, ctx: ExecutionContext) {
  switch (cronExp) {
    case midnightCleanUp.cronExpression:
      // Add your periodic Vite-compiled code or API dispatches here
      ctx.waitUntil(midnightCleanUp.handler(env));
      break;
  }
}
