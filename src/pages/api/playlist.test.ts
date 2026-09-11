import { afterEach, describe, expect, test } from "bun:test";

import { POST } from "./playlist";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a `Response` whose body streams `text` as a single chunk so the
 * endpoint's streaming size-cap path is exercised (not the buffered fallback).
 */
function streamingResponse(text: string, init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "text/plain",
      ...(init?.headers ?? {}),
    },
  });
}

const M3U = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="c1" tvg-name="Channel One" tvg-logo="https://x/1.png" group-title="News",Channel One',
  "https://example.com/1.m3u8",
  '#EXTINF:-1 tvg-id="c2" tvg-name="Channel Two" group-title="News;Sports",Channel Two',
  "https://example.com/2.m3u8",
].join("\n");

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Shape of the JSON the endpoint returns (ok or error). Fields are all
// declared so assertions can read them without `unknown` noise; the cast is
// typing-only and does not change runtime behaviour.
type PlaylistJson = {
  channels: unknown[];
  count: number;
  fetchedAt: number;
  error: string;
  kind: string;
};

async function call(body: unknown) {
  const res = await POST({ request: makeRequest(body) } as Parameters<
    typeof POST
  >[0]);
  return { res, json: (await res.json()) as PlaylistJson };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/playlist", () => {
  test("valid M3U returns {channels,count,fetchedAt} and 200", async () => {
    globalThis.fetch = (async () =>
      streamingResponse(M3U)) as unknown as typeof fetch;

    const { res, json } = await call({
      url: "https://iptv-org.github.io/iptv/index.m3u",
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(json.channels)).toBe(true);
    expect(json.channels).toHaveLength(2);
    expect(json.count).toBe(2);
    expect(typeof json.fetchedAt).toBe("number");
    expect(json.channels[0]).toEqual({
      id: "c1",
      name: "Channel One",
      logo: "https://x/1.png",
      url: "https://example.com/1.m3u8",
      categories: ["News"],
    });
  });

  test("invalid scheme returns 400 {error, kind:'invalid-url'}", async () => {
    const { res, json } = await call({ url: "file:///etc/passwd" });
    expect(res.status).toBe(400);
    expect(json.kind).toBe("invalid-url");
    expect(typeof json.error).toBe("string");
  });

  test("malformed URL returns 400 invalid-url", async () => {
    const { res, json } = await call({ url: "not a url" });
    expect(res.status).toBe(400);
    expect(json.kind).toBe("invalid-url");
  });

  test("private-IP host returns 502 {error, kind:'fetch-failed'}", async () => {
    globalThis.fetch = (async () =>
      streamingResponse(M3U)) as unknown as typeof fetch;
    const { res, json } = await call({
      url: "https://192.168.0.1/playlist.m3u",
    });
    expect(res.status).toBe(502);
    expect(json.kind).toBe("fetch-failed");
    expect(json.error).toContain("internal address");
  });

  test("timeout (>15s) returns 502 {error, kind:'fetch-failed'}", async () => {
    // The endpoint wires a 15s AbortController timeout. We simulate that
    // controller firing by rejecting the fetch with an AbortError (the exact
    // shape `controller.abort()` produces), which the catch-block maps to
    // fetch-failed. This exercises the same code path the real 15s timeout
    // takes, without the wall-clock wait.
    globalThis.fetch = (async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    const { res, json } = await call({ url: "https://example.com/slow.m3u" });
    expect(res.status).toBe(502);
    expect(json.kind).toBe("fetch-failed");
    expect(json.error).toContain("timed out");
  });

  test("response >8MB returns 502 {error, kind:'too-large'}", async () => {
    // 9MB of '#' lines (still counts as not-m3u, but the size cap trips first).
    const huge = "#".repeat(9 * 1024 * 1024);
    globalThis.fetch = (async () =>
      streamingResponse(huge)) as unknown as typeof fetch;

    const { res, json } = await call({ url: "https://example.com/big.m3u" });
    expect(res.status).toBe(502);
    expect(json.kind).toBe("too-large");
  });

  test("non-M3U response returns 502 {error, kind:'not-m3u'}", async () => {
    globalThis.fetch = (async () =>
      streamingResponse(
        "<html><body>not a playlist</body></html>",
      )) as unknown as typeof fetch;

    const { res, json } = await call({ url: "https://example.com/page.html" });
    expect(res.status).toBe(502);
    expect(json.kind).toBe("not-m3u");
  });

  test("response containing #EXTINF (no #EXTM3U header) is accepted", async () => {
    const noHeader = [
      '#EXTINF:-1 tvg-id="x" tvg-name="X",X',
      "https://example.com/x.m3u8",
    ].join("\n");
    globalThis.fetch = (async () =>
      streamingResponse(noHeader)) as unknown as typeof fetch;

    const { res, json } = await call({ url: "https://example.com/p.m3u" });
    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
  });

  test("every response carries Cache-Control: no-store", async () => {
    globalThis.fetch = (async () =>
      streamingResponse(M3U)) as unknown as typeof fetch;
    const { res: ok } = await call({ url: "https://example.com/ok.m3u" });
    expect(ok.headers.get("Cache-Control")).toBe("no-store");

    const { res: bad } = await call({ url: "file:///x" });
    expect(bad.headers.get("Cache-Control")).toBe("no-store");
  });

  test("default playlist URL works through the endpoint unchanged", async () => {
    globalThis.fetch = (async () =>
      streamingResponse(M3U)) as unknown as typeof fetch;
    const { res, json } = await call({
      url: "https://iptv-org.github.io/iptv/index.m3u",
    });
    expect(res.status).toBe(200);
    expect(json.count).toBe(2);
    expect(json.fetchedAt).toBeGreaterThan(0);
  });
});
