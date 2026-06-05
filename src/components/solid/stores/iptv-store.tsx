/**
 * IPTV application store — the single source of truth for playback state,
 * browsing toggle, hydration status, UI chrome visibility, and clipboard actions.
 *
 * Uses SolidJS `createStore` (like React's useReducer but with fine-grained
 * reactivity) wrapped in a context provider so any descendant component can
 * access state and dispatch actions without prop-drilling.
 *
 * Derived data (channel lookups, stream sources, DTOs) are reactive memos
 * off the store, computed once and cached until dependencies change.
 */

import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import type { StreamSource } from "../IptvPlayer";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/**
 * Raw channel shape arriving from the IPTV live loader (server-side).
 * Defined here so the client component owns its contract without importing
 * server-only modules.
 */
export interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  country: string;
  categories: string[];
  is_nsfw: boolean;
  logo: string;
  website: string | null;
  streams: Array<{
    url: string;
    quality: string | null;
    format: string | null;
    label: string | null;
    referrer: string | null;
    user_agent: string | null;
  }>;
}

/**
 * Minimal channel shape consumed by the browser overlay and channel cards.
 * Computed from `IptvChannel` — only the fields the UI needs.
 */
export interface ChannelDTO {
  id: string;
  name: string;
  logo: string;
  categories: string[];
  is_nsfw: boolean;
  quality: string;
  alt_names?: string[];
  network?: string | null;
  country?: string;
}

// ---------------------------------------------------------------------------
// Mappers: IptvChannel → child component props
// ---------------------------------------------------------------------------

/** Extract the best `StreamSource` from the first available stream. */
export function toStreamSource(channel: IptvChannel): StreamSource | null {
  const stream = channel.streams[0];
  if (!stream) return null;
  return {
    url: stream.url,
    referrer: stream.referrer,
    user_agent: stream.user_agent,
  };
}

/** Map an `IptvChannel` to the `ChannelDTO` shape consumed by ChannelCard. */
export function toChannelDTO(channel: IptvChannel): ChannelDTO {
  const bestStream = channel.streams[0];
  return {
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    categories: channel.categories,
    is_nsfw: channel.is_nsfw,
    quality: bestStream?.quality ?? "SD",
    alt_names: channel.alt_names,
    network: channel.network,
    country: channel.country,
  };
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface IptvState {
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
  /** Channel list is being refreshed */
  isRefreshing: boolean;
  /** Error message from the last refresh attempt */
  refreshError: string | null;
  /** Video element is in a playing state */
  isPlaying: boolean;
  /** Video element is muted */
  isMuted: boolean;
}

const INITIAL_STATE: IptvState = {
  activeChannelId: null,
  isBrowsing: false,
  showChrome: false,
  isHydrated: false,
  copyToast: false,
  copyFallbackUrl: null,
  isRefreshing: false,
  refreshError: null,
  isPlaying: false,
  isMuted: true,
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
  /** Re-fetch the channel list from the server. */
  refreshChannels: () => Promise<void>;
  /** Update playback state (isPlaying, isMuted) from the video element. */
  updatePlaybackState: (partial: {
    isPlaying?: boolean;
    isMuted?: boolean;
  }) => void;
}

// ---------------------------------------------------------------------------
// Store (state + actions + derived memos)
// ---------------------------------------------------------------------------

export interface IptvStore {
  state: IptvState;
  actions: IptvActions;
  /** Reactive channel ID → full IptvChannel lookup */
  channelMap: () => Map<string, IptvChannel>;
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
// localStorage key
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
// Provider
// ---------------------------------------------------------------------------

export interface IptvProviderProps {
  channels: IptvChannel[];
  serverError?: string | null;
  children: JSX.Element;
}

export function IptvProvider(props: IptvProviderProps) {
  const [state, setState] = createStore<IptvState>({ ...INITIAL_STATE });

  // ---- Reactive channel list (can be refreshed from client) ----
  const [channels, setChannels] = createSignal<IptvChannel[]>(props.channels);

  // ---- Managed timers (outside reactive graph — manual cleanup) ----
  let chromeTimer: ReturnType<typeof setTimeout> | null = null;
  let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Derived data (memoised) ----

  const channelMap = createMemo(() => {
    const map = new Map<string, IptvChannel>();
    for (const ch of channels()) {
      map.set(ch.id, ch);
    }
    return map;
  });

  const streamSource = createMemo<StreamSource | null>(() => {
    const id = state.activeChannelId;
    if (!id) return null;
    const channel = channelMap().get(id);
    return channel ? toStreamSource(channel) : null;
  });

  const channelDTOs = createMemo<ChannelDTO[]>(() =>
    channels().map(toChannelDTO),
  );

  const activeChannelMeta = createMemo(() => {
    const id = state.activeChannelId;
    if (!id) return null;
    const channel = channelMap().get(id);
    if (!channel) return null;
    return {
      name: channel.name,
      category: channel.categories[0] ?? null,
      quality: channel.streams[0]?.quality ?? "SD",
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

    async refreshChannels() {
      setState("isRefreshing", true);
      setState("refreshError", null);
      try {
        const res = await fetch("/api/channels");
        if (!res.ok) {
          throw new Error(`Failed to refresh: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (!Array.isArray(data.channels)) {
          throw new Error("Invalid response from server");
        }
        const newChannels = data.channels as IptvChannel[];
        setChannels(newChannels);

        // If the active channel disappeared, clear it
        const currentId = state.activeChannelId;
        if (currentId && !newChannels.some((c) => c.id === currentId)) {
          setState("activeChannelId", null);
          setChannelQuery(null);
          try {
            localStorage.removeItem(LS_LAST_CHANNEL_KEY);
          } catch {
            // localStorage unavailable
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refresh failed";
        setState("refreshError", message);
      } finally {
        setState("isRefreshing", false);
      }
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

// ---------------------------------------------------------------------------
// App props — what the Astro wrapper passes in
// ---------------------------------------------------------------------------

export interface IptvAppProps {
  /** Array of enriched channels from the IPTV live collection */
  channels: IptvChannel[];
  /** Server-side error message (collection fetch failed) */
  serverError?: string | null;
}

// ---------------------------------------------------------------------------
// Server error is not reactive (it's a static prop), but components
// need it alongside the store.  We expose a convenience helper.
// ---------------------------------------------------------------------------

/** Expose server error and data-ready status alongside the store. */
export function useAppState(
  store: IptvStore,
  serverError: string | null | undefined,
) {
  const hasChannels = () => store.channelMap().size > 0;
  const hasError = () => !!serverError;
  const isLoading = () => !store.state.isHydrated && hasChannels();
  const isEmpty = () => !hasError() && !hasChannels();

  return { hasChannels, hasError, isLoading, isEmpty, serverError };
}
