/**
 * Pure M3U playlist parser (FR-1).
 *
 * Turns `#EXTM3U` / `#EXTINF` text into {@link Channel} objects. The parser is
 * a pure function: same input always yields the same output, no I/O, no
 * globals — so it is trivially unit-testable and reusable from both the
 * server endpoint (T003) and any client code.
 *
 * Field rules (exactly these fields, no more):
 *   - `id`        — `tvg-id` when present and non-empty, else `hash(name + url)`.
 *   - `name`      — `tvg-name`, else the comma-trailing display text, else `"Unknown"`.
 *   - `logo`      — `tvg-logo`, else `""`.
 *   - `url`       — the line following the `#EXTINF` line.
 *   - `categories`— `group-title` split on `;`, trimmed, non-empty entries only; `[]` when absent.
 *
 * Duplicate channels (same `id`) collapse to the **first** occurrence; there
 * is no `streams[]` array. A `#EXTINF` without a following URL line is
 * skipped. Blank / non-M3U input returns `{ ok: false, kind: "parse-error" }`.
 *
 * `# ponytail: no new npm deps — the id fallback uses a tiny FNV-1a hash.`
 */

// ---------------------------------------------------------------------------
// Channel model
// ---------------------------------------------------------------------------

/** A single parsed playlist entry. Exactly these fields, per FR-1. */
export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  categories: string[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ParseOk = { ok: true; channels: Channel[] };

export type ParseError = {
  ok: false;
  kind: "parse-error";
  message: string;
};

export type ParseResult = ParseOk | ParseError;

// ---------------------------------------------------------------------------
// Tiny deterministic hash (FNV-1a 32-bit) for the id fallback.
//
// We only need a stable, collision-reasonable identifier for channels that
// lack a `tvg-id`. FNV-1a is tiny, dependency-free, and deterministic across
// runtimes (unlike `crypto` hashing which would also be fine but heavier).
// ---------------------------------------------------------------------------

function hash(input: string): string {
  let h = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Attribute + EXTINF line parsing
// ---------------------------------------------------------------------------

interface ExtInfMeta {
  tvgId: string | undefined;
  tvgName: string | undefined;
  tvgLogo: string | undefined;
  groupTitle: string | undefined;
  trailing: string | undefined;
}

/** Matches `key="value"` pairs (the M3U attribute form). */
const ATTR_RE = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;

function parseAttributes(attrPart: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match = ATTR_RE.exec(attrPart);
  while (match !== null) {
    attrs[match[1]] = match[2];
    match = ATTR_RE.exec(attrPart);
  }
  return attrs;
}

/**
 * Parses a single `#EXTINF` line into its attributes + trailing display name.
 *
 * The line has the shape `#EXTINF:<duration> <attrs>,<display name>`. The
 * trailing display name is everything after the **first** comma that is not
 * inside a quoted attribute value, so attribute values containing commas
 * don't trick us into splitting too early.
 */
function parseExtInf(line: string): ExtInfMeta {
  const colon = line.indexOf(":");
  const rest = colon >= 0 ? line.slice(colon + 1) : "";

  // Find the first comma outside of quoted attribute values.
  let commaIdx = -1;
  let inQuotes = false;
  for (let k = 0; k < rest.length; k++) {
    const ch = rest[k];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      commaIdx = k;
      break;
    }
  }

  const attrPart = commaIdx >= 0 ? rest.slice(0, commaIdx) : rest;
  const trailing = commaIdx >= 0 ? rest.slice(commaIdx + 1).trim() : "";

  const attrs = parseAttributes(attrPart);

  return {
    tvgId: attrs["tvg-id"],
    tvgName: attrs["tvg-name"],
    tvgLogo: attrs["tvg-logo"],
    groupTitle: attrs["group-title"],
    trailing: trailing === "" ? undefined : trailing,
  };
}

// ---------------------------------------------------------------------------
// Category splitting
// ---------------------------------------------------------------------------

/**
 * Splits a `group-title` value on `;`, trims each entry, and drops empties.
 * e.g. `"A;B;;C"` → `["A", "B", "C"]`.
 */
function splitCategories(groupTitle: string): string[] {
  return groupTitle
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the value when it is a non-empty string, otherwise `undefined`. */
function nonEmpty(value: string | undefined): string | undefined {
  return value && value !== "" ? value : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse M3U text into a list of {@link Channel} objects.
 *
 * - Blank input → `{ ok: false, kind: "parse-error" }`.
 * - Input without `#EXTM3U` and without any `#EXTINF` → `{ ok: false, kind: "parse-error" }`.
 * - `#EXTINF` with no following URL line → entry skipped.
 * - Duplicate `id`s → first occurrence wins (no `streams[]`).
 *
 * @param text Raw playlist text (`#EXTM3U` / `#EXTINF`).
 */
export function parseM3U(text: string): ParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, kind: "parse-error", message: "Empty playlist" };
  }

  const lines = text.split(/\r\n|\r|\n/);

  const hasExtM3u = lines.some((l) => l.trimStart().startsWith("#EXTM3U"));
  const hasExtInf = lines.some((l) => l.trimStart().startsWith("#EXTINF"));
  if (!hasExtM3u && !hasExtInf) {
    return { ok: false, kind: "parse-error", message: "Not an M3U playlist" };
  }

  const channels: Channel[] = [];
  const seen = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trimStart().startsWith("#EXTINF")) {
      i++;
      continue;
    }

    const meta = parseExtInf(lines[i]);

    // The URL is the next non-blank, non-comment line after the #EXTINF.
    let url: string | null = null;
    let j = i + 1;
    while (j < lines.length) {
      const cand = lines[j].trim();
      if (cand === "") {
        j++;
        continue;
      }
      if (cand.startsWith("#")) {
        // Reached the next comment / #EXTINF with no URL for this entry.
        break;
      }
      url = cand;
      break;
    }

    if (url === null) {
      // #EXTINF without a following URL line → skip this entry.
      i++;
      continue;
    }

    const name = nonEmpty(meta.tvgName) ?? nonEmpty(meta.trailing) ?? "Unknown";
    const logo = nonEmpty(meta.tvgLogo) ?? "";
    const id = nonEmpty(meta.tvgId) ?? hash(name + url);
    const categories = meta.groupTitle ? splitCategories(meta.groupTitle) : [];

    if (!seen.has(id)) {
      seen.add(id);
      channels.push({ id, name, logo, url, categories });
    }

    i = j + 1;
  }

  return { ok: true, channels };
}
