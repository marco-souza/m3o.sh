/**
 * Unified player overlay — top and bottom chrome that fades together.
 *
 * Top overlay:
 * - left: Browse Channels Button
 * - center: Title + category/quality tags
 * - right: Refresh + Copy buttons
 *
 * Bottom overlay:
 * - left: Play/Pause + Mute/Unmute
 * - right: Fullscreen
 *
 * All elements share the same visibility state for smooth fade transitions.
 */

import { type JSX, Show } from "solid-js";
import { categoryColor, qualityLabel } from "../channel-display";
import { useIptvStore } from "../stores/iptv-store";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface PlayerOverlayProps {
  /** Whether the chrome layer is visible — drives smooth opacity transitions. */
  visible: boolean;
  /** Whether a channel is currently playing */
  hasSource: boolean;
  /** Whether the browser dialog is open (affects browse button label) */
  isBrowsing: boolean;
  /** Player control callbacks */
  onTogglePlayPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleBrowser: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayerOverlay(props: PlayerOverlayProps): JSX.Element {
  const store = useIptvStore();

  const channelMeta = () => store.activeChannelMeta();
  const qualityBadge = () => qualityLabel(channelMeta()?.quality ?? null);

  return (
    <>
      {/* ─── Top Overlay ─── */}
      <div
        class={`absolute top-0 left-0 right-0 z-20 transition-opacity duration-500 ease-out ${
          props.visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div class="flex items-start justify-between px-2 sm:px-4 pt-2 sm:pt-4">
          {/* Left: Browse Channels */}
          <button
            type="button"
            class="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={props.onToggleBrowser}
            tabIndex={props.isBrowsing ? -1 : 0}
            aria-label={
              props.isBrowsing ? "Close channel browser" : "Browse channels"
            }
          >
            {props.isBrowsing ? "Close" : "Browse Channels"}
          </button>

          {/* Center: Title + tags */}
          <Show when={channelMeta()}>
            {(meta) => (
              <div class="hidden md:flex flex-wrap items-center justify-center gap-2 sm:gap-3 absolute left-1/2 -translate-x-1/2">
                <h2 class="text-base sm:text-xl font-bold text-white drop-shadow-lg">
                  {meta().name}
                </h2>

                <Show when={meta().category}>
                  <span
                    class={`rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-semibold uppercase leading-tight shadow-md ${categoryColor(meta().category ?? "")}`}
                  >
                    {meta().category}
                  </span>
                </Show>

                <span
                  class={`rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold uppercase leading-tight shadow-md ${
                    qualityBadge() === "HD"
                      ? "bg-green-600 text-green-100"
                      : "bg-gray-500 text-gray-100"
                  }`}
                >
                  {qualityBadge()}
                </span>
              </div>
            )}
          </Show>

          {/* Right: Refresh + Copy */}
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => store.actions.refreshChannels()}
              disabled={store.state.isRefreshing}
              aria-label="Refresh channels"
              title="Refresh channels"
            >
              <svg
                class={`h-4 w-4 ${store.state.isRefreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>

            <Show when={store.streamSource()}>
              <div class="relative">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm gap-1.5 text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={store.actions.copyStreamUrl}
                  aria-label="Copy stream URL to clipboard"
                >
                  <svg
                    class="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  <span class="hidden sm:inline">Copy URL</span>
                </button>

                {/* Toast: "Copied!" */}
                <Show when={store.state.copyToast}>
                  <div
                    class="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-success-content shadow-lg animate-fade-in"
                    role="status"
                    aria-live="polite"
                  >
                    Copied!
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* ─── Bottom Overlay ─── */}
      <Show when={props.hasSource}>
        <div
          class={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent transition-opacity duration-500 ease-out px-3 sm:px-4 pb-2 sm:pb-3 pt-8 sm:pt-10 ${
            props.visible
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <div class="flex items-center justify-between">
            {/* Left: Play/Pause + Mute */}
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                onClick={props.onTogglePlayPause}
                aria-label={store.state.isPlaying ? "Pause" : "Play"}
              >
                <Show
                  when={store.state.isPlaying}
                  fallback={
                    <svg
                      class="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  }
                >
                  <svg
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </Show>
              </button>

              <button
                type="button"
                class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                onClick={props.onToggleMute}
                aria-label={store.state.isMuted ? "Unmute" : "Mute"}
              >
                <Show
                  when={store.state.isMuted}
                  fallback={
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
                  }
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
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                </Show>
              </button>
            </div>

            {/* Right: Fullscreen */}
            <button
              type="button"
              class="rounded-lg p-2 text-white/90 transition hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
              onClick={props.onToggleFullscreen}
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
      </Show>

      {/* ─── Fallback URL input (always interactive) ─── */}
      <Show when={store.state.copyFallbackUrl}>
        <div class="absolute bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
          <div class="flex items-center gap-2 rounded-lg bg-base-200/95 p-2 shadow-xl backdrop-blur">
            <input
              type="text"
              value={store.state.copyFallbackUrl ?? ""}
              readonly
              class="input input-bordered input-sm flex-1 text-xs font-mono"
              aria-label="Stream URL (read-only — copy manually)"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={store.actions.dismissFallback}
              aria-label="Dismiss URL input"
            >
              ✕
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
