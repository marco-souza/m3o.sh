/**
 * Channel browser — full-screen overlay for browsing, searching, and
 * filtering available channels.
 *
 * Filter state (search, category, NSFW) is managed by `createChannelFilter`
 * from `channel-filter.ts`, persisted to localStorage.
 * Playback state comes from the IPTV store context.
 * Keyboard navigation and focus management are local to this component.
 */

import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import ChannelCard from "./ChannelCard";
import { createChannelFilter } from "./stores/channel-filter";
import { useIptvStore } from "./stores/iptv-store";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface ChannelBrowserProps {
  activeChannelId: string | null;
  onChannelSelect: (id: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelBrowser(props: ChannelBrowserProps) {
  const store = useIptvStore();
  const filter = createChannelFilter(() => store.channelDTOs());

  // ---- Grid keyboard navigation ----
  const [gridFocusedIndex, setGridFocusedIndex] = createSignal(-1);
  let inputRef: HTMLInputElement | undefined;
  let overlayRef: HTMLDivElement | undefined;
  let gridRef: HTMLDivElement | undefined;
  const cardRefs = new Map<string, HTMLDivElement>();

  function getColumns(): number {
    if (!gridRef) return 1;
    const style = window.getComputedStyle(gridRef);
    const cols = style
      .getPropertyValue("grid-template-columns")
      .split(" ").length;
    return cols > 0 ? cols : 1;
  }

  function focusCard(index: number) {
    const channels = filter.filteredChannels();
    if (index < 0 || index >= channels.length) return;
    const el = cardRefs.get(channels[index].id);
    if (el) {
      el.focus();
      setGridFocusedIndex(index);
    }
  }

  function handleGridKeyDown(e: KeyboardEvent) {
    const channels = filter.filteredChannels();
    if (channels.length === 0) return;

    const cols = getColumns();
    const idx = gridFocusedIndex();
    const total = channels.length;
    let nextIdx = idx;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        nextIdx = idx < total - 1 ? idx + 1 : 0;
        break;
      case "ArrowLeft":
        e.preventDefault();
        nextIdx = idx > 0 ? idx - 1 : total - 1;
        break;
      case "ArrowDown":
        e.preventDefault();
        nextIdx = idx + cols;
        if (nextIdx >= total) {
          nextIdx = idx % cols;
          if (nextIdx >= total) nextIdx = total - 1;
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        nextIdx = idx - cols;
        if (nextIdx < 0) {
          const lastRowStart = Math.floor((total - 1) / cols) * cols;
          nextIdx = lastRowStart + (idx % cols);
          if (nextIdx >= total) nextIdx = total - 1;
        }
        break;
      case "Home":
        if (e.ctrlKey) {
          e.preventDefault();
          nextIdx = 0;
        }
        break;
      case "End":
        if (e.ctrlKey) {
          e.preventDefault();
          nextIdx = total - 1;
        }
        break;
      default:
        return;
    }

    if (nextIdx !== idx) focusCard(nextIdx);
  }

  // ---- Overlay-level keyboard handling ----

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      props.onClose();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      inputRef?.focus();
      return;
    }
    // Focus trap: Tab / Shift+Tab cycling within the overlay
    if (e.key === "Tab" && overlayRef) {
      const focusable = overlayRef.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === overlayRef) props.onClose();
  }

  // ---- Lifecycle ----

  onMount(() => {
    inputRef?.focus();
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
  });

  // Reset grid focus when filters change
  createEffect(() => {
    filter.filteredChannels();
    setGridFocusedIndex(-1);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "";
  });

  // ---- Render ----

  return (
    <div
      ref={overlayRef}
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Channel browser"
    >
      <div class="mt-8 flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col rounded-t-2xl bg-base-100 shadow-2xl">
        {/* Header */}
        <div class="flex shrink-0 items-center justify-between border-b border-base-300 px-6 py-4">
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-base-content">Channels</h2>
            <span class="text-sm text-base-content/60" aria-live="polite">
              {filter.filteredCount()} channel
              {filter.filteredCount() !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Close channel browser"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>

        {/* Toolbar: search + NSFW toggle */}
        <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-base-300 px-6 py-3">
          <div class="flex flex-1 items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 shrink-0 text-base-content/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search channels…"
              value={filter.search()}
              onInput={(e) => filter.setSearch(e.currentTarget.value)}
              class="input input-bordered input-sm w-full max-w-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              aria-label="Search channels"
            />
            <Show when={filter.search().length > 0}>
              <button
                type="button"
                class="btn btn-ghost btn-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                onClick={() => filter.setSearch("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            </Show>
          </div>

          <label class="flex cursor-pointer items-center gap-2 rounded text-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            <span class="select-none text-base-content/70">Show 18+</span>
            <input
              type="checkbox"
              class="toggle toggle-sm"
              checked={filter.showNsfw()}
              onChange={(e) => filter.setNsfw(e.currentTarget.checked)}
              aria-label="Show adult channels"
            />
          </label>

          <Show when={filter.hasActiveFilters()}>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-error focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              onClick={filter.clearFilters}
            >
              Clear filters
            </button>
          </Show>
        </div>

        {/* Category pills */}
        <Show when={filter.availableCategories().length > 0}>
          <div class="flex shrink-0 flex-wrap gap-2 border-b border-base-300 px-6 py-3">
            <For each={filter.availableCategories()}>
              {(cat) => {
                const isActive = () => filter.selectedCategory() === cat;
                return (
                  <button
                    type="button"
                    class={`rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors outline-none ${
                      isActive()
                        ? "bg-primary text-primary-content"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    } focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
                    onClick={() => filter.toggleCategory(cat)}
                    aria-pressed={isActive()}
                  >
                    {cat}
                  </button>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Channel grid / empty state */}
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <Show
            when={filter.filteredChannels().length > 0}
            fallback={
              <div class="flex h-full flex-col items-center justify-center gap-4 text-base-content/50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-16 w-16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="text-lg font-semibold">
                  No channels match your search
                </p>
                <p class="text-sm">
                  Try adjusting your filters or search term.
                </p>
                <button
                  type="button"
                  class="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={filter.clearFilters}
                >
                  Clear all filters
                </button>
              </div>
            }
          >
            <div
              ref={gridRef}
              class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3"
              onKeyDown={handleGridKeyDown}
              role="listbox"
              aria-label="Channel list"
            >
              <For each={filter.filteredChannels()}>
                {(channel, index) => (
                  <ChannelCard
                    channel={channel}
                    activeChannelId={props.activeChannelId}
                    onClick={props.onChannelSelect}
                    tabIndex={
                      gridFocusedIndex() === -1
                        ? index() === 0
                          ? 0
                          : -1
                        : gridFocusedIndex() === index()
                          ? 0
                          : -1
                    }
                    ref={(el) => {
                      if (el) cardRefs.set(channel.id, el);
                      else cardRefs.delete(channel.id);
                    }}
                    onFocus={() => setGridFocusedIndex(index())}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
