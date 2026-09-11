/**
 * IPTV application store — the single source of truth for the generic M3U
 * player (FR-4 + FR-6).
 *
 * Responsibilities:
 *
 *   - **Playlist/cache load flow.** On mount, a returning user with a saved
 *     playlist URL renders the last-known channel list straight from the
 *     localStorage cache with **zero network requests**. A first-time visitor
 *     (no saved URL) auto-fetches the default playlist **once**. Network
 *     fetches otherwise happen only on explicit `refresh()`, `saveUrl(url)`,
 *     or `resetToDefault()`.
 *   - **View state.** A single `view: "Loading" | "Ready" | "Empty" | "Error"`
 *     drives what `IptvApp` renders, replacing the old SSR plumbing.
 *   - **Playback + chrome + clipboard + browsing state.** Carried over from
 *     the previous store, unchanged in shape.
 *
 * The channel model is the pure M3U {@link Channel} (`{ id, name, logo, url,
 * categories }`) returned by `POST /api/playlist` and consumed directly by
 * `IptvPlayer`, `ChannelBrowser`, and `ChannelCard`.
 *
 * Uses `createStore` + `produce` (project convention) for state mutations.
 */

import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Channel } from "@/lib/iptv/m3u-parser";
import {
  clearPlaylistUrl,
  DEFAULT_PLAYLIST_URL,
  getChannelCache,
  getPlaylistUrl,
  hasSavedPlaylistUrl,
  setChannelCache,
  setPlaylistUrl,
} from "@/lib/iptv/storage";
import type { StreamSource } from "../IptvPlayer";

// ---------------------------------------------------------------------------
// Channel DTO
// ---------------------------------------------------------------------------

/**
 * Minimal channel shape consumed by the browser overlay and channel cards.
 * Computed from a M3U {@link Channel} — only the fields the UI needs.
 */
export interface ChannelDTO {
  id: string;
  name: string;
  logo: string;
  categories: string[];
  /**
   * Placeholder quality badge for the channel card. The generic M3U parser
   * does not expose stream quality, so this defaults to `"SD"`. Narrowed by
   * a later task when the card no longer needs it.
   */
  quality: string;
}

// ---------------------------------------------------------------------------
// View state + structured fetch errors
// ---------------------------------------------------------------------------

/** Coarse render state for `IptvApp`. */
export type View = "Loading" | "Ready" | "Empty" | "Error";

/** Structured error kind returned by `POST /api/playlist` (FR-2). */
export type FetchErrorKind =
  | "invalid-url"
  | "fetch-failed"
  | "not-m3u"
  | "too-large"
  | "parse-error";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface IptvState {
  // ---- View / playlist load flow (FR-4) ----
  /** What `IptvApp` renders. */
  view: View;
  /** Playlist URL currently in use (saved URL or the default). */
  playlistUrl: string;
  /** `true` when `playlistUrl` is the default and the user has not saved one. */
  isDefaultNotUserSet: boolean;
  /** Epoch millis of the last successful fetch (from the cache record). */
  fetchedAt: number | null;
  /** Structured error kind from the last fetch failure (FR-2). */
  errorKind: FetchErrorKind | null;
  /** Human-readable error message from the last fetch failure. */
  refreshError: string | null;
  /** A fetch (refresh/save/reset) is in flight. */
  isRefreshing: boolean;

  // ---- Playback + chrome + browsing (carried over) ----
  /** Currently playing channel ID (null = no channel selected) */
  activeChannelId: string | null;
  /** Channel browser overlay visible */
  isBrowsing: boolean;
  /** All UI chrome visible (controls, overlays, buttons) — auto-hides on inactivity */
  showChrome: boolean;
  /** Client has hydrated (SSR skeleton → real content) */
  isHydrated: boolean;
  /** "Copied!" toast is showing */
  copyToast: boolean;
  /** Fallback URL when Clipboard API is unavailable */
  copyFallbackUrl: string | null;
  /** Video element is in a playing state */
  isPlaying: boolean;
  /** Video element is muted */
  isMuted: boolean;

  // ---- Settings modal (FR-5) ----
  /** Settings modal open? Openable from the gear icon or the Empty state CTA. */
  isSettingsOpen: boolean;
}

const INITIAL_STATE: IptvState = {
  view: "Loading",
  playlistUrl: DEFAULT_PLAYLIST_URL,
  isDefaultNotUserSet: true,
  fetchedAt: null,
  errorKind: null,
  refreshError: null,
  isRefreshing: false,
  activeChannelId: null,
  isBrowsing: false,
  showChrome: false,
  isHydrated: false,
  copyToast: false,
  copyFallbackUrl: null,
  isPlaying: false,
  isMuted: true,
  isSettingsOpen: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface IptvActions {
  /** Select a channel → start playback, close browser, persist to localStorage. */
  selectChannel: (id: string) => void;
  /** Toggle the channel browser overlay. */
  toggleBrowser: () => void;
  /** Close the channel browser overlay. */
  closeBrowser: () => void;
  /** Pointer activity detected — show all UI chrome and reset the auto-hide timer. */
  resetChromeTimer: () => void;
  /** Hide all UI chrome immediately. */
  clearChromeTimer: () => void;
  /** Complete client hydration + restore last watched channel from localStorage. */
  hydrate: () => void;
  /** Copy the active channel's stream URL to the clipboard. */
  copyStreamUrl: () => Promise<void>;
  /** Dismiss the fallback URL input. */
  dismissFallback: () => void;
  /** Update playback state (isPlaying, isMuted) from the video element. */
  updatePlaybackState: (partial: {
    isPlaying?: boolean;
    isMuted?: boolean;
  }) => void;

  // ---- Playlist load flow (FR-4 / FR-6) ----
  /** Low-level: fetch+parse `url` via `POST /api/playlist`, update state+cache. */
  fetchAndParse: (url: string) => Promise<void>;
  /** Re-fetch the current playlist URL (single action for all entry points). */
  refresh: () => Promise<void>;
  /** Persist a new user URL, mark user-set, and fetch it. */
  saveUrl: (url: string) => Promise<void>;
  /** Forget the saved URL, fall back to the default, and fetch it. */
  resetToDefault: () => Promise<void>;

  // ---- Settings modal (FR-5) ----
  /** Open the Settings modal (also used by the Empty state CTA). */
  openSettings: () => void;
  /** Close the Settings modal. */
  closeSettings: () => void;
  /** Toggle the Settings modal open/closed. */
  toggleSettings: () => void;
}

// ---------------------------------------------------------------------------
// Store (state + actions + derived memos)
// ---------------------------------------------------------------------------

export interface IptvStore {
  state: IptvState;
  actions: IptvActions;
  /** Reactive channel ID → full M3U Channel lookup */
  channelMap: () => Map<string, Channel>;
  /** Reactive StreamSource for the active channel (null when none) */
  streamSource: () => StreamSource | null;
  /** Reactive ChannelDTO[] for the browser overlay */
  channelDTOs: () => ChannelDTO[];
  /** Reactive metadata for the channel overlay */
  activeChannelMeta: () => {
    name: string;
    category: string | null;
    quality: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const IptvContext = createContext<IptvStore>();

/** Access the IPTV store from any descendant of `<IptvProvider>`. */
export function useIptvStore(): IptvStore {
  const ctx = useContext(IptvContext);
  if (!ctx) throw new Error("useIptvStore must be used within <IptvProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// localStorage keys (carried over)
// ---------------------------------------------------------------------------

const LS_LAST_CHANNEL_KEY = "m3o-open-tv-last-channel";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function getChannelFromQuery(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("channel");
  } catch {
    return null;
  }
}

function setChannelQuery(id: string | null) {
  try {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("channel", id);
    } else {
      url.searchParams.delete("channel");
    }
    history.replaceState(null, "", url.toString());
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Initial load from cache / saved URL (client-side; SSR-safe)
// ---------------------------------------------------------------------------

interface InitialLoad {
  channels: Channel[];
  playlistUrl: string;
  isDefaultNotUserSet: boolean;
  fetchedAt: number | null;
  /** True when the default playlist must be auto-fetched on first run. */
  needsAutoFetch: boolean;
}

/** Read saved URL + cache to produce the initial in-memory state. */
function loadInitial(): InitialLoad {
  const savedUrl = hasSavedPlaylistUrl();
  const playlistUrl = getPlaylistUrl();
  const isDefaultNotUserSet = !savedUrl;
  const cache = getChannelCache();

  if (cache && cache.url === playlistUrl) {
    // Returning user (or a default that was already fetched once): render from
    // cache instantly with NO network fetch.
    return {
      channels: cache.channels,
      playlistUrl,
      isDefaultNotUserSet,
      fetchedAt: cache.fetchedAt,
      needsAutoFetch: false,
    };
  }

  // No matching cache. A first-time visitor (default, not user-set) auto-fetches
  // the default playlist once. A returning user with a saved URL but a missing
  // / mismatched cache does NOT auto-fetch — they hit Refresh (FR-4).
  return {
    channels: [],
    playlistUrl,
    isDefaultNotUserSet,
    fetchedAt: null,
    needsAutoFetch: isDefaultNotUserSet,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface IptvProviderProps {
  children: JSX.Element;
}

export function IptvProvider(props: IptvProviderProps) {
  // ---- Initial load (cache / saved URL) ----
  const initial = loadInitial();

  const [state, setState] = createStore<IptvState>({
    ...INITIAL_STATE,
    playlistUrl: initial.playlistUrl,
    isDefaultNotUserSet: initial.isDefaultNotUserSet,
    fetchedAt: initial.fetchedAt,
    // Start at "Loading" so the client's initial render matches the SSR
    // output (no localStorage on the server). The real view is resolved in
    // onMount, after hydration, mirroring the old isHydrated rAF pattern.
    view: "Loading",
  });

  // ---- Reactive channel list (in-memory; updated by fetchAndParse) ----
  const [channels, setChannels] = createSignal<Channel[]>(initial.channels);

  // ---- Managed timers (outside reactive graph — manual cleanup) ----
  let chromeTimer: ReturnType<typeof setTimeout> | null = null;
  let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Derived data (memoised) ----

  const channelMap = createMemo(() => {
    const map = new Map<string, Channel>();
    for (const ch of channels()) {
      map.set(ch.id, ch);
    }
    return map;
  });

  const streamSource = createMemo<StreamSource | null>(() => {
    const id = state.activeChannelId;
    if (!id) return null;
    const channel = channelMap().get(id);
    return channel?.url ? { url: channel.url } : null;
  });

  const channelDTOs = createMemo<ChannelDTO[]>(() =>
    channels().map((ch) => ({
      id: ch.id,
      name: ch.name,
      logo: ch.logo,
      categories: ch.categories,
      quality: "SD",
    })),
  );

  const activeChannelMeta = createMemo(() => {
    const id = state.activeChannelId;
    if (!id) return null;
    const channel = channelMap().get(id);
    if (!channel) return null;
    return {
      name: channel.name,
      category: channel.categories[0] ?? null,
      quality: "SD",
    };
  });

  // ---- Internal helpers ----

  function resetChromeTimer() {
    if (chromeTimer !== null) clearTimeout(chromeTimer);
    setState("showChrome", true);
    if (state.activeChannelId) {
      chromeTimer = setTimeout(() => setState("showChrome", false), 3000);
    }
  }

  /** Clear the active channel when it no longer exists in `next`. */
  function clearActiveIfGone(next: Channel[]) {
    const currentId = state.activeChannelId;
    if (currentId && !next.some((c) => c.id === currentId)) {
      setState("activeChannelId", null);
      setChannelQuery(null);
      try {
        localStorage.removeItem(LS_LAST_CHANNEL_KEY);
      } catch {
        // localStorage unavailable
      }
    }
  }

  // ---- Playlist fetch (FR-2 → FR-4) ----

  async function fetchAndParse(url: string): Promise<void> {
    setState(
      produce((s: IptvState) => {
        s.isRefreshing = true;
        s.errorKind = null;
        s.refreshError = null;
        s.playlistUrl = url;
      }),
    );

    let res: Response;
    try {
      res = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch {
      // Network/abort failure — treat as fetch-failed.
      setState(
        produce((s: IptvState) => {
          s.isRefreshing = false;
          s.errorKind = "fetch-failed";
          s.refreshError = "Network request failed";
          if (channels().length === 0) {
            s.view = s.isDefaultNotUserSet ? "Empty" : "Error";
          }
        }),
      );
      return;
    }

    if (!res.ok) {
      let kind: FetchErrorKind = "fetch-failed";
      let message = `Request failed (${res.status} ${res.statusText})`;
      try {
        const body = (await res.json()) as {
          error?: string;
          kind?: FetchErrorKind;
        };
        if (body.kind) kind = body.kind;
        if (body.error) message = body.error;
      } catch {
        // Non-JSON error body — keep the defaults.
      }
      setState(
        produce((s: IptvState) => {
          s.isRefreshing = false;
          s.errorKind = kind;
          s.refreshError = message;
          if (channels().length === 0) {
            // First-run default failure → Empty (no loop-retry); any other
            // no-channel failure → Error so the user can act on it.
            s.view = s.isDefaultNotUserSet ? "Empty" : "Error";
          }
        }),
      );
      return;
    }

    let data: { channels?: Channel[]; fetchedAt?: number };
    try {
      data = await res.json();
    } catch {
      setState(
        produce((s: IptvState) => {
          s.isRefreshing = false;
          s.errorKind = "parse-error";
          s.refreshError = "Invalid response from server";
          if (channels().length === 0) {
            s.view = s.isDefaultNotUserSet ? "Empty" : "Error";
          }
        }),
      );
      return;
    }

    const nextChannels = Array.isArray(data.channels) ? data.channels : [];
    const fetchedAt =
      typeof data.fetchedAt === "number" ? data.fetchedAt : Date.now();

    setChannels(nextChannels);
    clearActiveIfGone(nextChannels);

    // Persist the cache + (this URL is now the active playlist).
    setChannelCache({
      url,
      channels: nextChannels,
      fetchedAt,
    });

    setState(
      produce((s: IptvState) => {
        s.isRefreshing = false;
        s.errorKind = null;
        s.refreshError = null;
        s.fetchedAt = fetchedAt;
        s.view = nextChannels.length > 0 ? "Ready" : "Empty";
      }),
    );
  }

  // ---- Actions ----

  const actions: IptvActions = {
    selectChannel(id: string) {
      setState("activeChannelId", id);
      setState("isBrowsing", false);
      resetChromeTimer();
      try {
        localStorage.setItem(LS_LAST_CHANNEL_KEY, id);
      } catch {
        // localStorage unavailable — silently ignore
      }
      setChannelQuery(id);
    },

    toggleBrowser() {
      setState("isBrowsing", (prev) => !prev);
    },

    closeBrowser() {
      setState("isBrowsing", false);
    },

    resetChromeTimer: () => resetChromeTimer(),

    clearChromeTimer: () => {
      if (chromeTimer !== null) {
        clearTimeout(chromeTimer);
        chromeTimer = null;
      }
      setState("showChrome", false);
    },

    hydrate() {
      // URL query param takes priority over localStorage so shared links work.
      try {
        const queryId = getChannelFromQuery();
        if (queryId && channelMap().has(queryId)) {
          setState("activeChannelId", queryId);
        } else {
          const savedId = localStorage.getItem(LS_LAST_CHANNEL_KEY);
          if (savedId && channelMap().has(savedId)) {
            setState("activeChannelId", savedId);
            setChannelQuery(savedId);
          } else if (savedId) {
            localStorage.removeItem(LS_LAST_CHANNEL_KEY);
          }
        }
      } catch {
        // localStorage unavailable
      }
      // Small delay so the skeleton is visible for a frame even on fast hydration
      requestAnimationFrame(() => setState("isHydrated", true));
    },

    async copyStreamUrl() {
      const source = streamSource();
      if (!source?.url) return;

      setState("copyFallbackUrl", null);

      try {
        if (!navigator.clipboard?.writeText) {
          setState("copyFallbackUrl", source.url);
          return;
        }
        await navigator.clipboard.writeText(source.url);
        setState("copyToast", true);
        if (copyToastTimer !== null) clearTimeout(copyToastTimer);
        copyToastTimer = setTimeout(() => setState("copyToast", false), 2000);
      } catch {
        setState("copyFallbackUrl", source.url);
      }
    },

    dismissFallback() {
      setState("copyFallbackUrl", null);
    },

    updatePlaybackState(partial) {
      if (partial.isPlaying !== undefined)
        setState("isPlaying", partial.isPlaying);
      if (partial.isMuted !== undefined) setState("isMuted", partial.isMuted);
    },

    fetchAndParse,

    async refresh() {
      await fetchAndParse(state.playlistUrl);
    },

    async saveUrl(url: string) {
      const trimmed = url.trim();
      if (trimmed.length === 0) return;
      setPlaylistUrl(trimmed);
      setState(
        produce((s: IptvState) => {
          s.playlistUrl = trimmed;
          s.isDefaultNotUserSet = false;
        }),
      );
      await fetchAndParse(trimmed);
    },

    async resetToDefault() {
      clearPlaylistUrl();
      setState(
        produce((s: IptvState) => {
          s.playlistUrl = DEFAULT_PLAYLIST_URL;
          s.isDefaultNotUserSet = true;
        }),
      );
      await fetchAndParse(DEFAULT_PLAYLIST_URL);
    },

    openSettings() {
      setState("isSettingsOpen", true);
    },

    closeSettings() {
      setState("isSettingsOpen", false);
    },

    toggleSettings() {
      setState("isSettingsOpen", (prev) => !prev);
    },
  };

  // ---- Auto-show chrome when channel changes ----
  createEffect(() => {
    const id = state.activeChannelId;
    if (id) {
      resetChromeTimer();
    } else {
      setState("showChrome", false);
      if (chromeTimer !== null) {
        clearTimeout(chromeTimer);
        chromeTimer = null;
      }
    }
  });

  // ---- Resolve the real view + first-run auto-fetch (after hydration) ----
  onMount(() => {
    if (channels().length > 0) {
      // Returning user (cache hit) — render from cache, NO network fetch.
      setState("view", "Ready");
    } else if (initial.needsAutoFetch) {
      // First-time visitor — auto-fetch the default playlist once.
      // view stays "Loading" until fetchAndParse resolves.
      void fetchAndParse(initial.playlistUrl);
    } else {
      // Saved URL but no matching cache — nothing to render, no auto-fetch.
      setState("view", "Empty");
    }
  });

  // ---- Cleanup timers on unmount ----
  onCleanup(() => {
    if (chromeTimer !== null) clearTimeout(chromeTimer);
    if (copyToastTimer !== null) clearTimeout(copyToastTimer);
  });

  const store: IptvStore = {
    state,
    actions,
    channelMap,
    streamSource,
    channelDTOs,
    activeChannelMeta,
  };

  return (
    <IptvContext.Provider value={store}>{props.children}</IptvContext.Provider>
  );
}
