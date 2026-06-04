/**
 * Channel info overlay — top-centered metadata shown on pointer activity.
 *
 * Fades in/out smoothly via the `visible` prop.  The parent (IptvApp) drives
 * visibility from the `showChrome` store state so all UI chrome fades together.
 *
 * Uses shared formatters from `channel-display.ts`.
 */

import type { JSX } from "solid-js";
import { categoryColor, qualityLabel } from "./channel-display";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface ChannelOverlayProps {
  name: string;
  category: string | null;
  quality: string | null;
  /** Whether the overlay is visible — drives a smooth opacity transition. */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelOverlay(
  props: ChannelOverlayProps,
): JSX.Element {
  const badge = () => qualityLabel(props.quality);

  return (
    <div
      class={`pointer-events-none absolute inset-0 z-10 select-none transition-opacity duration-500 ease-out ${
        props.visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div class="flex items-start justify-center pt-4 px-6">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-xl font-bold text-white drop-shadow-lg">
            {props.name}
          </h2>

          {props.category && (
            <span
              class={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase leading-tight shadow-md ${categoryColor(props.category)}`}
            >
              {props.category}
            </span>
          )}

          <span
            class={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase leading-tight shadow-md ${
              badge() === "HD"
                ? "bg-green-600 text-green-100"
                : "bg-gray-500 text-gray-100"
            }`}
          >
            {badge()}
          </span>
        </div>
      </div>
    </div>
  );
}
