/**
 * IPTV application shell — wires the store provider, hydration lifecycle,
 * and pointer events, then routes to the appropriate view state.
 *
 * This component is intentionally thin: all state lives in the store,
 * all display formatting lives in `channel-display.ts`, and all filter
 * logic lives in `channel-filter.ts`.
 *
 * Rendering is driven entirely by `store.state.view`
 * (`Loading | Ready | Empty | Error`), replacing the old SSR plumbing.
 *
 * UI chrome (overlay, buttons, player controls) stays mounted in the DOM
 * and uses opacity transitions for smooth Netflix-style fade in/out.
 */

import { For, type JSX, onCleanup, onMount, Show } from "solid-js";
import ChannelBrowser from "./ChannelBrowser";
import { SkeletonCard } from "./ChannelCard";
import IptvPlayer from "./IptvPlayer";
import PlayerOverlay from "./IptvPlayer/Overlay";
import SettingsPanel from "./SettingsPanel";
import { IptvProvider, useIptvStore } from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Inner view — uses the store context
// ---------------------------------------------------------------------------

function IptvAppView() {
  const store = useIptvStore();

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

  // ---- Retry / refresh: re-fetch the current playlist (no page reload) ----
  const handleRetry = () => store.actions.refresh();

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
      {/* Loading (first-run auto-fetch, or a refresh in flight with no cache) */}
      <Show when={store.state.view === "Loading"}>
        <div class="flex h-full flex-col items-center gap-4 sm:gap-6 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div class="grid w-full max-w-5xl grid-cols-3 gap-2 sm:gap-3">
            <For each={Array.from({ length: 6 })}>{() => <SkeletonCard />}</For>
          </div>
          <p class="text-xs sm:text-sm text-base-content/40">
            Loading channels…
          </p>
        </div>
      </Show>

      {/* Error (fetch failed and no channels to fall back on) */}
      <Show when={store.state.view === "Error"}>
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
            {store.state.refreshError ?? "The playlist could not be loaded."}
          </p>

          <p class="max-w-md text-center text-xs text-base-content/40">
            {store.state.errorKind ?? ""}
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

      {/* Empty (no channels — first-run default failed, or empty playlist) */}
      <Show when={store.state.view === "Empty"}>
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
            {store.state.refreshError
              ? "The playlist could not be loaded."
              : "Add a playlist URL in Settings or refresh to try again."}
          </p>

          <button
            type="button"
            class="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={handleRetry}
          >
            Refresh
          </button>

          {/* CTA: open Settings programmatically (FR-5) */}
          <button
            type="button"
            class="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={store.actions.openSettings}
          >
            Open Settings
          </button>
        </div>
      </Show>

      {/* Ready — player + overlays */}
      <Show when={store.state.view === "Ready"}>
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

      {/* ---- Settings modal: openable from any view (gear icon / Empty CTA) ---- */}
      <Show when={store.state.isSettingsOpen}>
        <SettingsPanel />
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — wraps the view in the store provider
// ---------------------------------------------------------------------------

export default function IptvApp(): JSX.Element {
  return (
    <IptvProvider>
      <IptvAppView />
    </IptvProvider>
  );
}
