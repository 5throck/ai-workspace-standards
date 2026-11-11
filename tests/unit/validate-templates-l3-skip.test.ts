#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-l3-skip.test.ts — U-20261111-001 regression
//
// A direct run of scripts/validate-templates.ts in a project (L3) root that has
// no templates/ directory must exit 0 with the "not applicable" summary. Before
// v1.76.1 a module top-level guard called process.exit(1) at import time and
// preempted main()'s own skip.

import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Hermetic root: derived from this file's location, not process.cwd().
const ROOT = resolve(import.meta.dir, "..", "..");
const tmp = mkdtempSync(join(tmpdir(), "vt-l3-skip-"));

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("validate-templates L3 skip (U-20261111-001)", () => {
  test("exits 0 with 'not applicable' when templates/ is absent", () => {
    cpSync(join(ROOT, "scripts"), join(tmp, "scripts"), { recursive: true });
    const nodeModules = join(ROOT, "node_modules");
    if (existsSync(nodeModules)) symlinkSync(nodeModules, join(tmp, "node_modules"), "dir");
    expect(existsSync(join(tmp, "templates"))).toBe(false);

    const proc = Bun.spawnSync(["bun", join(tmp, "scripts", "validate-templates.ts"), "--json"], {
      cwd: tmp,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = proc.stdout.toString();
    expect(proc.exitCode).toBe(0);
    expect(stdout).toContain("not applicable: no templates/common");
    expect(proc.stderr.toString()).not.toContain("templates/ directory not found");
  }, 60000);
});
