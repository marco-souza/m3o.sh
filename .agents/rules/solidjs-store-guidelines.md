# Rule: SolidJS Store Guidelines

> State management conventions for the IPTV app and any future SolidJS features.

## Core Principle: Stores for Shared State

**Always use `createStore` for state that crosses component boundaries.**

`createSignal` is fine for truly local UI state (e.g., a dropdown's open/closed, a single input's focus). But anything that multiple components read or that survives component unmount belongs in a store.

| State Type         | Use            | Example                                     |
| ------------------ | -------------- | ------------------------------------------- |
| Shared app state   | `createStore`  | active channel, filters, chrome visibility  |
| Component-local UI | `createSignal` | category expand/collapse, input focus       |
| Derived data       | `createMemo`   | filtered channel list, stream source lookup |

## The Store Pattern

```typescript
// src/components/solid/stores/iptv-store.tsx
import { createStore } from "solid-js/store";

interface IptvState {
  activeChannelId: string | null;
  isBrowsing: boolean;
  showChrome: boolean;
  isHydrated: boolean;
  // ... filter state:
  filterSearch: string;
  filterOnlineOnly: boolean;
  filterNsfwOnly: boolean;
  filterCountry: string;
  filterCategory: string | null;
}

const INITIAL_STATE: IptvState = {
  activeChannelId: null,
  isBrowsing: false,
  showChrome: false,
  isHydrated: false,
  filterSearch: "",
  filterOnlineOnly: false,
  filterNsfwOnly: false,
  filterCountry: "BR", // or default from locale
  filterCategory: null,
};

export function IptvProvider(props: IptvProviderProps) {
  const [state, setState] = createStore<IptvState>({ ...INITIAL_STATE });
  // ...
}
```

## Query Params Are the Single Source of Truth

**For any state that should be shareable or restoreable, the URL query string is the SSOT.**

### Reading on Hydration

```typescript
function getFiltersFromQuery(): Partial<IptvState> {
  const params = new URLSearchParams(window.location.search);
  return {
    filterSearch: params.get("search") ?? "",
    filterOnlineOnly: params.get("online") === "1",
    filterNsfwOnly: params.get("nsfw") === "1",
    filterCountry: params.get("country") ?? getDefaultCountry(),
    filterCategory: params.get("category"),
  };
}
```

### Writing on Change

```typescript
function setFilterQuery(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  history.replaceState(null, "", url.toString());
}
```

### Debounced Search

Search inputs fire on every keystroke. Debounce the URL update:

```typescript
// Inside the store provider
const [searchInput, setSearchInput] = createSignal("");

// Debounced effect
let searchTimer: ReturnType<typeof setTimeout> | null = null;
function setSearch(value: string) {
  setSearchInput(value);
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    setState("filterSearch", value);
    setFilterQuery("search", value || null);
  }, 300);
}
```

## What NOT to Do

### ❌ Don't create standalone signal primitives for shared state

```typescript
// BAD: createChannelFilter.ts — signals outside the store
export function createChannelFilter(channels: () => ChannelDTO[]) {
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(
    null,
  );
  // This state is invisible to the rest of the app and the URL
}
```

### ❌ Don't use localStorage for shareable state

```typescript
// BAD: localStorage is private to one browser, not shareable
localStorage.setItem("m3o-open-tv-search", search);
// Use query params instead
```

### ❌ Don't mutate store state directly

```typescript
// BAD: direct mutation
state.filterSearch = "news";

// GOOD: use setState
setState("filterSearch", "news");
```

### ❌ Don't create signals when a derived memo will do

```typescript
// BAD: manually syncing signals
const [filteredCount, setFilteredCount] = createSignal(0);
createEffect(() => {
  setFilteredCount(filteredChannels().length);
});

// GOOD: createMemo
const filteredCount = createMemo(() => filteredChannels().length);
```

## Rules for Changes

1. **Adding new state?** Ask: "Does more than one component need this?" If yes → store. If no → local signal.
2. **Should this be shareable via URL?** If yes → add to query params SSOT.
3. **Never create `createSignal` primitives that replace store state.** Remove them and add fields to the store.
4. **Actions go in the store.** All state mutations happen through `IptvActions`, not directly on signals.
5. **Read from the URL on hydration, write to the URL on change.** This ensures SSR and client agree on initial state.
