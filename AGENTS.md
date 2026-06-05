# AGENTS.md - AI Agent Guidelines

This project uses AI agents for development. This file documents the conventions and tooling.

## Quick Commands

```bash
npm run lint          # Lint & format (Biome) — auto-fixes with --write
npm run e2e           # Run Playwright e2e tests
npm run dev           # Start dev server (port 4321)
npm run build         # Production build
npm run preview       # Preview production build
```

## Directory Structure

```
src/
├── components/solid/  # Solid.js components
│   ├── IptvPlayer/    # IPTV player (types, hooks, UI, Overlay, index)
│   └── stores/        # Solid.js stores (iptv-store.tsx)
├── pages/             # Astro pages & API routes
└── layouts/           # Astro layouts

.agents/
├── skills/            # Skill definitions
│   ├── learning/      # Document learnings
│   ├── project-files/ # Communication files
│   └── ...            # Other skills
└── learned/           # Documented learnings
```

## Skills

Use the `skills` CLI to manage skills:

```bash
skills list              # List available skills
skills add my-skill      # Create a new skill
skills install my-skill  # Install a skill
```

### Available Skills

| Skill                  | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `learning`             | Document key decisions & architectural learnings |
| `project-files`        | Manage PLAN.md, TODO.md, SPEC.md, etc.           |
| `prd-to-tasks`         | Convert PRD to structured tasks.json             |
| `implement-tasks`      | Execute tasks via tmux subagents                 |
| `explore`              | Research unfamiliar codebases                    |
| `grill-me`             | Clarify ambiguous requests                       |
| `git-commit-formatter` | Format commit messages                           |
| `pr-review`            | Review GitHub PRs                                |

## Documenting Learnings

After completing work, ask: **"Did I learn anything new?"**

If yes, document it:

```bash
# Create file in .agents/learned/
.agents/learned/<topic-name>.md
```

Format: see `.agents/skills/learning/SKILL.md`

## Project Conventions

### Stack

- **Framework:** Astro with Solid.js islands (`client:load`)
- **Styling:** Tailwind CSS
- **Language:** TypeScript (strict mode)
- **Linting:** Biome (`npm run lint`)
- **Testing:** Playwright e2e tests

### Solid.js Patterns

```typescript
// ✅ State: Use createStore (not multiple createSignal)
import { createStore, produce } from "solid-js/store";

const [state, setState] = createStore<PlayerState>({
  error: null,
  retryCount: 0,
  isPlaying: false,
  isMuted: true,
});

// Update with produce
setState(
  produce((s: PlayerState) => {
    s.error = null;
  }),
);

// ❌ Avoid: Multiple createSignal calls

// ✅ String unions: use const array pattern
const ERROR_KINDS = [
  "network-offline",
  "stream-unavailable",
  "media-error",
] as const;
type ErrorKind = (typeof ERROR_KINDS)[number];

// ✅ Refs: Must be in same component that uses them
let videoRef: HTMLVideoElement | undefined;
// Keep <video ref={videoRef}> in THIS component, don't pass as prop
```

### Module Imports

```typescript
// ✅ Explicit paths for barrel files
export { default } from "./IptvPlayer/index";

// ❌ This doesn't work with moduleResolution: Bundler
export { default } from "./IptvPlayer";
```

### Linting

```bash
# Check only
npm run lint

# Auto-fix
npm run lint -- --write
```

### E2E Tests

```bash
# Run all e2e tests
npm run e2e

# Run specific tests
npm run e2e -- --grep "Open TV"

# Run with UI
npm run e2e -- --ui
```

**Note:** Dev server must be running (`npm run dev` on port 4321).

## Key File Locations

| Purpose           | Path                                         |
| ----------------- | -------------------------------------------- |
| IPTV Player       | `src/components/solid/IptvPlayer/`           |
| IPTV Store        | `src/components/solid/stores/iptv-store.tsx` |
| Open TV Page      | `src/pages/lab/open-tv.astro`                |
| E2E Tests         | `e2e/`                                       |
| TypeScript Config | `tsconfig.json`                              |

## Documented Learnings

See `.agents/learned/` directory for accumulated knowledge:

- `.agents/learned/solidjs-module-structure.md` — Solid.js imports, barrel files, store patterns, refs, const arrays for unions
