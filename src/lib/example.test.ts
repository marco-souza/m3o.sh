import { describe, expect, test } from "bun:test";

describe("test example", async () => {
  test("2+2 = 4", () => {
    expect(2 + 2).toBe(4);
  });

  test("2+2 != 5", () => {
    expect(2 + 2).not.toBe(5);
  });
});
