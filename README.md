# m3o.sh

Personal website and app hub built with [Astro](https://astro.build), deployed to [Cloudflare Pages](https://pages.cloudflare.com).

## Stack

| Layer          | Tool                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| Framework      | [Astro](https://astro.build) v6                                                               |
| Styling        | [Tailwind CSS](https://tailwindcss.com) v4 + [DaisyUI](https://daisyui.com)                   |
| Fonts          | [Fontsource](https://fontsource.org) (Roboto, Fira Mono)                                      |
| Runtime        | [Bun](https://bun.sh)                                                                         |
| Deploy         | [Cloudflare Pages](https://pages.cloudflare.com) via `@astrojs/cloudflare`                    |
| Infra          | [Pulumi](https://pulumi.com) + [Wrangler](https://developers.cloudflare.com/workers/wrangler) |
| Lint / Format  | [Biome](https://biomejs.dev)                                                                  |
| Git hooks      | [Lefthook](https://github.com/evilmartians/lefthook)                                          |
| Env management | [mise](https://mise.jdx.dev)                                                                  |

## Project Structure

```text
├── infra/           # Pulumi infrastructure (Cloudflare)
├── packages/i18n/   # Shared i18n utilities
├── public/          # Static assets
├── src/
│   ├── components/  # Astro components
│   ├── config/      # Site links & config
│   ├── i18n/        # Translation strings
│   ├── layouts/     # Page layouts
│   ├── lib/         # Shared utilities
│   ├── pages/       # Routes
│   └── styles/      # Global CSS
├── docs/            # Design docs
├── astro.config.ts
├── wrangler.jsonc
└── Pulumi.yaml
```

## Getting Started

Requirements: [mise](https://mise.jdx.dev) (or Node 22+ & Bun manually)

```sh
# Install tools
mise install

# Install dependencies
bun install

# Start dev server
bun dev
```

## Commands

| Command          | Action                                    |
| ---------------- | ----------------------------------------- |
| `bun dev`        | Start local dev server (`localhost:4321`) |
| `bun build`      | Production build to `./dist/`             |
| `bun preview`    | Preview production build locally          |
| `bun test`       | Run tests                                 |
| `bun run lint`   | Check with Biome                          |
| `bun run format` | Format and fix with Biome                 |
| `bun astro ...`  | Astro CLI commands                        |

## Secrets

Encrypt `.env` before committing:

```sh
mise run encrypt   # gpg -c .env
mise run decrypt   # gpg -d .env.gpg > .env
```

## Roadmap

- [ ] Homepage, About, Blog
- [ ] Lab / experiments page
- [ ] Mock Interview service
- [ ] Work with Me page
- [ ] App Center: Open TV, Link Shortener, RSS Feed, Web Clip
- [ ] Interactive cat tamagotchi

See [TODO.md](./TODO.md) for full task list.
