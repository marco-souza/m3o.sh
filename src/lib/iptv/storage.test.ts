import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { Channel } from "@/lib/iptv/m3u-parser";
import {
  type ChannelCache,
  DEFAULT_PLAYLIST_URL,
  getChannelCache,
  getPlaylistUrl,
  setChannelCache,
  setPlaylistUrl,
} from "@/lib/iptv/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAYLIST_KEY = "m3o-open-tv-playlist-url";
const CACHE_KEY = "m3o-open-tv-channels-cache";

const sampleChannel: Channel = {
  id: "abc",
  name: "Foo",
  logo: "L",
  url: "http://stream/foo",
  categories: ["News"],
};

const sampleCache: ChannelCache = {
  url: "https://example.com/playlist.m3u",
  channels: [sampleChannel],
  fetchedAt: 1_700_000_000_000,
};

/** A fresh in-memory localStorage backed by a Map. */
function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("storage helpers", () => {
  let originalLocalStorage: typeof globalThis.localStorage;
  let storage: Storage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    storage = makeStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  // ---- DEFAULT_PLAYLIST_URL ----

  describe("DEFAULT_PLAYLIST_URL", () => {
    test("is the iptv-org index URL", () => {
      expect(DEFAULT_PLAYLIST_URL).toBe(
        "https://iptv-org.github.io/iptv/index.m3u",
      );
    });
  });

  // ---- playlist URL ----

  describe("playlist URL helper", () => {
    test("getPlaylistUrl returns default when nothing stored", () => {
      expect(getPlaylistUrl()).toBe(DEFAULT_PLAYLIST_URL);
    });

    test("setPlaylistUrl then getPlaylistUrl round-trips the value", () => {
      const url = "https://example.com/my.m3u";
      setPlaylistUrl(url);
      expect(storage.getItem(PLAYLIST_KEY)).toBe(url);
      expect(getPlaylistUrl()).toBe(url);
    });

    test("setPlaylistUrl trims whitespace", () => {
      setPlaylistUrl("  https://example.com/x.m3u  ");
      expect(storage.getItem(PLAYLIST_KEY)).toBe("https://example.com/x.m3u");
    });

    test("setPlaylistUrl ignores empty input", () => {
      setPlaylistUrl("   ");
      expect(storage.getItem(PLAYLIST_KEY)).toBeNull();
    });

    test("getPlaylistUrl falls back to default when stored value is empty", () => {
      storage.setItem(PLAYLIST_KEY, "");
      expect(getPlaylistUrl()).toBe(DEFAULT_PLAYLIST_URL);
    });

    test("falls back to default when localStorage throws", () => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get: () => {
          throw new Error("SSR");
        },
      });
      expect(getPlaylistUrl()).toBe(DEFAULT_PLAYLIST_URL);
      // setPlaylistUrl must not throw either
      expect(() => setPlaylistUrl("https://example.com/x.m3u")).not.toThrow();
    });
  });

  // ---- channel cache ----

  describe("channel cache helper", () => {
    test("getChannelCache returns null when nothing stored", () => {
      expect(getChannelCache()).toBeNull();
    });

    test("setChannelCache then getChannelCache round-trips the blob", () => {
      setChannelCache(sampleCache);
      expect(getChannelCache()).toEqual(sampleCache);
    });

    test("stored payload is JSON at the cache key", () => {
      setChannelCache(sampleCache);
      expect(storage.getItem(CACHE_KEY)).toBe(JSON.stringify(sampleCache));
    });

    test("getChannelCache rejects malformed JSON", () => {
      storage.setItem(CACHE_KEY, "{not json");
      expect(getChannelCache()).toBeNull();
    });

    test("getChannelCache validates field types", () => {
      storage.setItem(
        CACHE_KEY,
        JSON.stringify({ url: 1, channels: [], fetchedAt: 1 }),
      );
      expect(getChannelCache()).toBeNull();

      storage.setItem(
        CACHE_KEY,
        JSON.stringify({ url: "u", channels: "nope", fetchedAt: 1 }),
      );
      expect(getChannelCache()).toBeNull();

      storage.setItem(
        CACHE_KEY,
        JSON.stringify({ url: "u", channels: [], fetchedAt: "1" }),
      );
      expect(getChannelCache()).toBeNull();
    });

    test("returns null when localStorage throws", () => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get: () => {
          throw new Error("SSR");
        },
      });
      expect(getChannelCache()).toBeNull();
      expect(() => setChannelCache(sampleCache)).not.toThrow();
    });
  });

  // ---- untouched keys ----

  describe("existing keys are untouched", () => {
    test("does not read or write last-channel/search/categories keys", () => {
      const spies = {
        getItem: mock((key: string) => storage.getItem(key)),
        setItem: mock((key: string, value: string) =>
          storage.setItem(key, value),
        ),
      };
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
          ...storage,
          getItem: spies.getItem,
          setItem: spies.setItem,
        },
      });

      getPlaylistUrl();
      setPlaylistUrl("https://example.com/x.m3u");
      getChannelCache();
      setChannelCache(sampleCache);

      const touched = [
        ...spies.getItem.mock.calls.map((c) => c[0]),
        ...spies.setItem.mock.calls.map((c) => c[0]),
      ];
      expect(touched).not.toContain("m3o-open-tv-last-channel");
      expect(touched).not.toContain("m3o-open-tv-search");
      expect(touched).not.toContain("m3o-open-tv-categories");
      expect(touched).toContain(PLAYLIST_KEY);
      expect(touched).toContain(CACHE_KEY);
    });
  });
});
