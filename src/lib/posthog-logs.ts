const LOGGER_NAME = "open_tv";

export const openTvPostHogLogger = {
  info(body: string) {
    window.posthog?.captureLog({
      body,
      level: "info",
      attributes: { logger_name: LOGGER_NAME },
    });
  },
};
