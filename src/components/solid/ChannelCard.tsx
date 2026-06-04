/**
 * Channel card — a single channel tile in the browser grid.
 *
 * Uses shared formatters from `channel-display.ts` and is purely presentational:
 * all state (active, focused) comes from the parent via props.
 */

import { createSignal, Show } from "solid-js";
import { categoryColor, channelInitial, qualityLabel } from "./channel-display";
import type { ChannelDTO } from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface ChannelCardProps {
  channel: ChannelDTO;
  activeChannelId: string | null;
  onClick: (channelId: string) => void;
  tabIndex?: number;
  ref?: (el: HTMLDivElement) => void;
  onFocus?: () => void;
}

// ---------------------------------------------------------------------------
// SkeletonCard — loading placeholder used during SSR cold-start
// ---------------------------------------------------------------------------

export function SkeletonCard() {
  return (
    <div
      class="flex flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-base-200 p-4"
      aria-hidden="true"
    >
      <div class="h-16 w-16 shrink-0 rounded-full skeleton-shimmer" />
      <div class="h-4 w-20 rounded skeleton-shimmer" />
      <div class="flex gap-1.5">
        <div class="h-4 w-12 rounded-full skeleton-shimmer" />
        <div class="h-4 w-8 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChannelCard
// ---------------------------------------------------------------------------

export default function ChannelCard(props: ChannelCardProps) {
  const [logoFailed, setLogoFailed] = createSignal(false);

  const isActive = () => props.activeChannelId === props.channel.id;
  const primaryCategory = () => props.channel.categories[0] ?? "";
  const badge = () => qualityLabel(props.channel.quality);

  function handleClick() {
    props.onClick(props.channel.id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onClick(props.channel.id);
    }
  }

  return (
    <div
      ref={props.ref}
      role="option"
      tabIndex={props.tabIndex ?? 0}
      aria-label={`${props.channel.name}, ${primaryCategory() || "Uncategorized"}${props.channel.is_nsfw ? ", adult content" : ""}`}
      aria-selected={isActive()}
      class={`
        group relative flex cursor-pointer flex-col items-center gap-2
        rounded-xl border-2 bg-base-200 p-4 transition-all duration-200
        outline-none select-none
        ${
          isActive()
            ? "border-primary ring-2 ring-primary/50 scale-[1.03]"
            : "border-transparent hover:border-base-content/20 hover:scale-[1.02] hover:shadow-lg"
        }
        focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={props.onFocus}
    >
      {/* Now Streaming indicator */}
      <Show when={isActive()}>
        <div
          class="absolute top-1.5 right-1.5 z-10 flex items-center gap-1.5"
          role="status"
          aria-label="Now streaming"
        >
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span class="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-pulse-glow" />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span class="text-[10px] font-bold uppercase leading-none tracking-wider text-green-400 select-none">
            ON AIR
          </span>
        </div>
      </Show>

      {/* Logo (or fallback placeholder) */}
      <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-base-300">
        {logoFailed() ? (
          <div class="flex h-full w-full items-center justify-center text-2xl font-bold text-base-content/40">
            {channelInitial(props.channel.name)}
          </div>
        ) : (
          <img
            src={props.channel.logo}
            alt={`${props.channel.name} logo`}
            class="h-full w-full object-contain p-1"
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        )}
      </div>

      {/* Channel name */}
      <span class="line-clamp-2 text-center text-sm font-semibold leading-tight text-base-content">
        {props.channel.name}
      </span>

      {/* Badge row: category pill, quality badge, 18+ pill */}
      <div class="flex flex-wrap items-center justify-center gap-1.5">
        {primaryCategory() && (
          <span
            class={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none ${categoryColor(primaryCategory())}`}
          >
            {primaryCategory()}
          </span>
        )}

        <span
          class={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none ${
            badge() === "HD"
              ? "bg-green-600 text-green-100"
              : "bg-gray-500 text-gray-100"
          }`}
        >
          {badge()}
        </span>

        {props.channel.is_nsfw && (
          <span class="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-red-100">
            18+
          </span>
        )}
      </div>
    </div>
  );
}
