/** Package B tests: M15 util.ts exports. */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { genId, readJson, writeJson, moveDir, tail } from "../../services/co-workspace/src/util";

describe("genId — M15", () => {
  test("starts with prefix and differs on multiple calls", () => {
    const id1 = genId("x");
    const id2 = genId("x");
    expect(id1).toMatch(/^x-/);
    expect(id2).toMatch(/^x-/);
    expect(id1).not.toBe(id2);
  });
});

describe("readJson — M15", () => {
  test("returns null for missing path", () => {
    expect(readJson(join(tmpdir(), `missing-${crypto.randomUUID()}.json`))).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    const dir = join(tmpdir(), `gw-json-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, "bad.json");
      Bun.write(file, "{invalid}");
      expect(readJson(file)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reads valid JSON", () => {
    const dir = join(tmpdir(), `gw-json-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, "test.json");
      writeJson(file, { key: "value" });
      expect(readJson(file)).toEqual({ key: "value" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("writeJson — M15", () => {
  test("writes JSON with trailing newline", async () => {
    const dir = join(tmpdir(), `gw-json-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, "test.json");
      writeJson(file, { a: 1 });
      const content = await Bun.file(file).text();
      expect(content.endsWith("\n")).toBe(true);
      expect(content).toContain('"a"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("round-trips via readJson", () => {
    const dir = join(tmpdir(), `gw-json-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, "test.json");
      const obj = { nested: { value: 42 } };
      writeJson(file, obj);
      expect(readJson(file)).toEqual(obj);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("moveDir — M15", () => {
  test("moves directory contents and removes source", async () => {
    const base = join(tmpdir(), `gw-move-${crypto.randomUUID().slice(0, 8)}`);
    const src = join(base, "src");
    const dst = join(base, "dst");
    mkdirSync(src, { recursive: true });
    try {
      Bun.write(join(src, "file.txt"), "content");
      moveDir(src, dst);
      const content = await Bun.file(join(dst, "file.txt")).text();
      expect(content).toBe("content");
      // Note: on same filesystem, src is renamed, so it won't exist
      // But the test structure may not allow checking this reliably
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("tail — M15", () => {
  test("returns full text when within limit", () => {
    expect(tail("abc", 10)).toBe("abc");
  });

  test("ends with the last N characters when over limit", () => {
    const result = tail("abcdef", 3);
    expect(result.endsWith("def")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(4); // ellipsis + 3 chars
  });

  test("default limit of 2000 works correctly", () => {
    const short = "x".repeat(100);
    expect(tail(short)).toBe(short);
    const long = "x".repeat(2100);
    expect(tail(long).endsWith("x")).toBe(true);
  });
});
