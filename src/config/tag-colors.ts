const TAG_COLORS: Record<string, string> = {
  go: "#00ADD8",
  typescript: "#3178C6",
  astro: "#FF5D01",
  htmx: "#3366CC",
  sqlite: "#003B57",
  rust: "#DEA584",
  python: "#3776AB",
};

const FALLBACK_COLOR = "#6B7280";

export function getTagColor(tag: string): string {
  return TAG_COLORS[tag] ?? FALLBACK_COLOR;
}
