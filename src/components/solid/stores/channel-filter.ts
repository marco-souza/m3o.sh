/**
 * Channel browser filter state — a custom reactive primitive.
 *
 * Encapsulates search, category, and NSFW filtering with localStorage
 * persistence.  Returned as a plain object of signals, memos, and actions
 * (not a context) because filter state is local to ChannelBrowser.
 *
 * Usage:
 *   const filter = createChannelFilter(() => channelDTOs);
 *   // filter.search, filter.searchTerm, filter.selectedCategory, ...
 *   // filter.filteredChannels, filter.availableCategories, ...
 *   // filter.setSearch, filter.toggleCategory, ...
 */

import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { ChannelDTO } from "./iptv-store";

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const LS_SEARCH_KEY = "m3o-open-tv-search";
const LS_CATEGORIES_KEY = "m3o-open-tv-categories";
const LS_NSFW_KEY = "m3o-open-tv-nsfw";

// ---------------------------------------------------------------------------
// Debounced signal hook
// ---------------------------------------------------------------------------

/** Returns a read-only signal that lags behind `source` by `ms` milliseconds. */
function useDebounced<T>(source: () => T, ms: number) {
  const [debounced, setDebounced] = createSignal<T>(source());
  let timer: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    const val = source();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => setDebounced(() => val), ms);
  });

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer);
  });

  return debounced;
}

// ---------------------------------------------------------------------------
// Persisted filter state (loaded once, saved on change)
// ---------------------------------------------------------------------------

function loadPersistedFilter(): {
  search: string;
  category: string | null;
  nsfw: boolean;
} {
  try {
    const raw = localStorage.getItem(LS_CATEGORIES_KEY);
    const category = raw && raw.length > 0 ? raw : null;
    return {
      search: localStorage.getItem(LS_SEARCH_KEY) ?? "",
      category,
      nsfw: localStorage.getItem(LS_NSFW_KEY) === "true",
    };
  } catch {
    return { search: "", category: null, nsfw: false };
  }
}

function persistFilter(search: string, category: string | null, nsfw: boolean) {
  try {
    localStorage.setItem(LS_SEARCH_KEY, search);
    localStorage.setItem(LS_CATEGORIES_KEY, category ?? "");
    localStorage.setItem(LS_NSFW_KEY, String(nsfw));
  } catch {
    // localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ChannelFilter {
  // ---- Signals (read) ----
  search: () => string;
  searchTerm: () => string; // debounced
  selectedCategory: () => string | null;
  showNsfw: () => boolean;

  // ---- Derived (read) ----
  availableCategories: () => string[];
  filteredChannels: () => ChannelDTO[];
  filteredCount: () => number;
  hasActiveFilters: () => boolean;

  // ---- Actions ----
  setSearch: (value: string) => void;
  toggleCategory: (cat: string) => void;
  toggleNsfw: () => void;
  setNsfw: (value: boolean) => void;
  clearFilters: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a channel filter primitive.
 *
 * @param channels — Reactive getter returning the full (unfiltered) channel list.
 *                   Typically `(() => store.channelDTOs())`.
 */
export function createChannelFilter(
  channels: () => ChannelDTO[],
): ChannelFilter {
  const saved = loadPersistedFilter();

  const [search, setSearch] = createSignal(saved.search);
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(
    saved.category,
  );
  const [showNsfw, setShowNsfw] = createSignal(saved.nsfw);
  const searchTerm = useDebounced(search, 150);

  // ---- Persist on change ----
  createEffect(() => {
    persistFilter(search(), selectedCategory(), showNsfw());
  });

  // ---- Derived: categories sorted by frequency ----
  const availableCategories = createMemo(() => {
    const freq = new Map<string, number>();
    for (const ch of channels()) {
      for (const cat of ch.categories) {
        freq.set(cat, (freq.get(cat) ?? 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  });

  // ---- Derived: filtered channels ----
  const filteredChannels = createMemo(() => {
    const term = searchTerm().trim().toLowerCase();
    const cat = selectedCategory();
    const nsfw = showNsfw();

    return channels().filter((ch) => {
      if (ch.is_nsfw && !nsfw) return false;
      if (cat && !ch.categories.includes(cat)) return false;
      if (term.length > 0) {
        const haystack = [ch.name, ...(ch.alt_names ?? []), ch.network ?? ""]
          .filter(Boolean)
          .join(" § ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  });

  const filteredCount = () => filteredChannels().length;

  const hasActiveFilters = () =>
    search().length > 0 || selectedCategory() !== null || showNsfw();

  // ---- Actions ----

  function toggleCategory(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }

  function toggleNsfw() {
    setShowNsfw((prev) => !prev);
  }

  function setNsfw(value: boolean) {
    setShowNsfw(value);
  }

  function clearFilters() {
    setSearch("");
    setSelectedCategory(null);
    setShowNsfw(false);
  }

  return {
    search,
    searchTerm,
    selectedCategory,
    showNsfw,
    availableCategories,
    filteredChannels,
    filteredCount,
    hasActiveFilters,
    setSearch,
    toggleCategory,
    toggleNsfw,
    setNsfw,
    clearFilters,
  };
}
