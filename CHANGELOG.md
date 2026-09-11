# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] — 2026-09-11

### 📺 Open TV is now a generic M3U playlist player

Open TV is no longer locked to Brazilian channels from the iptv-org JSON
API. It's now a **generic IPTV player** that loads channels from **any
user-supplied M3U playlist URL**, worldwide.

- **Bring your own playlist** — paste any M3U URL in the new **Settings**
  menu and start watching.
- **Settings menu** (gear icon) — add/edit your playlist URL, refresh on
  demand, reset to the default, with a last-refreshed timestamp and clear
  error feedback.
- **Instant return visits** — parsed channels are cached in `localStorage`,
  so reopening Open TV renders with **zero network requests**.
- **Default playlist out of the box** — first-time visitors auto-load
  `https://iptv-org.github.io/iptv/index.m3u` with no setup.
- **Server-side proxy** (`POST /api/playlist`) — http/https-only URL
  validation, private/loopback/link-local IP blocking (SSRF mitigation),
  15s timeout, 8MB cap, and structured `kind` errors
  (`invalid-url | fetch-failed | not-m3u | too-large | parse-error`).
- **New channel model** — `{ id, name, logo, url, categories[] }` parsed
  from `#EXTM3U`/`#EXTINF`; duplicates collapse to the first occurrence.
- **Performance** — the channel grid is capped at 300 entries with a
  "refine your search" hint; the Solid island renders `client:only` to
  eliminate the hydration-mismatch layout shift.

### Removed (iptv-org data layer)

- `live-loader.ts`, `live.config.ts`, and `/api/channels` — the JSON
  enrichment, Brazil filter, blocklist, and server-side live collection.
- `referrer`/`user_agent` stream plumbing — `StreamSource` is now just
  `{ url }` (M3U carries neither).
- `alt_names`/`network` search dependencies.

### ⬆️ Astro 7 upgrade

Upgraded the site to **Astro 7**, with a follow-up Astro version bump.

### 📦 Dependencies & tooling

- Upgraded all dependencies — Biome, `bun.lock`, and the Cloudflare worker
  types (`worker-configuration.d.ts`).
- Added `install.sh` — a one-shot installer script for the project.
- Downgraded Pulumi to 3.255.0 and removed the stale `MODELS.md`, fixing a
  version mismatch.

### 🛠️ Infrastructure fixes

- Corrected CI/infra permissions.
- Disabled cross-version caching that was causing stale builds.
- Aligned Pulumi and TypeScript versions.

### Verification

- Lint clean (Biome, 67 files).
- 98 unit tests passing (parser, SSRF guard, storage, endpoint).
- Production build succeeds.
- 41 e2e tests passing (8 Open TV + 33 others).
