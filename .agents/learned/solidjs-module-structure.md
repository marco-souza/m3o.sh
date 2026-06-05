# Learned: Solid.js Module Structure & Barrel Files

**Date:** 2026-06-05
**Context:** Refactoring `IptvPlayer.tsx` into multiple focused components
**Status:** Active

## Key Learnings

### 1. Barrel File Import Resolution in Astro/Solid.js Projects

**Problem:** When importing from a directory (`./IptvPlayer`), TypeScript with `moduleResolution: Bundler` does NOT automatically resolve to `./IptvPlayer/index.tsx`.

**Solution:** Use explicit paths:

```typescript
// ❌ Doesn't work
export { Foo } from "./subdir";

// ✅ Explicit path required
export { Foo } from "./subdir/index";
```

**This matches how existing code in this project imports from stores:**

```typescript
import { useIptvStore } from "./stores/iptv-store"; // explicit file
```

### 2. Solid.js Store Imports

**Problem:** `createStore` and `produce` are NOT exported from `solid-js`.

**Solution:** Import from `solid-js/store`:

```typescript
import { createStore, produce } from "solid-js/store";
```

### 3. Solid.js Store Type Annotations

**Problem:** TypeScript can't infer types in `produce` callbacks without explicit annotations.

**Solution:** Annotate the state type:

```typescript
setState(
  produce((s: PlayerState) => {
    s.error = null;
  }),
);
```

### 4. Consolidated State with `createStore`

**Better pattern than multiple `createSignal`:**

```typescript
// ❌ Fragmented state
const [error, setError] = createSignal<PlayerError | null>(null);
const [retryCount, setRetryCount] = createSignal(0);
const [isPlaying, setIsPlaying] = createSignal(false);
const [isMuted, setIsMuted] = createSignal(true);

// ✅ Cohesive state
const [state, setState] = createStore<PlayerState>({
  error: null,
  retryCount: 0,
  isPlaying: false,
  isMuted: true,
});
```

### 5. Solid.js Refs Must Be Local

**Problem:** Passing `ref` as a prop to child components doesn't work (unlike React).

**Solution:** Keep the video element in the same component that declares the ref:

```typescript
// ❌ BROKEN - ref passed as prop
function VideoElement(props: { videoRef: HTMLVideoElement | undefined }) {
  return <video ref={props.videoRef} />;  // ref won't be assigned!
}

// ✅ WORKS - video element in same component as ref
function Player() {
  let videoRef: HTMLVideoElement | undefined;
  return <video ref={videoRef} />;
}
```

### 6. Type Arrays as Const for Union Types

**Better pattern for string union types:**

```typescript
// ❌ Verbose union type
type ErrorKind = "network-offline" | "stream-unavailable" | "media-error";

// ✅ Better: array as const + derived type
const ERROR_KINDS = [
  "network-offline",
  "stream-unavailable",
  "media-error",
] as const;
type ErrorKind = (typeof ERROR_KINDS)[number];

// Benefits:
// - Can iterate over values: ERROR_KINDS.forEach(...)
// - Type safety: new ErrorKind values must be in the array
// - Single source of truth
```

### 7. Subdirectory Imports Need Relative Paths

**Problem:** When a component is in a subdirectory, relative imports need extra `../`

**Solution:** Adjust paths for nested components:

```typescript
// In IptvPlayer/Overlay.tsx (nested)
import { useIptvStore } from "../stores/iptv-store"; // ✅ correct
import { useIptvStore } from "./stores/iptv-store"; // ❌ wrong
```

## Constraints Discovered

- Astro's tsconfig uses `moduleResolution: Bundler` which requires explicit barrel file paths
- Biome formatter auto-fixes import organization issues with `--write` flag
- E2E tests must run against a live dev server (port 4321)

## Related

- [Solid.js docs](https://www.solidjs.com/docs/latest/api)
- `src/components/solid/IptvPlayer/` — refactored component
- `e2e/open-tv.spec.ts` — has test "video element is visible after selecting a channel" that validates video ref works
