/**
 * URL validation + SSRF guard for the playlist proxy endpoint (FR-2).
 *
 * Two responsibilities, exposed as a single shared entry point so the
 * endpoint never duplicates the logic:
 *
 *   1. {@link validatePlaylistUrl} — parses the URL and rejects any scheme
 *      other than `http:` / `https:` (e.g. `file:`, `data:`, `javascript:`),
 *      returning `{ kind: "invalid-url" }`.
 *   2. An optional host-resolution check that blocks obvious internal
 *      targets (private / loopback / link-local ranges) before fetching.
 *
 * `# ponytail: blocks obvious internal targets; DNS-rebinding hardening is
 *  out of scope (see PRD Non-Goal 5).`
 */

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type UrlCheckError = {
  ok: false;
  kind: "invalid-url";
  message: string;
};

export type UrlCheckOk = {
  ok: true;
  url: URL;
};

export type UrlCheckResult = UrlCheckOk | UrlCheckError;

// ---------------------------------------------------------------------------
// Scheme validation
// ---------------------------------------------------------------------------

/**
 * Parses `raw` and ensures it uses the `http:` or `https:` scheme.
 * Returns `{ ok: false, kind: "invalid-url" }` for anything else
 * (`file:`, `data:`, `javascript:`, malformed input, …).
 */
export function validateUrlScheme(raw: string): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, kind: "invalid-url", message: "URL is not valid" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      kind: "invalid-url",
      message: `Scheme '${url.protocol}' is not allowed (http/https only)`,
    };
  }

  return { ok: true, url };
}

// ---------------------------------------------------------------------------
// IPv4 helpers
// ---------------------------------------------------------------------------

const IPV4_OCTET = 256;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = result * IPV4_OCTET + n;
  }
  return result >>> 0;
}

interface Ipv4Range {
  base: number;
  mask: number;
}

// Private / loopback / link-local ranges per FR-2.
const IPV4_BLOCKED_RANGES: Ipv4Range[] = [
  { base: 0x0a000000, mask: 0xff000000 }, // 10.0.0.0/8
  { base: 0xac100000, mask: 0xfff00000 }, // 172.16.0.0/12
  { base: 0xc0a80000, mask: 0xffff0000 }, // 192.168.0.0/16
  { base: 0x7f000000, mask: 0xff000000 }, // 127.0.0.0/8
  { base: 0xa9fe0000, mask: 0xffff0000 }, // 169.254.0.0/16 (link-local)
];

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return IPV4_BLOCKED_RANGES.some(
    (range) => (value & range.mask) >>> 0 === range.base,
  );
}

// ---------------------------------------------------------------------------
// IPv6 helpers
// ---------------------------------------------------------------------------

/**
 * Expands an IPv6 literal (with `::` compression and optional embedded
 * IPv4) into a 16-byte array, or `null` when it cannot be parsed.
 */
function ipv6ToBytes(ip: string): Uint8Array | null {
  // Allow surrounding brackets (URL.hostname may keep them) but strip them.
  let address = ip.trim();
  if (address.startsWith("[")) address = address.slice(1);
  if (address.endsWith("]")) address = address.slice(0, -1);

  let halves: string[];
  if (address.includes("::")) {
    halves = address.split("::");
    if (halves.length !== 2) return null; // multiple "::"
  } else {
    halves = [address, ""];
  }

  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves[1] === "" ? [] : halves[1].split(":");

  // Embedded IPv4 (e.g. ::ffff:1.2.3.4) occupies two trailing groups.
  let ipv4Groups = 0;
  const groups: number[] = [];
  for (const part of head) groups.push(parseGroup(part));
  for (const part of tail) {
    if (part.includes(".")) {
      const v4 = ipv4ToInt(part);
      if (v4 === null) return null;
      groups.push((v4 >> 16) & 0xffff, v4 & 0xffff);
      ipv4Groups = 2;
    } else {
      groups.push(parseGroup(part));
    }
  }

  if (groups.includes(-1)) return null;

  const missing = 8 - groups.length;
  if (missing < 0) return null;
  if (!address.includes("::") && missing !== 0) return null;
  if (address.includes("::") && missing === 0 && ipv4Groups === 0) {
    // "::" present but nothing to fill — still allow only if it was "::"
    return null;
  }

  const full = [
    ...groups.slice(0, head.length),
    ...new Array(missing).fill(0),
    ...groups.slice(head.length),
  ];
  if (full.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (full[i] >> 8) & 0xff;
    bytes[i * 2 + 1] = full[i] & 0xff;
  }
  return bytes;
}

function parseGroup(part: string): number {
  if (part === "") return -1;
  if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return -1;
  return Number.parseInt(part, 16);
}

interface Ipv6Range {
  // First 16 bytes of the network prefix; remaining bytes ignored per mask.
  prefix: Uint8Array;
  maskBits: number;
}

function makeIpv6Range(prefixGroups: number[], maskBits: number): Ipv6Range {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8 && i < prefixGroups.length; i++) {
    bytes[i * 2] = (prefixGroups[i] >> 8) & 0xff;
    bytes[i * 2 + 1] = prefixGroups[i] & 0xff;
  }
  return { prefix: bytes, maskBits };
}

const IPV6_BLOCKED_RANGES: Ipv6Range[] = [
  // ::1/128 (loopback)
  makeIpv6Range([0, 0, 0, 0, 0, 0, 0, 1], 128),
  // fc00::/7 (unique-local)
  makeIpv6Range([0xfc00, 0, 0, 0, 0, 0, 0, 0], 7),
  // fe80::/10 (link-local)
  makeIpv6Range([0xfe80, 0, 0, 0, 0, 0, 0, 0], 10),
];

function isBlockedIpv6(ip: string): boolean {
  const bytes = ipv6ToBytes(ip);
  if (!bytes) return false;
  // IPv4-mapped (::ffff:a.b.c.d) → delegate to the IPv4 check.
  const mapped = extractIpv4Mapped(bytes);
  if (mapped) return isBlockedIpv4(mapped);
  for (const range of IPV6_BLOCKED_RANGES) {
    if (matchesPrefix(bytes, range.prefix, range.maskBits)) return true;
  }
  return false;
}

function extractIpv4Mapped(bytes: Uint8Array): string | null {
  // ::ffff:0:0/96 → first 10 bytes 0, bytes[10..11] = 0xff 0xff
  for (let i = 0; i < 10; i++) if (bytes[i] !== 0) return null;
  if (bytes[10] !== 0xff || bytes[11] !== 0xff) return null;
  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}

function matchesPrefix(
  bytes: Uint8Array,
  prefix: Uint8Array,
  maskBits: number,
): boolean {
  const fullBytes = maskBits >> 3;
  const leftoverBits = maskBits & 7;
  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  if (leftoverBits > 0) {
    const mask = 0xff << (8 - leftoverBits);
    if ((bytes[fullBytes] & mask) !== (prefix[fullBytes] & mask)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Combined IP check
// ---------------------------------------------------------------------------

function isIpv4(ip: string): boolean {
  return ip.includes(".") && !ip.includes(":");
}

function isIpv6(ip: string): boolean {
  return ip.includes(":");
}

/**
 * Returns `true` when `ip` (an IPv4 or IPv6 literal) falls into a
 * private / loopback / link-local range. Unknown formats return `false`
 * (they are left to the runtime's own fetch guard).
 */
export function isPrivateIp(ip: string): boolean {
  if (isIpv4(ip)) return isBlockedIpv4(ip);
  if (isIpv6(ip)) return isBlockedIpv6(ip);
  return false;
}

// ---------------------------------------------------------------------------
// Host resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a hostname to its address literals. IP literals are returned
 * as-is (still validated against blocked ranges). Hostnames are resolved
 * via `node:dns/promises` when the runtime exposes it; on runtimes
 * without a DNS module (e.g. Cloudflare Workers) resolution is skipped
 * and the fetch itself relies on the runtime's guard — DNS-rebinding
 * hardening is explicitly out of scope (PRD Non-Goal 5).
 */
export type HostResolver = (hostname: string) => Promise<string[]>;

export const defaultResolver: HostResolver = async (hostname) => {
  if (isIpv4(hostname) || isIpv6(hostname)) return [hostname];
  try {
    const dns = await import("node:dns/promises");
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ]);
    return [...v4, ...v6];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Combined guard (used by the playlist endpoint)
// ---------------------------------------------------------------------------

/**
 * Validates the URL scheme and runs the SSRF guard against the resolved
 * host addresses. This is the single entry point shared by the endpoint
 * (no duplication): pass the raw URL, get a {@link UrlCheckResult}.
 *
 * @param raw    URL string from the request body.
 * @param resolver Optional host resolver (defaults to `node:dns`).
 */
export async function validatePlaylistUrl(
  raw: string,
  resolver: HostResolver = defaultResolver,
): Promise<UrlCheckResult> {
  const scheme = validateUrlScheme(raw);
  if (!scheme.ok) return scheme;

  const addresses = await resolver(scheme.url.hostname);
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      return {
        ok: false,
        kind: "invalid-url",
        message: `Refusing to fetch internal address: ${ip}`,
      };
    }
  }

  return { ok: true, url: scheme.url };
}
