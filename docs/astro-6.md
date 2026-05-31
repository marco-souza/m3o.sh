# Astro 6 — What's New

> Released: **March 10, 2026** | Latest: **6.4.2** (May 28, 2026)

Astro 6 is a major release with a refactored dev server, built-in Fonts API, Content Security Policy (CSP), Live Content Collections, an experimental Rust compiler, and more. It requires **Node 22+** and upgrades core dependencies to **Vite 7**, **Shiki 4**, and **Zod 4**.

---

## 6.0 — March 10, 2026

### Redesigned `astro dev` (Vite Environment API)

The dev server was rebuilt on Vite's new **Environment API**, allowing `astro dev` to run the exact production runtime during development. No more "works in dev, breaks in prod" surprises — especially for non-Node.js runtimes like Cloudflare Workers, Bun, and Deno.

- **Cloudflare**: The rebuilt `@astrojs/cloudflare` adapter now runs **`workerd`** at every stage (dev, prerendering, production). Cloudflare bindings (KV, D1, R2, Durable Objects) are available locally via `cloudflare:workers`. No more `Astro.locals.runtime` workarounds.

### Built-in Fonts API

Configure fonts in `astro.config.mjs` using providers (Google, Fontsource, or local files). Astro handles downloading, self-hosting, optimized fallbacks, and preload hints automatically.

```js
// astro.config.mjs
import { defineConfig, fontProviders } from "astro/config";
export default defineConfig({
  fonts: [
    {
      name: "Roboto",
      cssVariable: "--font-roboto",
      provider: fontProviders.fontsource(),
    },
  ],
});
```

```astro
---
import { Font } from 'astro:assets';
---
<Font cssVariable="--font-roboto" preload />
<style is:global>
  body { font-family: var(--font-roboto); }
</style>
```

### Live Content Collections (Stable)

Content fetched at **request time** — no rebuild needed when CMS content changes. Uses same APIs as build-time collections.

```ts
// src/live.config.ts
import { defineLiveCollection } from "astro:content";
import { z } from "astro/zod";

const updates = defineLiveCollection({
  loader: cmsLoader({ apiKey: process.env.MY_API_KEY }),
  schema: z.object({ slug: z.string(), title: z.string() }),
});
export const collections = { updates };
```

```astro
---
import { getLiveEntry } from 'astro:content';
const { entry: update, error } = await getLiveEntry('updates', Astro.params.slug);
if (error || !update) return Astro.redirect('/404');
---
```

### Content Security Policy (CSP) — Stable

Astro is the first JS meta-framework to offer built-in CSP for both static and dynamic pages, in server and serverless environments. Works with responsive images out of the box.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
export default defineConfig({ security: { csp: true } });
```

Advanced config with directives, hashing algorithm, and per-directive hashes:

```js
security: {
  csp: {
    algorithm: 'SHA-512',
    directives: ["default-src 'self'", "img-src 'self' https://images.cdn.example.com"],
  },
},
```

### Upgraded Core Dependencies

| Package | Old | New   |
| ------- | --- | ----- |
| Vite    | 6   | **7** |
| Shiki   | 3   | **4** |
| Zod     | 3   | **4** |

- **Zod 4**: Import from `astro/zod` (not `astro:content`).
- **Node.js**: Now requires **Node 22+** (drops 18 and 20).
- **Vite 7**: Update any pinned Vite version before upgrading.

### Experimental: Rust Compiler

Successor to the Go-based `.astro` compiler. Faster and produces stronger diagnostics.

```bash
npm install @astrojs/compiler-rs
```

```js
export default defineConfig({ experimental: { rustCompiler: true } });
```

> Made the default in Astro 7 (alpha available now).

### Experimental: Queued Rendering

A two-pass rendering strategy (traverse → queue → render) with early benchmarks showing up to **2x faster rendering**. Planned to become the default in Astro 7.

```js
export default defineConfig({
  experimental: { queuedRendering: { enabled: true } },
});
```

### Experimental: Route Caching

Platform-agnostic caching for server-rendered responses using web standard cache semantics. Integrates with Live Content Collections for automatic invalidation.

```js
import { defineConfig, memoryCache } from "astro/config";
export default defineConfig({
  experimental: { cache: { provider: memoryCache() } },
});
```

```astro
---
Astro.cache.set({ maxAge: 120, swr: 60, tags: ['home'] });
---
```

---

## 6.1 — March 26, 2026

### Codec-Specific Sharp Image Defaults

Each image format now gets a codec-appropriate default rather than a single global default. No config changes needed — the defaults just got smarter.

### Advanced SmartyPants Configuration

Full control over typographic replacements (quotes, dashes, ellipses) via `markdown.smartypants`.

```js
markdown: {
  smartypants: {
    dashes: 'oldschool',
    openingQuotes: { double: '«', single: '‹' },
    closingQuotes: { double: '»', single: '›' },
    ellipses: 'unspaced',
  },
},
```

### i18n Fallback Routes for Integrations

New `fallbackRoutes` on every route in the `astro:routes:resolved` hook. `@astrojs/sitemap` now automatically includes i18n fallback pages.

### Other 6.1 Improvements

- Smoother view transitions on mobile (skips animation when browser provides its own, e.g. iOS Safari swipe gesture).
- Vite 8 compatibility warning on dev startup.
- React hydration fixes (conditional slot rendering, `experimentalReactChildren` mismatches).
- CSRF protection behind reverse proxies (`X-Forwarded-Proto` support in `astro dev`).

---

## 6.2 — April 30, 2026

### SVG Optimizer API (Redesigned)

Replaces the previous `experimental.svgo` flag with a new `svgOptimizer` interface that any library can implement. Ships with built-in `svgoOptimizer()`.

```js
import { defineConfig, svgoOptimizer } from "astro/config";
export default defineConfig({
  experimental: {
    svgOptimizer: svgoOptimizer({ plugins: ["preset-default"] }),
  },
});
```

### Experimental Logger

Custom loggers with built-in JSON output — great for structured logging and coding agents.

```js
import { defineConfig, logHandlers } from "astro/config";
export default defineConfig({ experimental: { logger: logHandlers.json() } });
```

CLI flag: `astro dev --experimentalJson`, `astro build --experimentalJson`.

Custom logger:

```js
export default defineConfig({
  experimental: { logger: { entrypoint: "@org/custom-logger" } },
});
```

### `experimental_getFontFileURL()`

Load font file data during prerendering — useful for tools like **Satori** (OG image generation).

```ts
import { experimental_getFontFileURL, fontData } from "astro:assets";
const url = experimental_getFontFileURL(fontPath, context.url);
```

### Astro 7 Alpha

- **Vite 8** support (breaking for integration authors).
- **Rust compiler** is now the default and only compiler (no experimental flag needed).
- Try it: `npm install astro@alpha`

### Other 6.2 Improvements

- `allowedHosts` for preview servers (passed down to adapter preview).
- `compressHTML: "jsx"` — strips whitespace using JSX rules (preserves `<pre>` tags).

---

## 6.3 — May 7, 2026

### Experimental: Advanced Routing

Full control over the request pipeline. Compose individual handlers, bring your own framework (Hono), and decide what runs in what order.

**Using a custom fetch handler:**

```ts
// src/app.ts
import { FetchState, astro } from "astro/fetch";
export default {
  fetch(request: Request) {
    const state = new FetchState(request);
    if (state.url.pathname.startsWith("/api")) {
      return fetch(new URL(state.url.pathname, "https://api.example.com"));
    }
    return astro(state);
  },
};
```

**Using Hono:**

```ts
// src/app.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { actions, middleware, pages, i18n } from "astro/hono";
const app = new Hono();
app.use(logger());
app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());
export default app;
```

Available handlers: `astro`, `trailingSlash`, `redirects`, `sessions`, `actions`, `middleware`, `pages`, `cache`, `i18n`.

### Image Redirect Handling

Astro now follows up to 10 redirects when fetching remote images. Every URL in the chain is validated against `image.remotePatterns` and `image.domains`.

### SVG Processing Disabled by Default

SVG rasterization via Sharp is now off by default (security: SVGs can contain scripts). Re-enable with `image.dangerouslyProcessSVG: true`, or use `format="svg"`.

---

## 6.4 — May 28, 2026

### Pluggable Markdown Processor API

Swap out the entire Markdown pipeline. Default remains `unified()`, but alternatives like **Sätteri** (Rust-based) are now available.

```js
import { defineConfig, unified } from "astro/config";
import remarkToc from "remark-toc";
export default defineConfig({
  markdown: { processor: unified({ remarkPlugins: [remarkToc] }) },
});
```

> The legacy top-level `markdown.remarkPlugins`, `markdown.rehypePlugins`, `markdown.gfm`, `markdown.smartypants`, and `markdown.remarkRehype` are **deprecated** — move them into `unified({...})`. Will be removed in Astro 8.0.

### Sätteri — Rust-based Markdown Processor

```bash
npm install @astrojs/markdown-satteri
```

```js
import { satteri } from "@astrojs/markdown-satteri";
export default defineConfig({
  markdown: { processor: satteri({ features: { directive: true } }) },
});
```

- Much faster than unified (over a minute shaved off the Astro + Cloudflare docs builds).
- Native support for many features that previously required plugins.
- Does **not** run remark/rehype plugins — use Sätteri MDAST/HAST plugins instead.
- Planned to become the default in a future major version.

### Cloudflare Helpers for Advanced Routing

`@astrojs/cloudflare` ships a `cf()` helper that wires up SESSION KV, static assets via ASSETS binding, `locals.cfContext`, client address, `waitUntil`, and prerendered error pages.

```ts
// src/app.ts — Hono + Cloudflare
import { Hono } from "hono";
import { actions, middleware, pages, i18n } from "astro/hono";
import { cf } from "@astrojs/cloudflare/hono";

const app = new Hono<{ Bindings: Env }>();
app.use(cf());
app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());
export default app;
```

---

## Breaking Changes Summary (for migration)

| Area                 | Change                                                           |
| -------------------- | ---------------------------------------------------------------- |
| **Node.js**          | Minimum Node 22 required (drops 18, 20)                          |
| **Vite**             | Vite 7 required; update integrations                             |
| **Zod**              | Zod 4; import from `astro/zod`                                   |
| **Shiki**            | Shiki 4 for code highlighting                                    |
| **Markdown config**  | Top-level remark/rehype options deprecated; use `unified({...})` |
| **SVG optimization** | New `svgOptimizer` API replaces `experimental.svgo`              |
| **SVG processing**   | SVG rasterization via Sharp disabled by default                  |

**Upgrade CLI:**

```bash
# Recommended
npx @astrojs/upgrade

# Manual
npm install astro@latest

# New project
npm create astro@latest
```

---

## Experimental Features Roadmap

| Feature            | Added | Status            | Notes                                     |
| ------------------ | ----- | ----------------- | ----------------------------------------- |
| Rust Compiler      | 6.0   | **Stable in 7.0** | Default in Astro 7 alpha                  |
| Queued Rendering   | 6.0   | Experimental      | Planned default in 7.0                    |
| Route Caching      | 6.0   | Experimental      | In-memory provider; more providers coming |
| Logger             | 6.2   | Experimental      | JSON + custom loggers                     |
| Advanced Routing   | 6.3   | Experimental      | Hono support, fetch handlers              |
| SVG Optimizer      | 6.2   | Experimental      | Pluggable API                             |
| Markdown Processor | 6.4   | Stable API        | Legacy top-level options deprecated       |

---

## Resources

- [Astro 6.0 Blog Post](https://astro.build/blog/astro-6/)
- [Astro 6.1 Blog Post](https://astro.build/blog/astro-610/)
- [Astro 6.2 Blog Post](https://astro.build/blog/astro-620/)
- [Astro 6.3 Blog Post](https://astro.build/blog/astro-630/)
- [Astro 6.4 Blog Post](https://astro.build/blog/astro-640/)
- [Upgrade Guide](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Full Changelog](https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md)
