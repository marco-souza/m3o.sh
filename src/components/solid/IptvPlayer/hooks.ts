import Hls, { type ErrorData, Events } from "hls.js";
import type { StreamSource } from "./types";

/** Maximum number of user-initiated retries before showing a permanent error. */
const MAX_RETRIES = 2;

export { MAX_RETRIES };

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const GENERIC_ERROR = "generic" as const;

export function isFatalError(data: ErrorData): boolean {
  return data.fatal === true;
}

/** Classify an hls.js ErrorData into a user-facing error message. */
export function classifyError(data: ErrorData): {
  message: string;
  kind: import("./types").ErrorKind;
} {
  // Offline / connectivity check (browser-level, not hls.js detail)
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      kind: "network-offline",
      message: "Check your connection. You appear to be offline.",
    };
  }

  // hls.js network-level errors
  if (
    data.type === Hls.ErrorTypes.NETWORK_ERROR ||
    data.details === "manifestLoadError" ||
    data.details === "levelLoadError" ||
    data.details === "fragLoadError" ||
    data.details === "manifestLoadTimeOut" ||
    data.details === "fragLoadTimeOut" ||
    data.details === "levelLoadTimeOut"
  ) {
    return {
      kind: "stream-unavailable",
      message: "This stream is currently unavailable.",
    };
  }

  // Media errors (codec, decode, etc.)
  if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    return {
      kind: "media-error",
      message: "Playback error. The stream format may be unsupported.",
    };
  }

  // Fallback
  return {
    kind: GENERIC_ERROR,
    message: `Playback error: ${data.details ?? "unknown"}`,
  };
}

// ---------------------------------------------------------------------------
// HLS instance management
// ---------------------------------------------------------------------------

export interface HlsManager {
  destroy: () => void;
}

/** Initialize HLS for a given stream source */
export function initHls(
  source: StreamSource,
  video: HTMLVideoElement,
  callbacks: {
    onError: (err: ReturnType<typeof classifyError>) => void;
  },
): HlsManager | null {
  // Guard: hls.js requires MediaSource support
  if (!Hls.isSupported()) {
    // Fallback: try native HLS (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.url;
      video.play().catch(() => {
        callbacks.onError({
          kind: "stream-unavailable",
          message: "Unable to start playback. The stream may be offline.",
        });
      });
      return null;
    }
    callbacks.onError({
      kind: GENERIC_ERROR,
      message:
        "Your browser does not support HLS playback. Please try Chrome, Firefox, or Safari.",
    });
    return null;
  }

  const hls = new Hls({
    // xhrSetup injects required headers before each xhr request
    xhrSetup: (xhr, _url) => {
      if (source.referrer) {
        xhr.setRequestHeader("Referer", source.referrer);
      }
      if (source.user_agent) {
        xhr.setRequestHeader("User-Agent", source.user_agent);
      }
    },
  });

  hls.on(Events.ERROR, (_event, data) => {
    if (!isFatalError(data)) return;

    // Prevent hls.js from automatically destroying itself so we can show UI
    hls.detachMedia();

    const err = classifyError(data);
    callbacks.onError(err);
  });

  hls.attachMedia(video);
  hls.loadSource(source.url);

  // Attempt autoplay (muted via the reactive prop binding)
  video.play().catch(() => {
    // User interaction required — that's fine, they can click the video
  });

  return {
    destroy: () => {
      hls.detachMedia();
      hls.destroy();
    },
  };
}
