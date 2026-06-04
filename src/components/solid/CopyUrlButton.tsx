/**
 * Copy Stream URL button — extracted clipboard concern.
 *
 * Fades in/out with the rest of the UI chrome via the `visible` prop.
 * Reads clip state from the IPTV store.
 *
 * Renders:
 * - The copy button (top-right, shown when a channel is playing)
 * - "Copied!" toast on success
 * - Fallback readonly input when Clipboard API is unavailable
 */

import { createEffect, Show } from "solid-js";
import { useIptvStore } from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface CopyUrlButtonProps {
  /** Whether the chrome layer is visible — drives a smooth opacity transition. */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CopyUrlButton(props: CopyUrlButtonProps) {
  const store = useIptvStore();
  let fallbackInputRef: HTMLInputElement | undefined;

  // Auto-select fallback input when it appears
  createEffect(() => {
    if (store.state.copyFallbackUrl) {
      requestAnimationFrame(() => fallbackInputRef?.select());
    }
  });

  return (
    <>
      {/* Button visible when a stream is playing (fades with chrome) */}
      <Show when={store.streamSource()}>
        <div
          class={`absolute top-2 sm:top-4 right-2 sm:right-4 z-20 transition-opacity duration-500 ease-out ${
            props.visible
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <div class="relative">
            <button
              type="button"
              class="btn btn-ghost btn-sm gap-1.5 text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={store.actions.copyStreamUrl}
              aria-label="Copy stream URL to clipboard"
            >
              {/* Clipboard icon */}
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
        </div>
      </Show>

      {/* Fallback: readonly input — always interactive (not tied to chrome visibility) */}
      <Show when={store.state.copyFallbackUrl}>
        <div class="absolute bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
          <div class="flex items-center gap-2 rounded-lg bg-base-200/95 p-2 shadow-xl backdrop-blur">
            <input
              ref={fallbackInputRef}
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
