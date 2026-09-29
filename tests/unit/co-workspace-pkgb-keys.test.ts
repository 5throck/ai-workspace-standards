/** Package B tests: T-013 key:label parsing, M11 error handling. */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readKeysFile, readKeyEntries, loadConfig } from "../../services/co-workspace/src/config";
import { credentialValid, principalFor } from "../../services/co-workspace/src/auth";

describe("readKeysFile — T-013", () => {
  test("strips labels from key:label format", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-a:alice\nsk-b\n# c\n");
      expect(readKeysFile(file)).toEqual(["sk-a", "sk-b"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readKeyEntries — T-013", () => {
  test("parses key:label with proper defaults", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-a:alice\nsk-b\n# c\n");
      expect(readKeyEntries(file)).toEqual([
        { key: "sk-a", label: "alice" },
        { key: "sk-b", label: "default" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("handles empty labels as default", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-x:");
      expect(readKeyEntries(file)).toEqual([{ key: "sk-x", label: "default" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns empty array for missing path", () => {
    expect(readKeyEntries(undefined)).toEqual([]);
  });

  test("warns on ENOENT and returns empty array", () => {
    const missingPath = join(tmpdir(), `missing-${crypto.randomUUID()}.keys`);
    const warnSpy = { called: false, msg: "" };
    const originalWarn = console.warn;
    console.warn = (msg: string) => {
      warnSpy.called = true;
      warnSpy.msg = msg;
    };
    try {
      const result = readKeyEntries(missingPath);
      expect(result).toEqual([]);
      expect(warnSpy.called).toBe(true);
      expect(warnSpy.msg).toContain("not found");
    } finally {
      console.warn = originalWarn;
    }
  });

  test("throws on other errors", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      expect(() => readKeyEntries(dir)).toThrow(/cannot read API key file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("credentialValid with labeled keys — T-013", () => {
  test("accepts bare key when file has label", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-a:alice");
      const cfg = loadConfig({ CO_WORKSPACE_API_KEYS_FILE: file });
      expect(credentialValid(cfg, "sk-a")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects full line with label", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-a:alice");
      const cfg = loadConfig({ CO_WORKSPACE_API_KEYS_FILE: file });
      expect(credentialValid(cfg, "sk-a:alice")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("principalFor with labeled keys — T-013", () => {
  test("returns label for labeled key in file", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-a:alice");
      const cfg = loadConfig({ CO_WORKSPACE_API_KEYS_FILE: file });
      expect(principalFor(cfg, "sk-a")).toBe("alice");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns default for unlabeled key in file", () => {
    const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "keys.txt");
    try {
      writeFileSync(file, "sk-b");
      const cfg = loadConfig({ CO_WORKSPACE_API_KEYS_FILE: file });
      expect(principalFor(cfg, "sk-b")).toBe("default");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("env keys always map to default label", () => {
    const cfg = loadConfig({ CO_WORKSPACE_API_KEYS: "x:y" });
    expect(principalFor(cfg, "x:y")).toBe("default");
  });
});
