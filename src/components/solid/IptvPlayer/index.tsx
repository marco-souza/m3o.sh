import { createEffect, createMemo, type JSX, onCleanup, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useIptvStore } from "../stores/iptv-store";
import { initHls, MAX_RETRIES } from "./hooks";
import type { IptvPlayerProps, PlayerError } from "./types";
import { EmptyState, ErrorOverlay } from "./UI";

// ---------------------------------------------------------------------------
// Player State
// ---------------------------------------------------------------------------

interface PlayerState {
  error: PlayerError | null;
  retryCount: number;
  /** Mirror of video.muted — used for the muted attribute binding */
  isMuted: boolean;
}

const initialState: PlayerState = {
  error: null,
  retryCount: 0,
  isMuted: true,
};

// ---------------------------------------------------------------------------
// IptvPlayer
// ---------------------------------------------------------------------------

export default function IptvPlayer(props: IptvPlayerProps): JSX.Element {
  let videoRef: HTMLVideoElement | undefined;
  let hlsManager: ReturnType<typeof initHls> | null = null;

  const [state, setState] = createStore<PlayerState>(initialState);
  const store = useIptvStore();

  // ---- Helpers to update state cleanly ----
  function resetPlayback() {
    setState(
      produce((s: PlayerState) => {
        s.error = null;
        s.retryCount = 0;
        s.isMuted = true;
      }),
    );
  }

  function handleFatalError(err: PlayerError) {
    setState("error", err);
    props.onError?.(err.message);
  }

  function destroyHls() {
    if (hlsManager) {
      hlsManager.destroy();
      hlsManager = null;
    }
  }

  // ---- React to streamSource changes ----
  createEffect(() => {
    const source = props.streamSource;
    const video = videoRef;
    if (!video) return;

    destroyHls();
    resetPlayback();

    if (!source) {
      video.removeAttribute("src");
      return;
    }

    hlsManager = initHls(source, video, {
      onError: handleFatalError,
    });
  });

  // ---- Cleanup on unmount ----
  onCleanup(() => {
    destroyHls();
  });

  // ---- Event handlers for native video events ----
  function handlePlay() {
    store.actions.updatePlaybackState({ isPlaying: true });
  }
  function handlePause() {
    store.actions.updatePlaybackState({ isPlaying: false });
  }

  // ---- Retry from error state ----
  function handleRetry() {
    const next = state.retryCount + 1;
    setState("retryCount", next);

    if (next > MAX_RETRIES) return;

    const source = props.streamSource;
    if (source && videoRef) {
      destroyHls();
      setState(
        produce((s: PlayerState) => {
          s.error = null;
          s.isMuted = true;
        }),
      );
      store.actions.updatePlaybackState({ isMuted: true });
      hlsManager = initHls(source, videoRef, {
        onError: handleFatalError,
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
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // Silently ignore
      }
      document.body.removeChild(textarea);
    }
  }

  // ---- Derived state (memos) ----
  const hasSource = createMemo(() => props.streamSource !== null);
  const hasError = createMemo(() => state.error !== null);
  const isVideoShowing = createMemo(() => hasSource() && !hasError());
  const isOffline = createMemo(() => state.error?.kind === "network-offline");
  const isPermanentError = createMemo(() => state.retryCount > MAX_RETRIES);

  // ---- Render ----
  return (
    <div
      class={`relative h-full w-full overflow-hidden bg-black ${!isVideoShowing() && "py-24"}`}
    >
      {/* Placeholder when no channel is selected */}
      <Show when={!hasSource() && !hasError()}>
        <EmptyState />
      </Show>

      {/* Video element - must be in this component to access videoRef */}
      <video
        ref={videoRef}
        class={`h-full w-full object-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${hasSource() && !hasError() ? "visible" : "invisible"}`}
        playsinline
        muted={state.isMuted}
        controls={false}
        aria-label="Video player"
        onPlay={handlePlay}
        onPause={handlePause}
      />

      {/* Error overlay */}
      <Show when={hasError()}>
        <ErrorOverlay
          errorMessage={state.error?.message}
          isOffline={isOffline()}
          isPermanentError={isPermanentError()}
          retryCount={state.retryCount}
          maxRetries={MAX_RETRIES}
          onRetry={handleRetry}
          onCopyUrl={handleCopyUrl}
        />
      </Show>
    </div>
  );
}

// Re-export types for consumers
export type {
  ErrorKind,
  IptvPlayerProps,
  PlayerError,
  StreamSource,
} from "./types";
