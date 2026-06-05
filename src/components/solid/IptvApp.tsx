/**
 * IPTV application shell — wires the store provider, hydration lifecycle,
 * and pointer events, then routes to the appropriate view state.
 *
 * This component is intentionally thin: all state lives in the store,
 * all display formatting lives in `channel-display.ts`, and all filter
 * logic lives in `channel-filter.ts`.
 *
 * UI chrome (overlay, buttons, player controls) stays mounted in the DOM
 * and uses opacity transitions for smooth Netflix-style fade in/out.
 */

import { For, type JSX, onCleanup, onMount, Show } from "solid-js";
import ChannelBrowser from "./ChannelBrowser";
import { SkeletonCard } from "./ChannelCard";
import IptvPlayer from "./IptvPlayer";
import PlayerOverlay from "./IptvPlayer/Overlay";
import {
  type IptvAppProps,
  IptvProvider,
  useAppState,
  useIptvStore,
} from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Inner view — uses the store context
// ---------------------------------------------------------------------------

function IptvAppView(props: IptvAppProps) {
  const store = useIptvStore();
  const app = useAppState(store, props.serverError);

  let containerRef: HTMLDivElement | undefined;

  // ---- Pointer events: show/hide UI chrome on activity ----
  function handlePointerActivity() {
    store.actions.resetChromeTimer();
  }

  onMount(() => {
    store.actions.hydrate();
    const el = containerRef;
    if (el) {
      el.addEventListener("pointermove", handlePointerActivity);
      el.addEventListener("pointerdown", handlePointerActivity);
    }
  });

  onCleanup(() => {
    const el = containerRef;
    if (el) {
      el.removeEventListener("pointermove", handlePointerActivity);
      el.removeEventListener("pointerdown", handlePointerActivity);
    }
    store.actions.clearChromeTimer();
  });

  // ---- Retry: reload the page so the Worker re-fetches ----
  const handleRetry = () => window.location.reload();

  // ---- Player control callbacks ----
  function handleTogglePlayPause() {
    // Toggle is handled by IptvPlayer internally via onPlayStateChange
    // This is just for the overlay buttons to trigger the toggle
    const video = document.querySelector("video");
    if (video) {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }

  function handleToggleMute() {
    const video = document.querySelector("video");
    if (video) {
      video.muted = !video.muted;
      store.actions.updatePlaybackState({ isMuted: video.muted });
    }
  }

  function handleToggleFullscreen() {
    const video = document.querySelector("video");
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }

  // ---- Render ----
  return (
    <div ref={containerRef} class="relative h-full w-full">
      {/* Loading skeleton (SSR cold-start) */}
      <Show when={app.isLoading()}>
        <div class="flex h-full flex-col items-center gap-4 sm:gap-6 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div class="grid w-full max-w-5xl grid-cols-3 gap-2 sm:gap-3">
            <For each={Array.from({ length: 6 })}>{() => <SkeletonCard />}</For>
          </div>
          <p class="text-xs sm:text-sm text-base-content/40">
            Loading channels…
          </p>
        </div>
      </Show>

      {/* Error (server-side fetch failed) */}
      <Show when={app.hasError()}>
        <div class="flex h-full flex-col items-center justify-center gap-4 px-6">
          <svg
            class="h-16 w-16 text-error"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>

          <p
            class="max-w-md text-center text-lg font-semibold text-base-content"
            role="alert"
          >
            Unable to load channels
          </p>

          <p class="max-w-md text-center text-sm text-base-content/60">
            {props.serverError}
          </p>

          <button
            type="button"
            class="btn btn-outline btn-error focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      </Show>

      {/* Empty (API returned zero channels) */}
      <Show when={app.isEmpty()}>
        <div class="flex h-full flex-col items-center justify-center gap-4 px-6">
          <svg
            class="h-16 w-16 text-base-content/30"
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

          <p
            class="max-w-md text-center text-lg font-semibold text-base-content"
            role="alert"
          >
            No channels available
          </p>

          <p class="max-w-md text-center text-sm text-base-content/60">
            The IPTV data source may be unavailable.
          </p>

          <button
            type="button"
            class="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      </Show>

      {/* Ready — player + overlays */}
      <Show
        when={store.state.isHydrated && !app.hasError() && app.hasChannels()}
      >
        <IptvPlayer
          streamSource={store.streamSource()}
          showControls={store.state.showChrome}
          onError={(msg) => console.error("Player error:", msg)}
        />

        {/* ---- Unified player overlay (top + bottom chrome) ---- */}
        <PlayerOverlay
          visible={store.state.showChrome}
          hasSource={store.streamSource() !== null}
          isBrowsing={store.state.isBrowsing}
          onTogglePlayPause={handleTogglePlayPause}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleBrowser={store.actions.toggleBrowser}
        />

        {/* ---- Browser overlay: always visible when open (does not auto-hide) ---- */}
        <Show when={store.state.isBrowsing}>
          <ChannelBrowser
            activeChannelId={store.state.activeChannelId}
            onChannelSelect={store.actions.selectChannel}
            onClose={store.actions.closeBrowser}
          />
        </Show>
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — wraps the view in the store provider
// ---------------------------------------------------------------------------

export default function IptvApp(props: IptvAppProps): JSX.Element {
  return (
    <IptvProvider channels={props.channels} serverError={props.serverError}>
      <IptvAppView {...props} />
    </IptvProvider>
  );
}

// Re-export types that consumers need for backward compatibility
export type { IptvAppProps, IptvChannel } from "./stores/iptv-store";
