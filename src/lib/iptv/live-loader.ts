/**
 * IPTV Live Loader for Astro Live Content Collections.
 *
 * Fetches channel/stream/feed data from https://iptv-org.github.io/api/,
 * filters to BR channels with working streams, and enriches each channel
 * with resolved categories, logos, and stream metadata.
 *
 * Uses module-level in-memory caching: data is fetched once per Worker
 * instance and reused across subsequent requests.
 */

import type { LiveLoader } from "astro/loaders";

// ---------------------------------------------------------------------------
// API base URL
// ---------------------------------------------------------------------------

const API_BASE = "https://iptv-org.github.io/api";

// ---------------------------------------------------------------------------
// Raw API types (what we receive from iptv-org JSON endpoints)
// ---------------------------------------------------------------------------

interface RawChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

interface RawStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  label: string | null;
  user_agent: string | null;
  referrer: string | null;
}

interface RawCategory {
  id: string;
  name: string;
  description: string;
}

interface RawFeed {
  channel: string;
  id: string;
  name: string;
  alt_names: string[];
  is_main: boolean;
  broadcast_area: string[];
  timezones: string[];
  languages: string[];
  format: string;
}

interface RawBlocklistEntry {
  channel: string;
  reason: string;
  ref: string;
}

// ---------------------------------------------------------------------------
// Enriched channel type (what we return from the loader)
// ---------------------------------------------------------------------------

export interface IptvStream {
  url: string;
  quality: string | null;
  format: string | null;
  label: string | null;
  referrer: string | null;
  user_agent: string | null;
}

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
  streams: IptvStream[];
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedEntries: Array<{ id: string; data: IptvChannel }> | null = null;
let cachedCategories: Map<string, string> | null = null;
let cacheError: string | null = null;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time to wait for any single iptv-org API request (15 seconds). */
const FETCH_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Helper: fetch JSON with timeout
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Create a timeout signal and combine it with any caller-provided signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    FETCH_TIMEOUT_MS,
  );

  let combinedSignal: AbortSignal;
  if (signal) {
    // If the caller already provided a signal, forward aborts in both directions
    combinedSignal = AbortSignal.any([signal, timeoutController.signal]);
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const response = await fetch(url, {
      signal: combinedSignal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `iptv-org API returned ${response.status} ${response.statusText} for ${url}`,
      );
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve category codes to human-readable names
// ---------------------------------------------------------------------------

async function getCategoryMap(
  signal?: AbortSignal,
  skipCache = false,
): Promise<Map<string, string>> {
  if (!skipCache && cachedCategories) return cachedCategories;

  const categories = await fetchJson<RawCategory[]>(
    `${API_BASE}/categories.json`,
    signal,
  );

  const map = new Map<string, string>();
  for (const cat of categories) {
    map.set(cat.id, cat.name);
  }

  cachedCategories = map;
  return map;
}

// ---------------------------------------------------------------------------
// Helper: build the logo URL from a channel ID
// ---------------------------------------------------------------------------

function getLogoUrl(channelId: string): string {
  return `https://iptv-org.github.io/iptv/logos/${channelId}.png`;
}

// ---------------------------------------------------------------------------
// Core enrichment: fetch all data, filter, join, and return enriched channels
// ---------------------------------------------------------------------------

export async function fetchAndEnrichChannels(
  signal?: AbortSignal,
  skipCache = false,
): Promise<Array<{ id: string; data: IptvChannel }>> {
  if (skipCache) {
    cachedCategories = null;
    cachedEntries = null;
    cacheError = null;
  }

  // Fetch all required data in parallel
  const [rawChannels, rawStreams, rawFeeds, rawBlocklist, categoryMap] =
    await Promise.all([
      fetchJson<RawChannel[]>(`${API_BASE}/channels.json`, signal),
      fetchJson<RawStream[]>(`${API_BASE}/streams.json`, signal),
      fetchJson<RawFeed[]>(`${API_BASE}/feeds.json`, signal),
      fetchJson<RawBlocklistEntry[]>(`${API_BASE}/blocklist.json`, signal),
      getCategoryMap(signal, skipCache),
    ]);

  // Build lookup structures
  const blockedChannelIds = new Set(rawBlocklist.map((b) => b.channel));

  // Index feeds by channel ID → feed ID for format lookup
  // (key: "channelId|feedId" → RawFeed)
  const feedByChannelAndId = new Map<string, RawFeed>();
  for (const feed of rawFeeds) {
    feedByChannelAndId.set(`${feed.channel}|${feed.id}`, feed);
  }

  // Index streams by channel ID
  const streamsByChannel = new Map<string, RawStream[]>();
  for (const stream of rawStreams) {
    if (!stream.channel) continue; // skip unlinked streams
    const existing = streamsByChannel.get(stream.channel) ?? [];
    existing.push(stream);
    streamsByChannel.set(stream.channel, existing);
  }

  // Filter channels: BR only, not closed, not replaced, not blocked,
  // and must have at least one stream
  const enriched: Array<{ id: string; data: IptvChannel }> = [];

  for (const ch of rawChannels) {
    // BR only
    if (ch.country !== "BR") continue;

    // Skip closed channels
    if (ch.closed) continue;

    // Skip replaced channels
    if (ch.replaced_by) continue;

    // Skip blocked channels
    if (blockedChannelIds.has(ch.id)) continue;

    // Skip channels without streams
    const streams = streamsByChannel.get(ch.id);
    if (!streams || streams.length === 0) continue;

    // Resolve category codes to names
    const categoryNames = ch.categories
      .map((code) => categoryMap.get(code) ?? code)
      .filter(Boolean);

    // Build stream objects preserving referrer/user_agent and enriching with feed format
    const iptvStreams: IptvStream[] = streams.map((s) => {
      const feedKey = s.feed ? `${ch.id}|${s.feed}` : null;
      const feed = feedKey ? feedByChannelAndId.get(feedKey) : null;
      return {
        url: s.url,
        quality: s.quality,
        format: feed?.format ?? null,
        label: s.label,
        referrer: s.referrer,
        user_agent: s.user_agent,
      };
    });

    enriched.push({
      id: ch.id,
      data: {
        id: ch.id,
        name: ch.name,
        alt_names: ch.alt_names,
        network: ch.network,
        country: ch.country,
        categories: categoryNames,
        is_nsfw: ch.is_nsfw,
        logo: getLogoUrl(ch.id),
        website: ch.website,
        streams: iptvStreams,
      },
    });
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Factory: createIptvLoader()
// ---------------------------------------------------------------------------

/**
 * Creates an Astro LiveLoader that fetches Brazilian IPTV channels
 * from https://iptv-org.github.io/api/.
 *
 * The loader uses module-level in-memory caching: data is fetched once
 * per Worker instance and reused across subsequent requests.
 *
 * @returns A LiveLoader object compatible with `defineLiveCollection()`.
 */
export function createIptvLoader(): LiveLoader<IptvChannel, { id: string }> {
  return {
    name: "iptv-loader",

    async loadCollection() {
      // If we previously had an error, return it (stale error cache)
      if (cacheError) {
        return { error: new Error(cacheError) };
      }

      // Return cached entries if available (warm request)
      if (cachedEntries) {
        return { entries: cachedEntries };
      }

      // Cold start: fetch and cache
      try {
        const entries = await fetchAndEnrichChannels();
        cachedEntries = entries;
        return { entries };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unknown error fetching IPTV data";
        cacheError = message;
        return { error: new Error(message) };
      }
    },

    async loadEntry({ filter }) {
      // Ensure collection is loaded (uses cache if available)
      if (cacheError) {
        return { error: new Error(cacheError) };
      }

      let entries = cachedEntries;

      if (!entries) {
        try {
          entries = await fetchAndEnrichChannels();
          cachedEntries = entries;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Unknown error fetching IPTV data";
          cacheError = message;
          return { error: new Error(message) };
        }
      }

      const entry = entries.find((e) => e.id === filter.id);
      if (!entry) return undefined;

      return entry;
    },
  };
}
