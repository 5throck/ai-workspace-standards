/** Package B tests: M11 error handling. */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readKeyEntries } from "../../services/co-workspace/src/config";
import { TenantRegistry } from "../../services/co-workspace/src/registry-db";

describe("readKeyEntries error handling — M11", () => {
  test("throws on directory path", () => {
    const dir = join(tmpdir(), `gw-dir-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    try {
      expect(() => readKeyEntries(dir)).toThrow(/cannot read API key file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("warns and returns empty on missing file", () => {
    const missingPath = join(tmpdir(), `missing-${crypto.randomUUID()}.keys`);
    const warnCalls: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnCalls.push(String(args[0]));
    };
    try {
      const result = readKeyEntries(missingPath);
      expect(result).toEqual([]);
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toContain("not found");
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("registry migrateLegacy error handling — M11", () => {
  test("logs and continues when legacy registry.json is corrupted", () => {
    const dataDir = join(tmpdir(), `gw-reg-${crypto.randomUUID().slice(0, 8)}`);
    const tenantsDir = join(dataDir, "tenants");
    mkdirSync(tenantsDir, { recursive: true });
    const registryJsonPath = join(tenantsDir, "registry.json");
    writeFileSync(registryJsonPath, "{"); // invalid JSON

    const errorCalls: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errorCalls.push(String(args[0]));
    };
    let registry: TenantRegistry | undefined;
    try {
      registry = new TenantRegistry(dataDir);
      expect(registry.list()).toEqual([]);
      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0]).toContain("legacy registry.json unreadable");
    } finally {
      console.error = originalError;
      registry?.close(); // Windows cannot delete an open SQLite file
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
