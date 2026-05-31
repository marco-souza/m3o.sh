import { describe, expect, test } from "bun:test";
import { formatTag, replaceLinks, slugify } from "./formatters";

describe("slugify", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("handles multiple spaces", () => {
    expect(slugify("My   Cool   Project")).toBe("my-cool-project");
  });

  test("removes special characters", () => {
    expect(slugify("Hello! @World# $%^")).toBe("hello-world");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  test("handles mixed case and punctuation", () => {
    expect(slugify("My Cool Project!")).toBe("my-cool-project");
  });

  test("handles single word", () => {
    expect(slugify("Astro")).toBe("astro");
  });

  test("handles camelCase", () => {
    expect(slugify("myCoolProject")).toBe("mycoolproject");
  });

  test("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  test("returns empty string for only special chars", () => {
    expect(slugify("!@#$%")).toBe("");
  });
});

describe("formatTag", () => {
  test("replaces hyphens with spaces and capitalizes", () => {
    expect(formatTag("hello-world")).toBe("Hello World");
  });

  test("handles single word", () => {
    expect(formatTag("astro")).toBe("Astro");
  });

  test("handles multiple hyphens", () => {
    expect(formatTag("open-source-tool")).toBe("Open Source Tool");
  });

  test("handles already formatted text", () => {
    expect(formatTag("Hello World")).toBe("Hello World");
  });

  test("handles empty string", () => {
    expect(formatTag("")).toBe("");
  });

  test("preserves numbers", () => {
    expect(formatTag("hello-2-world")).toBe("Hello 2 World");
  });
});

describe("replaceLinks", () => {
  test("replaces placeholders with map values", () => {
    expect(replaceLinks("Hello <name>", { name: "World" })).toBe("Hello World");
  });

  test("handles multiple placeholders", () => {
    expect(
      replaceLinks("<greeting> <name>!", {
        greeting: "Hello",
        name: "World",
      }),
    ).toBe("Hello World!");
  });

  test("leaves unknown placeholders unchanged", () => {
    expect(replaceLinks("Hello <name>", {})).toBe("Hello <name>");
  });

  test("leaves unknown keys while replacing known ones", () => {
    expect(replaceLinks("<a> and <b>", { a: "first" })).toBe("first and <b>");
  });

  test("handles HTML values in map", () => {
    expect(
      replaceLinks("Visit <site>", {
        site: '<a href="https://example.com">Example</a>',
      }),
    ).toBe('Visit <a href="https://example.com">Example</a>');
  });

  test("handles empty text", () => {
    expect(replaceLinks("", { key: "value" })).toBe("");
  });

  test("handles empty map", () => {
    expect(replaceLinks("Hello World", {})).toBe("Hello World");
  });

  test("handles text with no placeholders", () => {
    expect(replaceLinks("Hello World", { name: "value" })).toBe("Hello World");
  });
});
