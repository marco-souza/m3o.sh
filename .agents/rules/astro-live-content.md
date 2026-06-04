# Rule: Astro Live Content Collections

> How Astro live collections work in this project and when to use them vs. API routes.

## What Are Live Collections?

Astro v6+ introduced **live content collections** via `astro:content` / `defineLiveCollection`. Unlike static collections (built at `astro build` time), live collections fetch data **on every request** — perfect for dynamic external APIs like iptv-org.

```typescript
// src/live.config.ts
import { defineLiveCollection } from "astro:content";

export const collections = {
  channels: defineLiveCollection({
    type: "live",
    loader: iptvLoader, // ← custom LiveLoader
    schema: channelSchema, // ← Zod schema for type safety
  }),
};
```

## LiveLoader Interface

A `LiveLoader` must implement two methods:

```typescript
interface LiveLoader<TData, TFilter> {
  name: string;
  loadCollection(): Promise<{
    entries: Array<{ id: string; data: TData }>;
    error?: Error;
  }>;
  loadEntry({
    filter: TFilter,
  }): Promise<{ id: string; data: TData } | { error: Error } | undefined>;
}
```

### Our Implementation (`live-loader.ts`)

```typescript
export function createIptvLoader(): LiveLoader<IptvChannel, { id: string }> {
  return {
    name: "iptv-loader",
    async loadCollection() {
      const entries = await fetchAndEnrichChannels();
      return { entries };
    },
    async loadEntry({ filter }) {
      const entries = await fetchAndEnrichChannels();
      const entry = entries.find((e) => e.id === filter.id);
      return entry;
    },
  };
}
```

**Key point:** `loadCollection` fetches fresh data on every request. There is no in-memory cache (we removed it).

## When to Use Live Collection vs. API Route

| Scenario                                     | Use                            | Why                                                |
| -------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| Server-render the initial page with channels | Live collection                | Astro SSR fetches data, renders HTML               |
| Client refresh without page reload           | API route (`/api/channels.ts`) | Client-side `fetch()` call                         |
| Filtering by country (SSR)                   | Live collection with `filter`  | `getLiveCollection("channels", { country: "BR" })` |
| Filtering by country (client refresh)        | API route with query param     | Client-initiated re-fetch after country change     |
| Single channel lookup                        | Live collection `loadEntry`    | Direct entry resolution                            |

## Server-Side Rendering Flow

```
User requests /lab ──► Astro page component
                              │
                              ▼
                     calls getCollection("channels")
                              │
                              ▼
                     live-loader.ts fetchAndEnrichChannels()
                              │
                              ▼
                     Returns IptvChannel[] ──► rendered as HTML
                              │
                              ▼
                     SolidJS hydrates on client ──► IptvProvider
```

## Client Refresh Flow

```
User clicks "Refresh" ──► store.actions.refreshChannels()
                              │
                              ▼
                     fetch("/api/channels?country=XX")
                              │
                              ▼
                     API route calls fetchAndEnrichChannels(country)
                              │
                              ▼
                     Returns JSON ──► store updates channels signal
                              │
                              ▼
                     UI re-renders filtered channels
```

## Rules for Changes

- **Live collections support filtering.** `getLiveCollection(collection, filter?)` passes the filter to `loadCollection(context)`. Use this for SSR with dynamic params like country. Use the API route for client-initiated re-fetches.
- **The loader must remain pure.** It fetches from iptv-org, enriches, returns data. No side effects, no caching, no client concerns.
- **API routes bridge server and client.** Any client-initiated refresh, filter change, or country switch goes through `/api/channels.ts`.
- **Schema changes require type regeneration.** Update the Zod schema in `live.config.ts` if you add/remove fields; Astro generates types from it.
