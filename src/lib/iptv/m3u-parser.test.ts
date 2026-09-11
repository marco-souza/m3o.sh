import { describe, expect, test } from "bun:test";

import { type Channel, parseM3U } from "@/lib/iptv/m3u-parser";

// ---------------------------------------------------------------------------
// Channel type shape
// ---------------------------------------------------------------------------

describe("Channel type", () => {
  test("exports exactly id, name, logo, url, categories", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="abc" tvg-name="Foo" tvg-logo="L" group-title="News",Foo
http://stream/foo`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ch = r.channels[0];
    expect(ch).toEqual({
      id: "abc",
      name: "Foo",
      logo: "L",
      url: "http://stream/foo",
      categories: ["News"],
    });
    // exactly these keys
    expect(Object.keys(ch).sort()).toEqual([
      "categories",
      "id",
      "logo",
      "name",
      "url",
    ]);
  });
});

// ---------------------------------------------------------------------------
// id resolution
// ---------------------------------------------------------------------------

describe("id resolution", () => {
  test("uses tvg-id when present and non-empty", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="my-id" tvg-name="Foo",Foo
http://stream/foo`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].id).toBe("my-id");
  });

  test("falls back to hash(name+url) when tvg-id missing", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo
http://stream/foo`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // deterministic hex id derived from name+url (not the raw strings)
    const id = r.channels[0].id;
    expect(id).toMatch(/^[0-9a-f]+$/);
    expect(id).not.toBe("Foo");
    expect(id).not.toBe("http://stream/foo");
  });

  test("falls back to hash(name+url) when tvg-id is empty", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="" tvg-name="Foo",Foo
http://stream/foo`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const withEmpty = r.channels[0].id;

    const noId = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo
http://stream/foo`,
    );
    expect(noId.ok).toBe(true);
    if (noId.ok) expect(noId.channels[0].id).toBe(withEmpty);
  });

  test("hash is deterministic for same name+url", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo
http://stream/foo
#EXTINF:-1 tvg-name="Foo",Foo
http://stream/foo`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // duplicates collapse to first occurrence -> only one channel
    expect(r.channels).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// name resolution
// ---------------------------------------------------------------------------

describe("name resolution", () => {
  test("uses tvg-name when present", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-name="TV Foo",Display
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].name).toBe("TV Foo");
  });

  test("uses comma-trailing text when tvg-name absent", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1,Trailing Name
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].name).toBe("Trailing Name");
  });

  test("falls back to Unknown when neither present", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].name).toBe("Unknown");
  });
});

// ---------------------------------------------------------------------------
// logo + categories
// ---------------------------------------------------------------------------

describe("logo", () => {
  test("uses tvg-logo when present", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-logo="http://logo.png",Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].logo).toBe("http://logo.png");
  });

  test("defaults to empty string", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1,Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].logo).toBe("");
  });
});

describe("categories (group-title)", () => {
  test("A;B;;C yields ['A','B','C']", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 group-title="A;B;;C",Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].categories).toEqual(["A", "B", "C"]);
  });

  test("absent group-title yields []", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1,Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].categories).toEqual([]);
  });

  test("empty group-title yields []", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 group-title="",Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].categories).toEqual([]);
  });

  test("entries are trimmed", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 group-title=" A ; B ",Foo
http://x`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].categories).toEqual(["A", "B"]);
  });
});

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

describe("duplicate collapse", () => {
  test("same tvg-id collapses to first occurrence", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-id="dup" tvg-name="First",First
http://a
#EXTINF:-1 tvg-id="dup" tvg-name="Second",Second
http://b`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].name).toBe("First");
    expect(r.channels[0].url).toBe("http://a");
    // no streams[] array on the channel
    expect(
      (r.channels[0] as unknown as Record<string, unknown>).streams,
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EXTINF without URL
// ---------------------------------------------------------------------------

describe("EXTINF without URL", () => {
  test("trailing EXTINF without URL is skipped", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo
#EXTINF:-1 tvg-name="Bar",Bar
http://b`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].name).toBe("Bar");
  });

  test("EXTINF at EOF without URL is skipped", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Error input
// ---------------------------------------------------------------------------

describe("error input", () => {
  test("empty string returns parse-error", () => {
    const r = parseM3U("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("parse-error");
  });

  test("whitespace-only returns parse-error", () => {
    const r = parseM3U("   \n\t  \n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("parse-error");
  });

  test("non-M3U text returns parse-error", () => {
    const r = parseM3U("just some plain text\nnot a playlist");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("parse-error");
  });

  test("HTML response returns parse-error", () => {
    const r = parseM3U("<!DOCTYPE html><html><body>hi</body></html>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("parse-error");
  });
});

// ---------------------------------------------------------------------------
// Purity / real-world snippet
// ---------------------------------------------------------------------------

describe("purity", () => {
  test("pure function: same input → same output", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="x" tvg-name="X" group-title="A;B",X
http://s/x`;
    const a = parseM3U(text);
    const b = parseM3U(text);
    expect(a).toEqual(b);
  });

  test("parses a realistic multi-channel playlist", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="c1" tvg-name="Channel One" tvg-logo="http://l/1" group-title="News;HD",Channel One
http://stream/1
#EXTINF:-1 tvg-name="Channel Two" group-title="Sports",Channel Two
http://stream/2
#EXTINF:-1,Channel Three
http://stream/3`;
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channels).toHaveLength(3);
    expect(r.channels[0]).toEqual({
      id: "c1",
      name: "Channel One",
      logo: "http://l/1",
      url: "http://stream/1",
      categories: ["News", "HD"],
    });
    expect(r.channels[1].name).toBe("Channel Two");
    expect(r.channels[1].categories).toEqual(["Sports"]);
    expect(r.channels[1].logo).toBe("");
    expect(r.channels[1].id).toMatch(/^[0-9a-f]+$/);
    expect(r.channels[2].name).toBe("Channel Three");
  });

  test("handles CRLF line endings", () => {
    const text = '#EXTM3U\r\n#EXTINF:-1 tvg-id="z",Z\r\nhttp://z';
    const r = parseM3U(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.channels).toHaveLength(1);
      expect(r.channels[0].url).toBe("http://z");
    }
  });

  test("skips blank lines between EXTINF and URL", () => {
    const r = parseM3U(
      `#EXTM3U
#EXTINF:-1 tvg-name="Foo",Foo

http://foo`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.channels[0].url).toBe("http://foo");
  });

  test("is unit-testable: Channel is the exported type", () => {
    const ch: Channel = {
      id: "x",
      name: "X",
      logo: "",
      url: "u",
      categories: [],
    };
    expect(ch.id).toBe("x");
  });
});
