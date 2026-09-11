/**
 * Client-side localStorage helpers for the Open TV player (FR-3).
 *
 * Two persisted entries back the generic-M3U flow:
 *
 *   - `m3o-open-tv-playlist-url` — the user's current playlist URL (a string).
 *   - `m3o-open-tv-channels-cache` — a JSON blob of shape
 *     `{ url, channels, fetchedAt }` so a fresh page load can render the
 *     last-known channel list immediately while a refresh is in flight.
 *
 * The existing keys (`m3o-open-tv-last-channel`, `m3o-open-tv-search`,
 * `m3o-open-tv-categories`) are **not** touched here — they remain owned by
 * the components that introduced them.
 *
 * All helpers are SSR-safe: Astro renders pages on the server, where
 * `localStorage` is undefined, so every access is wrapped in a `try/catch`
 * and degrades to a no-op / sensible default instead of throwing.
 *
 * `# ponytail: just typed wrappers over localStorage — no dep, no abstraction layer.`
 */

import type { Channel } from "./m3u-parser";

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** localStorage key for the user's current playlist URL. */
const LS_PLAYLIST_URL_KEY = "m3o-open-tv-playlist-url";

/** localStorage key for the parsed-channel cache blob. */
const LS_CHANNELS_CACHE_KEY = "m3o-open-tv-channels-cache";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Playlist URL used on first run (when the user has not set one yet).
 *
 * This is a **client-side** constant — the server never reads it — because the
 * playlist is fetched directly from the browser per FR-2. The iptv-org index
 * is a reasonable, well-maintained default that works out of the box.
 */
export const DEFAULT_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";

// ---------------------------------------------------------------------------
// Playlist URL
// ---------------------------------------------------------------------------

/**
 * Read the persisted playlist URL, falling back to {@link DEFAULT_PLAYLIST_URL}
 * when nothing is stored (or localStorage is unavailable / SSR).
 */
export function getPlaylistUrl(): string {
  try {
    const stored = localStorage.getItem(LS_PLAYLIST_URL_KEY);
    return stored && stored.length > 0 ? stored : DEFAULT_PLAYLIST_URL;
  } catch {
    return DEFAULT_PLAYLIST_URL;
  }
}

/**
 * Persist the user's playlist URL. A no-op when localStorage is unavailable
 * (SSR, privacy mode, quota errors). Empty/whitespace values are ignored so
 * we never store a broken URL.
 */
export function setPlaylistUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed.length === 0) return;
    localStorage.setItem(LS_PLAYLIST_URL_KEY, trimmed);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Returns `true` when the user has explicitly saved a playlist URL (a
 * non-empty value at {@link LS_PLAYLIST_URL_KEY}). Used to distinguish a
 * first-run visitor (default playlist, not user-set) from a returning user
 * who picked their own URL. SSR-safe.
 */
export function hasSavedPlaylistUrl(): boolean {
  try {
    const stored = localStorage.getItem(LS_PLAYLIST_URL_KEY);
    return stored !== null && stored.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Clear the saved playlist URL so the player falls back to
 * {@link DEFAULT_PLAYLIST_URL}. A no-op when localStorage is unavailable.
 */
export function clearPlaylistUrl(): void {
  try {
    localStorage.removeItem(LS_PLAYLIST_URL_KEY);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Channel cache
// ---------------------------------------------------------------------------

/** Shape of the cached-channel blob persisted at `m3o-open-tv-channels-cache`. */
export interface ChannelCache {
  /** The playlist URL the channels were fetched from. */
  url: string;
  /** Parsed channels from the last successful fetch. */
  channels: Channel[];
  /** Epoch millis of the fetch that produced `channels`. */
  fetchedAt: number;
}

/**
 * Read the cached-channel blob, or `null` when nothing valid is stored (or
 * localStorage is unavailable / SSR / corrupt JSON).
 */
export function getChannelCache(): ChannelCache | null {
  try {
    const raw = localStorage.getItem(LS_CHANNELS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChannelCache;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.url !== "string" ||
      !Array.isArray(parsed.channels) ||
      typeof parsed.fetchedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist the cached-channel blob. A no-op when localStorage is unavailable.
 */
export function setChannelCache(cache: ChannelCache): void {
  try {
    localStorage.setItem(LS_CHANNELS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable — silently ignore
  }
}
