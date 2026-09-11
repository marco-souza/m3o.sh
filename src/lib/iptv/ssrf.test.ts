import { describe, expect, test } from "bun:test";

import {
  defaultResolver,
  type HostResolver,
  isPrivateIp,
  validatePlaylistUrl,
  validateUrlScheme,
} from "@/lib/iptv/ssrf";

// ---------------------------------------------------------------------------
// Scheme validation
// ---------------------------------------------------------------------------

describe("validateUrlScheme", () => {
  test("accepts http and https", () => {
    expect(validateUrlScheme("http://example.com/foo")).toEqual({
      ok: true,
      url: new URL("http://example.com/foo"),
    });
    expect(validateUrlScheme("https://example.com/foo").ok).toBe(true);
  });

  test("rejects file: as invalid-url", () => {
    const r = validateUrlScheme("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("rejects data: as invalid-url", () => {
    const r = validateUrlScheme("data:text/plain,hello");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("rejects javascript: as invalid-url", () => {
    const r = validateUrlScheme("javascript:alert(1)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("rejects garbage input as invalid-url", () => {
    expect(validateUrlScheme("not a url").ok).toBe(false);
    expect(validateUrlScheme("").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IP range checks (pure, no DNS)
// ---------------------------------------------------------------------------

describe("isPrivateIp — IPv4", () => {
  test("blocks 10/8", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
  });

  test("blocks 172.16/12 (16–31) and allows 172.32", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
    expect(isPrivateIp("172.15.0.1")).toBe(false);
  });

  test("blocks 192.168/16", () => {
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.100")).toBe(true);
  });

  test("blocks 127/8 loopback", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.1.2.3")).toBe(true);
  });

  test("blocks 169.254/16 link-local", () => {
    expect(isPrivateIp("169.254.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  test("allows public IPv4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("140.82.112.4")).toBe(false); // github.com
  });
});

describe("isPrivateIp — IPv6", () => {
  test("blocks ::1 loopback", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  test("blocks fc00::/7 (unique-local)", () => {
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
  });

  test("blocks fe80::/10 (link-local)", () => {
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  test("allows public IPv6", () => {
    expect(isPrivateIp("2606:50c0:8000::153")).toBe(false); // github.io
  });

  test("handles IPv4-mapped IPv6", () => {
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Combined guard with an injectable resolver (no real DNS in tests)
// ---------------------------------------------------------------------------

const blockedResolver: HostResolver = async () => ["10.0.0.1"];
const publicResolver: HostResolver = async () => ["140.82.112.4"];

describe("validatePlaylistUrl", () => {
  test("blocks a host resolving to a private IPv4", async () => {
    const r = await validatePlaylistUrl(
      "http://internal.example/x",
      blockedResolver,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("allows a host resolving to a public IPv4", async () => {
    const r = await validatePlaylistUrl(
      "https://example.com/x",
      publicResolver,
    );
    expect(r.ok).toBe(true);
  });

  test("allows iptv-org.github.io when it resolves to a public IP", async () => {
    const r = await validatePlaylistUrl(
      "https://iptv-org.github.io/iptv/index.m3u",
      publicResolver,
    );
    expect(r.ok).toBe(true);
  });

  test("rejects scheme before resolving (file:)", async () => {
    let called = false;
    const r = await validatePlaylistUrl("file:///etc/passwd", async () => {
      called = true;
      return [];
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
    expect(called).toBe(false);
  });

  test("blocks IP-literal hostnames directly", async () => {
    const r = await validatePlaylistUrl("http://127.0.0.1/x", defaultResolver);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("blocks IPv6 loopback literal directly", async () => {
    const r = await validatePlaylistUrl("http://[::1]/x", defaultResolver);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid-url");
  });

  test("allows a public IP literal", async () => {
    const r = await validatePlaylistUrl("http://8.8.8.8/x", defaultResolver);
    expect(r.ok).toBe(true);
  });
});
