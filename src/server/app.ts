import { feedsRouter } from "./routes/feed";
import { healthRouter } from "./routes/health";
import { newRouter } from "./shared";

export const app = newRouter()
  .basePath("/api/v1")
  // routes definition
  .route("/feeds", feedsRouter)
  .route("/health", healthRouter);

export type AppType = typeof app;
