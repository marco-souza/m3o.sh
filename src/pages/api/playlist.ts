/**
 * `POST /api/playlist` — generic M3U playlist proxy (FR-2).
 *
 * Accepts `{ url }`, validates the URL + runs the SSRF guard (T002), fetches
 * the remote playlist with a 15s timeout and an 8MB response cap, validates
 * that the body looks like M3U (starts with `#EXTM3U` or contains
 * `#EXTINF`), parses it via the pure parser (T001), and returns
 * `{ channels, count, fetchedAt }` on success.
 *
 * Errors carry `{ error, kind }` where `kind` is one of
 * `invalid-url | fetch-failed | not-m3u | too-large | parse-error`. HTTP 400
 * for `invalid-url`, 502 for everything else. Every response — success or
 * error — is sent with `Cache-Control: no-store`: each Refresh is a fresh
 * remote fetch.
 *
 * `# ponytail: no new deps — plain fetch + AbortController + a streaming
 *  size cap instead of buffering the whole body first.`
 */

import type { APIRoute } from "astro";

import { parseM3U } from "@/lib/iptv/m3u-parser";
import { validatePlaylistUrl } from "@/lib/iptv/ssrf";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Max wall-clock time for the remote fetch (FR-2). */
const FETCH_TIMEOUT_MS = 15_000;

/** Max response size before we abort with `too-large` (FR-2). */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Error kinds + helpers
// ---------------------------------------------------------------------------

type ErrorKind =
  | "invalid-url"
  | "fetch-failed"
  | "not-m3u"
  | "too-large"
  | "parse-error";

interface ErrorResponse {
  error: string;
  kind: ErrorKind;
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(
  error: string,
  kind: ErrorKind,
  status: number,
): Response {
  const body: ErrorResponse = { error, kind };
  return jsonResponse(body, status);
}

// ---------------------------------------------------------------------------
// Fetch with timeout + streaming size cap
// ---------------------------------------------------------------------------

/**
 * Fetches `url` with a 15s abort timeout and streams the body into a string,
 * aborting with `too-large` if it exceeds {@link MAX_RESPONSE_BYTES}.
 *
 * - Network error / timeout abort → `{ kind: "fetch-failed" }`.
 * - Non-2xx HTTP status → `{ kind: "fetch-failed" }`.
 * - Body exceeds the cap → `{ kind: "too-large" }`.
 */
async function fetchPlaylistText(
  url: URL,
): Promise<
  { ok: true; text: string } | { ok: false; kind: ErrorKind; message: string }
> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "audio/x-mpegurl, text/plain, */*" },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeoutId);
    // AbortController.abort() surfaces as an AbortError; treat both as a
    // timeout/network failure → fetch-failed.
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Request timed out after ${FETCH_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : "Network request failed";
    return { ok: false, kind: "fetch-failed", message };
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    return {
      ok: false,
      kind: "fetch-failed",
      message: `Remote returned ${response.status} ${response.statusText}`,
    };
  }

  // Stream the body so we can stop the moment we cross the 8MB line rather
  // than buffering the whole (potentially huge) response first.
  const reader = response.body?.getReader();
  if (!reader) {
    // No body stream available — fall back to a single buffered read.
    try {
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
        return {
          ok: false,
          kind: "too-large",
          message: `Response exceeded ${MAX_RESPONSE_BYTES} bytes`,
        };
      }
      return { ok: true, text };
    } catch (err) {
      return {
        ok: false,
        kind: "fetch-failed",
        message: err instanceof Error ? err.message : "Failed to read body",
      };
    }
  }

  const decoder = new TextDecoder("utf-8");
  let text = "";
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          try {
            await reader.cancel();
          } catch {
            // ignore cancel errors
          }
          return {
            ok: false,
            kind: "too-large",
            message: `Response exceeded ${MAX_RESPONSE_BYTES} bytes`,
          };
        }
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode(); // flush
  } catch (err) {
    return {
      ok: false,
      kind: "fetch-failed",
      message: err instanceof Error ? err.message : "Failed to read body",
    };
  }

  return { ok: true, text };
}

// ---------------------------------------------------------------------------
// M3U shape check (distinct from the parser's parse-error)
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `text` looks like an M3U playlist: it starts with
 * `#EXTM3U` (after optional leading whitespace/BOM) or contains `#EXTINF`
 * anywhere. Anything else is `not-m3u` per FR-2.
 */
function looksLikeM3U(text: string): boolean {
  // Strip a leading UTF-8 BOM, then leading whitespace.
  const trimmed = text.replace(/^\uFEFF/, "").trimStart();
  if (trimmed.startsWith("#EXTM3U")) return true;
  if (text.includes("#EXTINF")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// API route
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  // --- Parse the request body -------------------------------------------------
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", "invalid-url", 400);
  }

  const rawUrl =
    payload && typeof payload === "object" && "url" in payload
      ? String((payload as { url: unknown }).url)
      : "";

  if (rawUrl === "") {
    return errorResponse("Missing 'url' in request body", "invalid-url", 400);
  }

  // --- Validate URL + SSRF guard (T002) ---------------------------------------
  //
  // T002 collapses both bad-scheme and SSRF-blocked hosts into `invalid-url`.
  // FR-2 / T003 require SSRF-blocked hosts to surface as `fetch-failed` (502),
  // so we discriminate by the SSRF guard's distinctive message prefix and
  // re-map it. Bad scheme / malformed URL stays `invalid-url` (400).
  const check = await validatePlaylistUrl(rawUrl);
  if (!check.ok) {
    if (check.message.startsWith("Refusing to fetch internal address")) {
      return errorResponse(check.message, "fetch-failed", 502);
    }
    return errorResponse(check.message, "invalid-url", 400);
  }

  // --- Fetch with timeout + size cap -----------------------------------------
  const fetched = await fetchPlaylistText(check.url);
  if (!fetched.ok) {
    // fetch-failed / too-large both map to 502 per FR-2.
    return errorResponse(fetched.message, fetched.kind, 502);
  }

  // --- M3U shape validation --------------------------------------------------
  if (!looksLikeM3U(fetched.text)) {
    return errorResponse("Response is not an M3U playlist", "not-m3u", 502);
  }

  // --- Parse via the pure parser (T001) --------------------------------------
  const parsed = parseM3U(fetched.text);
  if (!parsed.ok) {
    return errorResponse(parsed.message, "parse-error", 502);
  }

  // --- Success ----------------------------------------------------------------
  return jsonResponse(
    {
      channels: parsed.channels,
      count: parsed.channels.length,
      fetchedAt: Date.now(),
    },
    200,
  );
};
