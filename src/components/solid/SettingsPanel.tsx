/**
 * Settings modal — FR-5.
 *
 * Lets the user supply / change their M3U playlist URL, refresh the active
 * playlist, or reset to the default. Openable from the gear icon in the
 * player top-overlay chrome (see `Overlay.tsx`) **or** programmatically
 * from the Empty-state CTA (see `IptvApp.tsx`) via `store.actions.openSettings`.
 *
 * Mirrors the `ChannelBrowser` overlay pattern: a `fixed inset-0 z-50`
 * dialog with a backdrop, focused on mount, Escape to close, and a
 * fade-in transition. Gated by `store.state.isSettingsOpen`, so every open
 * mounts a fresh component and the input prefills from the current store
 * state.
 *
 * Entry points:
 *  - **Save** — `saveUrl(draft)` (validates, persists, fetches, closes).
 *    `saveUrl` always fetches, so an unchanged URL still refreshes.
 *  - **Refresh now** — `refresh()` re-fetches the *active* playlist URL
 *    (not the draft in the input); the modal stays open so the status line
 *    updates live.
 *  - **Reset to default** — `resetToDefault()` clears the saved URL, sets
 *    the default, and fetches it; closes the modal.
 *
 * Status line: last-refreshed timestamp (`fetchedAt`) + the structured
 * error kind / message from the most recent fetch.
 */

import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { useIptvStore } from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an epoch-millis timestamp for the status line. */
function formatTimestamp(ms: number | null): string {
  if (!ms) return "never";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPanel(): JSX.Element {
  const store = useIptvStore();

  // Draft URL in the input. Initialised from the active playlist URL on each
  // open (the component is remounted by the gating <Show>).
  const [draft, setDraft] = createSignal(store.state.playlistUrl);
  const [validationError, setValidationError] = createSignal<string | null>(
    null,
  );

  let inputRef: HTMLInputElement | undefined;
  let overlayRef: HTMLDivElement | undefined;

  // ---- Keyboard handling (Escape to close) ----
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      store.actions.closeSettings();
      return;
    }
    // Focus trap within the overlay
    if (e.key === "Tab" && overlayRef) {
      const focusable = overlayRef.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === overlayRef) store.actions.closeSettings();
  }

  // ---- Actions ----

  /** Save the draft URL: validate, persist, fetch, close. */
  async function handleSave() {
    const trimmed = draft().trim();
    if (trimmed.length === 0) {
      setValidationError("Please enter a playlist URL.");
      return;
    }
    try {
      // Reject obviously invalid URLs early (best-effort; the server does the
      // authoritative validation and returns a structured kind).
      // eslint-disable-next-line no-new
      new URL(trimmed);
    } catch {
      setValidationError("That doesn't look like a valid URL.");
      return;
    }

    setValidationError(null);
    // saveUrl always calls fetchAndParse — so an unchanged URL still
    // triggers a refresh (FR-5 edge case).
    await store.actions.saveUrl(trimmed);
    store.actions.closeSettings();
  }

  /** Re-fetch the active playlist (not the draft); keep modal open. */
  async function handleRefreshNow() {
    await store.actions.refresh();
  }

  /** Reset to the default playlist; fetch it; close. */
  async function handleResetToDefault() {
    await store.actions.resetToDefault();
    // Reflect the reset in the input draft and close.
    setDraft(store.state.playlistUrl);
    store.actions.closeSettings();
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    void handleSave();
  }

  // ---- Lifecycle ----
  onMount(() => {
    inputRef?.focus();
    inputRef?.select();
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "";
  });

  // ---- Derived ----
  const isDefaultNotUserSet = () => store.state.isDefaultNotUserSet;
  const isRefreshing = () => store.state.isRefreshing;

  return (
    <div
      ref={overlayRef}
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") store.actions.closeSettings();
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Settings"
    >
      <div class="mx-4 w-full max-w-lg rounded-2xl bg-base-100 shadow-2xl">
        {/* Header */}
        <div class="flex shrink-0 items-center justify-between border-b border-base-300 px-5 py-3.5">
          <h2 class="text-lg font-bold text-base-content">Settings</h2>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Close settings"
            onClick={store.actions.closeSettings}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form class="px-5 py-4" onSubmit={handleSubmit}>
          {/* Playlist URL field */}
          <div class="form-control w-full">
            <div class="label justify-between py-1">
              <span class="label-text text-sm font-semibold">Playlist URL</span>
              <span
                class={`label-text-alt text-xs font-medium ${
                  isDefaultNotUserSet()
                    ? "text-base-content/50"
                    : "text-primary"
                }`}
              >
                {isDefaultNotUserSet()
                  ? "Default (not saved)"
                  : "Your playlist"}
              </span>
            </div>
            <input
              ref={inputRef}
              type="url"
              class="input input-bordered input-sm w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              placeholder="https://iptv-org.github.io/iptv/index.m3u"
              value={draft()}
              onInput={(e) => {
                setDraft(e.currentTarget.value);
                if (validationError()) setValidationError(null);
              }}
              aria-label="Playlist URL"
              aria-invalid={validationError() !== null}
              spellcheck={false}
              autocomplete="off"
            />
            <Show when={validationError()}>
              <p class="mt-1 text-xs text-error" role="alert">
                {validationError()}
              </p>
            </Show>
          </div>

          {/* Action row */}
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              class="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              disabled={isRefreshing()}
              aria-label="Save playlist URL"
            >
              <Show when={isRefreshing()} fallback="Save">
                Saving…
              </Show>
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => void handleRefreshNow()}
              disabled={isRefreshing()}
              aria-label="Refresh playlist now"
            >
              <svg
                class={`h-4 w-4 ${isRefreshing() ? "animate-spin" : ""}`}
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
              <Show when={isRefreshing()} fallback="Refresh now">
                Refreshing…
              </Show>
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm text-base-content/70 hover:text-error focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => void handleResetToDefault()}
              disabled={isRefreshing()}
              aria-label="Reset playlist to default"
            >
              Reset to default
            </button>
          </div>

          {/* Status line: last-refreshed + error */}
          <div class="mt-4 border-t border-base-300 pt-3">
            <p class="text-xs text-base-content/60">
              Last refreshed:{" "}
              <span class="font-medium text-base-content/80">
                {formatTimestamp(store.state.fetchedAt)}
              </span>
            </p>
            <Show when={store.state.refreshError}>
              <p class="mt-1 text-xs text-error" role="status">
                <span class="font-semibold uppercase">
                  {store.state.errorKind ?? "error"}
                </span>
                : {store.state.refreshError}
              </p>
            </Show>
            <Show when={!store.state.refreshError && store.state.errorKind}>
              <p class="mt-1 text-xs text-warning" role="status">
                <span class="font-semibold uppercase">
                  {store.state.errorKind}
                </span>
              </p>
            </Show>
          </div>
        </form>
      </div>
    </div>
  );
}
