# Rule: iptv-org API

> How the iptv-org dataset works and how we consume it in this project.

## API Endpoints

All endpoints are static JSON files served from `https://iptv-org.github.io/api/`:

| Endpoint          | What it returns                        | Size (approx) |
| ----------------- | -------------------------------------- | ------------- |
| `channels.json`   | All channels with metadata             | ~9.4 MB       |
| `streams.json`    | Stream URLs linked to channels         | ~2.6 MB       |
| `feeds.json`      | Feed metadata (format, broadcast area) | ~1 MB         |
| `blocklist.json`  | Channels blocked (DMCA, NSFW, etc.)    | ~100 KB       |
| `categories.json` | Category ID → human-readable name      | ~10 KB        |
| `countries.json`  | Country code → name, languages         | ~20 KB        |

## Channel Lifecycle

A channel in the iptv-org dataset can be in one of these states:

1. **Active + online** — has streams, not blocklisted, not closed, not replaced
2. **Active + offline** — no streams OR blocklisted OR closed OR replaced_by set
3. **NSFW** — `is_nsfw: true` (orthogonal to online status)

## `is_online` Computation

In this project, `is_online` is a **computed boolean** at enrichment time:

```
is_online = has_streams && !blocklisted && !closed && !replaced_by
```

Where:

- `has_streams` = at least one entry in `streams.json` with `channel === this.id`
- `blocklisted` = id exists in `blocklist.json`
- `closed` = `channel.closed` date string is non-null
- `replaced_by` = `channel.replaced_by` string is non-null

**Important:** We do NOT do runtime HTTP health checks. A channel is "online" if it _should_ have a working stream based on metadata, not if the stream URL actually responds 200.

## Why Channels Go "Offline"

| Reason           | Data source field              | Example                    |
| ---------------- | ------------------------------ | -------------------------- |
| No streams       | `streams.json` missing link    | New channel, no source yet |
| DMCA block       | `blocklist.json` reason="dmca" | ABCSpark.ca                |
| NSFW block       | `blocklist.json` reason="nsfw" | AdultChannel.uk            |
| Channel closed   | `channel.closed` date          | AnhuiTV.cn                 |
| Channel replaced | `channel.replaced_by` id       | Rebranded channels         |

## Data Flow in This Project

```
iptv-org API ──► live-loader.ts ──► Astro live collection ──► channels API ──► client store
                (enrichment)        (server render/hydrate)     (refresh)       (filter + display)
```

### Enrichment (`live-loader.ts`)

1. Fetch all 5 endpoints in parallel
2. Build lookup maps: `streamsByChannel`, `blockedIds`, `feedByChannelAndId`
3. For each channel:
   - Resolve category codes to names via `categoryMap`
   - Build `IptvStream[]` from matched streams + feed metadata
   - Compute `is_online`
   - Include **all** channels in the output (don't drop offline ones)
4. Return enriched `IptvChannel[]`

### Server-Side Country Filter

The `/api/channels.ts` endpoint accepts a `country` query param. The loader filters by `channel.country === param`. If no param is provided, it defaults to the user's locale (derived from `Accept-Language` header).

## Key Types

```typescript
interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  country: string; // ISO 3166-1 alpha-2
  categories: string[]; // human-readable names (resolved)
  is_nsfw: boolean;
  is_online: boolean; // COMPUTED — see above
  logo: string;
  website: string | null;
  streams: IptvStream[];
}

interface IptvStream {
  url: string;
  quality: string | null;
  format: string | null;
  label: string | null;
  referrer: string | null;
  user_agent: string | null;
}
```

## Rules for Changes

- **Never drop channels at the loader level.** Always compute `is_online` and let the UI filter.
- **Country filtering happens server-side** via the API endpoint, not client-side on the full 40k dataset.
- **Category names are resolved at load time** from `categories.json` IDs to human-readable strings.
