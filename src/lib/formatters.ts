/**
 * Converts text to a URL-friendly slug.
 *
 * @example slugify("Hello World") // "hello-world"
 * @example slugify("My Cool Project!") // "my-cool-project"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Converts a hyphenated slug back to a display name (title case).
 *
 * @example formatTag("hello-world") // "Hello World"
 * @example formatTag("open-source") // "Open Source"
 */
export function formatTag(tag: string): string {
  return tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Replaces `<key>` placeholders in text with values from a map.
 * If a key is not found in the map, the placeholder is left unchanged.
 *
 * @example replaceLinks("Hello <name>", { name: "World" }) // "Hello World"
 * @example replaceLinks("Go to <site>", {}) // "Go to <site>"
 */
export function replaceLinks(
  text: string,
  map: Record<string, string>,
): string {
  return text.replace(/<(\w+)>/g, (_match, key: string) => map[key] ?? _match);
}
