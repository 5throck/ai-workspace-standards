/** Package B tests: M5 isDeniedName and safeResolve. */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listTenantFiles, readTenantFile } from "../../services/co-workspace/src/tenant-files";

describe("isDeniedName behavior — M5", () => {
  test("allows normal files and dirs", () => {
    const projectDir = join(tmpdir(), `gw-proj-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(projectDir, { recursive: true });
    try {
      mkdirSync(join(projectDir, ".github"));
      mkdirSync(join(projectDir, "src"));
      writeFileSync(join(projectDir, ".github", "x.yml"), "test");
      writeFileSync(join(projectDir, ".gitignore"), "test");
      writeFileSync(join(projectDir, "src", "a.ts"), "");

      const list = listTenantFiles(projectDir);
      expect(list?.map((f) => f.name).sort()).toContain(".github");
      expect(list?.map((f) => f.name).sort()).toContain(".gitignore");

      expect(readTenantFile(projectDir, ".github/x.yml")).not.toBeNull();
      expect(readTenantFile(projectDir, "src/a.ts")).not.toBeNull();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("denies .git/, .env*, cert files", () => {
    const projectDir = join(tmpdir(), `gw-proj-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(projectDir, { recursive: true });
    try {
      mkdirSync(join(projectDir, ".git"));
      writeFileSync(join(projectDir, ".git", "config"), "");
      writeFileSync(join(projectDir, ".env.local"), "");
      mkdirSync(join(projectDir, "certs"));
      writeFileSync(join(projectDir, "certs", "a.pem"), "");
      writeFileSync(join(projectDir, "certs", "b.key"), "");
      mkdirSync(join(projectDir, "sub"));
      writeFileSync(join(projectDir, "sub", ".env"), "");

      expect(readTenantFile(projectDir, ".git/config")).toBeNull();
      expect(readTenantFile(projectDir, ".env.local")).toBeNull();
      expect(readTenantFile(projectDir, "certs/a.pem")).toBeNull();
      expect(readTenantFile(projectDir, "certs/b.key")).toBeNull();
      expect(readTenantFile(projectDir, "sub/.env")).toBeNull();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("excludes denied names from listing", () => {
    const projectDir = join(tmpdir(), `gw-proj-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(projectDir, { recursive: true });
    try {
      writeFileSync(join(projectDir, ".env.prod"), "");
      writeFileSync(join(projectDir, "k.pem"), "");
      writeFileSync(join(projectDir, "config.yaml"), "");
      writeFileSync(join(projectDir, "a.txt"), "");

      const list = listTenantFiles(projectDir);
      const names = list?.map((f) => f.name).sort() ?? [];
      expect(names).not.toContain(".env.prod");
      expect(names).not.toContain("k.pem");
      expect(names).toContain("config.yaml");
      expect(names).toContain("a.txt");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("allows config.yaml and names ending -home", () => {
    const projectDir = join(tmpdir(), `gw-proj-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(projectDir, { recursive: true });
    try {
      mkdirSync(join(projectDir, "hermes-home"));
      writeFileSync(join(projectDir, "config.yaml"), "test");
      writeFileSync(join(projectDir, "hermes-home", "auth.json"), "test");

      expect(readTenantFile(projectDir, "config.yaml")).not.toBeNull();
      // Note: hermes-home is a directory, so readTenantFile will return null
      // But it should appear in listing
      const list = listTenantFiles(projectDir);
      expect(list?.map((f) => f.name)).toContain("config.yaml");
      expect(list?.map((f) => f.name)).toContain("hermes-home");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
