# UI Decisions — m3o.sh

> Living document tracking UI/UX, brand, and internationalization decisions for the m3o.sh project.

---

## Brand Identity

### Logo

- **Type:** Combination mark — terminal prompt icon (`>_`) + monospace wordmark (`m3o.sh` where m3o has primary color, while the rest is normal text)
- **Rationale:** The site is a personal dev tools/labs playground. The terminal prompt communicates developer culture instantly. The "3" in "m3o" doubles as subtle leet-speak (m-e-o → m-3-o).
- **File:** `src/components/Logo.astro`
- **Implementation:** Inline SVG — not an `<img>` tag — so `currentColor` theming works with zero extra requests.

### Color

| Element       | Value                           | Reason                                                                         |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Prompt mark   | `var(--color-primary)`          | DaisyUI primary color — adapts to the active theme                             |
| Wordmark text | `currentColor` / `text-primary` | Inherits from parent or theme primary, adapts automatically                    |
| Icon border   | `border-primary`                | DaisyUI primary border, consistent with prompt mark                            |
| Favicon bg    | `#605dff`                       | Purple/indigo badge with off-white (`#eee`) accent; static single-color design |

### Typography

- **Logo font:** `var(--font-fira-mono)` via Astro's font system
- **Body font:** `var(--font-roboto)` via Astro's font system
- **Rationale:** Reinforces the terminal/dev aesthetic. Astro handles font file preloading and CSS-variable injection at build time, eliminating layout shift and extra requests.

---

## Component Patterns

### Logo.astro

```astro
<!-- Inline SVG — no <img> tag -->
<!-- Props: width, height, alt, url, wordmark -->
<!-- Defaults: width=28, alt="m3o", url=Astro.site, wordmark=false -->
```

The logo has two visual modes:

1. **Icon only** (`wordmark={false}`) — a bordered, rounded SVG terminal prompt (`>_`) used in compact contexts (e.g., footer, favicon-like placements).
2. **Icon + wordmark** (`wordmark={true}`) — the icon followed by `<code>m3o.sh</code>` with an animated blinking cursor (`_`).

**Styling details:**

- SVG stroke uses `var(--color-primary, currentColor)` so it respects the theme's primary color.
- The icon wrapper has `border border-primary rounded-sm p-1` for a subtle badge appearance.
- The wordmark uses the `font-fira-mono` class (registered in `@theme`) for a consistent monospace look.
- The `m3o` segment is rendered in `text-primary` while `.sh` uses the default text color.
- The wordmark wrapper is `italic` for a subtle slanted terminal aesthetic.

**Anti-patterns avoided:**

- ❌ No config import for a single string — `alt` is inlined (brand name, not translatable)
- ❌ No `<img src>` — inline SVG allows `currentColor` theming and zero HTTP requests
- ❌ No `filter: invert(1)` CSS hack for dark mode — `currentColor` and theme variables handle it natively
- ❌ No hardcoded hex colors in the wordmark — DaisyUI utility classes adapt to the active theme

### NavBar.astro

- Uses `src/config/links.ts` for all navigation data
- No hardcoded strings — labels come from i18n translation keys
- `navLinks` render as ghost/outline buttons (`btn btn-ghost hover:btn-outline`)
- `serviceLinks` render as outline buttons; the last item is emphasized with `btn-primary`
- Mobile drawer is planned but not yet implemented

---

## Internationalization (i18n)

### Architecture

```
src/i18n/ui.ts         # Dictionary, language detection, translation helper
src/config/links.ts    # Navigation data, consumed by NavBar
```

### Key Decisions

| Decision                                               | Rationale                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Key-based dictionary (`"nav.home"`)                    | Simple flat structure, easy to extend, no nesting complexity  |
| `useTranslations(lang)` returns a `t(key)` function    | Familiar `t()` API; typesafe via `as const` on the dictionary |
| `getLangFromUrl(url)` extracts `/:lang/` prefix        | Enables `m3o.sh/en/` and `m3o.sh/pt/` routing in the future   |
| `defaultLang` fallback                                 | Any unknown language falls back to English                    |
| Static strings (brand name, logo `alt`) stay hardcoded | "m3o" is a brand name — it does not get translated            |

### Translation Key Naming Convention

```
layout.*    # Page-level metadata (title, description)
nav.*       # Navigation labels
page.*      # Page-specific copy
cta.*       # Call-to-action buttons
```

### Fonts

Astro's built-in font system (`astro:assets` `<Font>` component) loads Roboto and Fira Mono at build time. The font stack is configured in `astro.config.ts` and consumed via `Head.astro`, which is imported in `src/layouts/Layout.astro`.

| Font      | CSS Variable       | Usage                     |
| --------- | ------------------ | ------------------------- |
| Roboto    | `--font-roboto`    | Base body text            |
| Fira Mono | `--font-fira-mono` | Code, logos, monospace UI |

### Current Language Support

| Language | Code | Status              |
| -------- | ---- | ------------------- |
| English  | `en` | ✅ Active (default) |

---

## Favicon

| File                 | Purpose         | How it was made                                                               |
| -------------------- | --------------- | ----------------------------------------------------------------------------- |
| `public/favicon.svg` | Modern browsers | Hand-written SVG: rounded square bg + prompt mark + blinking cursor animation |

**Design:** The favicon is a square badge with a solid background, rounded corners, a thin border, and the terminal prompt `>_` centered inside. No text — it works at 16×16 and scales cleanly to 512×512 app icons.

**Colors:**

- `bg` = `#605dff` (purple/indigo)
- `accent` = `#eee` (off-white)

The favicon is a static single-color design. Unlike the inline logo SVG, it does **not** use `currentColor` or `prefers-color-scheme` — it renders the same purple badge in all contexts for strong brand recognition at small sizes.

---

## Theme Strategy

DaisyUI v5 (via Tailwind CSS v4) provides the component layer. The active theme is driven by `prefers-color-scheme` until an explicit theme toggle is added.

Logo text uses `currentColor` and `text-primary` so it follows the theme automatically. The prompt stroke uses `var(--color-primary, currentColor)` which maps to the active DaisyUI primary color and has sufficient contrast on both `bg-base-100` light and dark variants.

The previous `filter: invert(1)` approach for dark mode was removed because:

1. It is a brittle CSS hack that affects the entire logo image indiscriminately
2. It does not work well with multi-color logos
3. `currentColor` and CSS custom properties are the semantic, accessible, and correct way to handle SVG theming
