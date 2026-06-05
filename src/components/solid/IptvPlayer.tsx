import Hls, { type ErrorData, Events } from "hls.js";
import { createEffect, createSignal, type JSX, onCleanup } from "solid-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of user-initiated retries before showing a permanent error. */
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// Public props contract
// ---------------------------------------------------------------------------

export interface StreamSource {
  url: string;
  /** Optional Referer header required by the stream server */
  referrer?: string | null;
  /** Optional User-Agent header required by the stream server */
  user_agent?: string | null;
}

export interface IptvPlayerProps {
  /** The stream to play, or null when no channel is selected */
  streamSource: StreamSource | null;
  /** Callback when hls.js emits a fatal error */
  onError?: (message: string) => void;
  /** Callback when the user clicks retry */
  onRetry?: () => void;
  /** When true, show player controls (play/pause, mute, fullscreen). When false, hide them for a clean view. */
  showControls?: boolean;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Distinguishes error categories for user-facing messaging and recovery UX. */
type ErrorKind =
  | "network-offline"
  | "stream-unavailable"
  | "media-error"
  | "generic";

interface PlayerError {
  message: string;
  kind: ErrorKind;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFatalError(data: ErrorData): boolean {
  return data.fatal === true;
}

/** Classify an hls.js ErrorData into a user-facing PlayerError. */
function classifyError(data: ErrorData): PlayerError {
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
    kind: "generic",
    message: `Playback error: ${data.details ?? "unknown"}`,
  };
}

// ---------------------------------------------------------------------------
// IptvPlayer
// ---------------------------------------------------------------------------

export default function IptvPlayer(props: IptvPlayerProps): JSX.Element {
  let videoRef: HTMLVideoElement | undefined;
  let hlsInstance: Hls | null = null;

  const [error, setError] = createSignal<PlayerError | null>(null);
  const [retryCount, setRetryCount] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isMuted, setIsMuted] = createSignal(true);

  // ---- Clean previous Hls instance before creating a new one ----
  function destroyHls() {
    if (hlsInstance) {
      hlsInstance.detachMedia();
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  // ---- Initialize Hls for a given stream source ----
  function initHls(source: StreamSource, video: HTMLVideoElement): void {
    // Guard: hls.js requires MediaSource support
    if (!Hls.isSupported()) {
      // Fallback: try native HLS (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = source.url;
        video.play().catch(() => {
          setError({
            kind: "stream-unavailable",
            message: "Unable to start playback. The stream may be offline.",
          });
        });
        return;
      }
      setError({
        kind: "generic",
        message:
          "Your browser does not support HLS playback. Please try Chrome, Firefox, or Safari.",
      });
      return;
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
      setError(err);
      props.onError?.(err.message);
    });

    hls.attachMedia(video);
    hls.loadSource(source.url);

    hlsInstance = hls;

    // Attempt autoplay (muted to comply with autoplay policies)
    video.muted = true;
    setIsMuted(true);
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        // User interaction required — that's fine, they can click the video
      });
  }

  // ---- React to streamSource changes ----
  createEffect(() => {
    const source = props.streamSource;
    const video = videoRef;
    if (!video) return;

    // Clear previous state
    destroyHls();
    setError(null);
    setRetryCount(0);
    setIsPlaying(false);

    // Null source = placeholder; nothing more to do
    if (!source) {
      video.removeAttribute("src");
      return;
    }

    // Let the DOM settle (Solid batches the effect callback before DOM is
    // updated; requestAnimationFrame guarantees the video element is in the
    // tree after the placeholder → video swap)
    requestAnimationFrame(() => {
      initHls(source, video);
    });
  });

  // ---- Cleanup on unmount ----
  onCleanup(() => {
    destroyHls();
  });

  // ---- Event handlers for native video events ----
  function handlePlay() {
    setIsPlaying(true);
  }
  function handlePause() {
    setIsPlaying(false);
  }

  // ---- Control button actions ----
  function togglePlayPause() {
    const video = videoRef;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function toggleMute() {
    const video = videoRef;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function toggleFullscreen() {
    const video = videoRef;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }

  // ---- Retry from error state ----
  function handleRetry() {
    const next = retryCount() + 1;
    setRetryCount(next);

    props.onRetry?.();

    // Only attempt to re-init if we haven't exceeded max retries
    if (next > MAX_RETRIES) return;

    const source = props.streamSource;
    if (source && videoRef) {
      destroyHls();
      setError(null);
      requestAnimationFrame(() => {
        initHls(source, videoRef);
      });
    }
  }

  /** Copy the current stream URL to the clipboard as a fallback. */
  async function handleCopyUrl() {
    const url = props.streamSource?.url;
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API may not be available (e.g., non-HTTPS localhost);
      // fallback to the deprecated execCommand for older environments.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // Silently ignore — the user can still see the URL in the UI
      }
      document.body.removeChild(textarea);
    }
  }

  /** Whether the error is permanent (max retries exceeded for this stream). */
  const isPermanentError = () => retryCount() > MAX_RETRIES;

  /** Whether the error is caused by the user being offline. */
  const isOffline = () => error()?.kind === "network-offline";

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const hasSource = () => props.streamSource !== null;

  return (
    <div class="relative h-full w-full overflow-hidden bg-black">
      {/* ---- Placeholder when no channel is selected ---- */}
      {!hasSource() && !error() && (
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/60 py-12">
          {/* Brand logo placeholder: a stylised TV icon */}
          <svg
            class="h-20 w-20 opacity-40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 21 12 17 7 21" />
          </svg>
          <p class="text-lg font-medium">Select a channel to start watching</p>
        </div>
      )}

      {/* ---- Video element ---- */}
      {/* biome-ignore lint/a11y/useMediaCaption: live HLS streams do not provide captions */}
      <video
        ref={videoRef}
        class={`h-full w-full object-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          hasSource() && !error() ? "visible" : "invisible"
        }`}
        playsinline
        controls={false}
        aria-label="Video player"
        onPlay={handlePlay}
        onPause={handlePause}
      />

      {/* ---- Player controls (fade with chrome visibility) ---- */}
      {hasSource() && !error() && (
        <div
          class={`absolute inset-0 z-10 transition-opacity duration-500 ease-out ${
            props.showControls !== false
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Center play/pause button (large, shown when paused) */}
          {!isPlaying() && (
            <button
              type="button"
              class="absolute inset-0 m-auto flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30 hover:scale-110 focus-visible:outline-2 focus-visible:outline-white"
              onClick={togglePlayPause}
              aria-label="Play"
            >
              <svg
                class="ml-1 h-10 w-10 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          )}

          {/* Bottom gradient + control bar */}
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 sm:px-4 pb-2 sm:pb-3 pt-8 sm:pt-10">
            <div class="flex items-center justify-between">
              {/* Left: Play/Pause + Mute */}
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                  onClick={togglePlayPause}
                  aria-label={isPlaying() ? "Pause" : "Play"}
                >
                  {isPlaying() ? (
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                  onClick={toggleMute}
                  aria-label={isMuted() ? "Unmute" : "Mute"}
                >
                  {isMuted() ? (
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Right: Fullscreen */}
              <button
                type="button"
                class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                onClick={toggleFullscreen}
                aria-label="Toggle fullscreen"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {error() && (
        <div
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-white"
          role="alert"
        >
          {/* ---- Offline icon ---- */}
          {isOffline() ? (
            <svg
              class="h-12 w-12 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          ) : (
            <svg
              class="h-12 w-12 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}

          {/* ---- Error message ---- */}
          <p class="max-w-md text-center text-sm">{error()?.message}</p>

          {/* ---- Actions: depends on retry count ---- */}
          <div class="flex flex-col items-center gap-3">
            {/* Permanent error (max retries exceeded) → Copy URL fallback */}
            {isPermanentError() ? (
              <>
                <p class="max-w-md text-center text-xs text-white/50">
                  Playback could not be recovered after {MAX_RETRIES + 1}{" "}
                  attempts.
                </p>
                <button
                  type="button"
                  class="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  onClick={handleCopyUrl}
                  aria-label="Copy stream URL to clipboard"
                >
                  Copy stream URL
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  class="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  onClick={handleRetry}
                  aria-label="Retry playback"
                >
                  Try Again
                </button>
                {retryCount() > 0 && (
                  <p class="text-xs text-white/40">
                    Attempt {retryCount()} of {MAX_RETRIES + 1}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
