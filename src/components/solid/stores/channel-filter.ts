/**
 * Channel browser filter state — a custom reactive primitive.
 *
 * Encapsulates search and category filtering with localStorage
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
} {
  try {
    const raw = localStorage.getItem(LS_CATEGORIES_KEY);
    const category = raw && raw.length > 0 ? raw : null;
    return {
      search: localStorage.getItem(LS_SEARCH_KEY) ?? "",
      category,
    };
  } catch {
    return { search: "", category: null };
  }
}

function persistFilter(search: string, category: string | null) {
  try {
    localStorage.setItem(LS_SEARCH_KEY, search);
    localStorage.setItem(LS_CATEGORIES_KEY, category ?? "");
  } catch {
    // localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Maximum number of channels rendered in the browser grid (FR-7). */
export const MAX_GRID_CHANNELS = 300;

export interface ChannelFilter {
  // ---- Signals (read) ----
  search: () => string;
  searchTerm: () => string; // debounced
  selectedCategory: () => string | null;

  // ---- Derived (read) ----
  availableCategories: () => string[];
  filteredChannels: () => ChannelDTO[];
  filteredCount: () => number;
  /** Full filtered count BEFORE the 300-entry grid cap is applied. */
  totalFilteredCount: () => number;
  /** True when `totalFilteredCount` exceeds the grid cap. */
  isCapped: () => boolean;
  hasActiveFilters: () => boolean;

  // ---- Actions ----
  setSearch: (value: string) => void;
  toggleCategory: (cat: string) => void;
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
  const searchTerm = useDebounced(search, 150);

  // ---- Persist on change ----
  createEffect(() => {
    persistFilter(search(), selectedCategory());
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

  // ---- Derived: filtered channels (search matches `name` only — FR-7) ----
  const matchedChannels = createMemo(() => {
    const term = searchTerm().trim().toLowerCase();
    const cat = selectedCategory();

    return channels().filter((ch) => {
      if (cat && !ch.categories.includes(cat)) return false;
      if (term.length > 0 && !ch.name.toLowerCase().includes(term))
        return false;
      return true;
    });
  });

  const totalFilteredCount = () => matchedChannels().length;

  // ---- Derived: capped at MAX_GRID_CHANNELS for the grid render (FR-7) ----
  const filteredChannels = createMemo(() =>
    matchedChannels().slice(0, MAX_GRID_CHANNELS),
  );

  const filteredCount = () => filteredChannels().length;
  const isCapped = () => totalFilteredCount() > MAX_GRID_CHANNELS;

  const hasActiveFilters = () =>
    search().length > 0 || selectedCategory() !== null;

  // ---- Actions ----

  function toggleCategory(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }

  function clearFilters() {
    setSearch("");
    setSelectedCategory(null);
  }

  return {
    search,
    searchTerm,
    selectedCategory,
    availableCategories,
    filteredChannels,
    filteredCount,
    totalFilteredCount,
    isCapped,
    hasActiveFilters,
    setSearch,
    toggleCategory,
    clearFilters,
  };
}
