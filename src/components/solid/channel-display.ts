/**
 * Channel display formatting — category colours, quality labels, logo fallbacks.
 *
 * Single source of truth for how channel metadata renders in the UI.
 * Both ChannelCard and ChannelOverlay import from here instead of duplicating
 * mapping tables and formatter functions.
 */

// ---------------------------------------------------------------------------
// Category → Tailwind class mapping
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<string, string> = {
  News: "bg-blue-600 text-blue-100",
  Entertainment: "bg-purple-600 text-purple-100",
  Sports: "bg-green-600 text-green-100",
  Music: "bg-pink-600 text-pink-100",
  Kids: "bg-yellow-500 text-yellow-900",
  Movies: "bg-red-600 text-red-100",
  Series: "bg-indigo-600 text-indigo-100",
  Religious: "bg-amber-600 text-amber-100",
  Education: "bg-teal-600 text-teal-100",
  Documentary: "bg-orange-600 text-orange-100",
  Lifestyle: "bg-rose-600 text-rose-100",
  Business: "bg-slate-600 text-slate-100",
  Weather: "bg-cyan-600 text-cyan-100",
  Science: "bg-emerald-600 text-emerald-100",
  Travel: "bg-sky-600 text-sky-100",
  Cooking: "bg-red-500 text-red-100",
};

const DEFAULT_CATEGORY_COLOR = "bg-gray-600 text-gray-100";

/** Resolve a category name to its Tailwind colour classes. */
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}

// ---------------------------------------------------------------------------
// Quality label normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a raw quality string ("1080p", "HD", "SD480", etc.) to a short
 * display label.  Returns "HD" for any HD-ish value, "SD" for SD-ish values,
 * or the raw string if it's something unusual.
 */
export function qualityLabel(raw: string | null): string {
  if (!raw) return "SD";
  const upper = raw.toUpperCase();
  if (upper.includes("HD") || upper.includes("1080") || upper.includes("720"))
    return "HD";
  if (upper.includes("SD") || upper.includes("480")) return "SD";
  return raw;
}

// ---------------------------------------------------------------------------
// Logo fallback: channel initial
// ---------------------------------------------------------------------------

/** First letter of the channel name, used as a logo fallback. */
export function channelInitial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
