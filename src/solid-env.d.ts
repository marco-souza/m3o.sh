/// <reference types="solid-js" />

interface Window {
  posthog?: {
    capture: (event: string, properties?: Record<string, unknown>) => void;
    captureLog: (options: {
      body: string;
      level: "info" | "warn" | "error";
      attributes?: Record<string, unknown>;
    }) => void;
  };
}
