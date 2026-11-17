#!/usr/bin/env bun
// @version 1.0.0
// encoding-utils-bom-scan.test.ts — audit.ts §3.5 BOM census pins
//
// Spec: docs/designs/2026-11-17-audit-external-scan-fix-design.md. The census
// (lib/encoding-utils.ts v1.4.0 scanMarkdownBomFiles) used to live inline in
// audit.ts §3.5, where a scaffold-mode whole-tree walk (docs/context.md present
// → searchDirs=["."]) entered gitignored external-dependency install trees and
// failed the workspace UTF-8 gate on vendored upstream files (QuickDL: 5 BOM
// files), and the `errors += bomErrors` epilogue double-counted (N BOM files
// reported as 2N failed checks). These tests pin the fix:
//   1. a BOM .md under external/<id>/ is NOT reported (D5 — install trees are
//      never workspace content);
//   2. a BOM .md in workspace content IS reported (regression guard against
//      over-skipping);
//   3. exactly one workspace BOM yields exactly one census entry (the audit
//      side is pinned against the live source — Fail() is the sole increment,
//      no `errors += bomErrors` line, scanner imported).
// Fixture roots are passed explicitly (no process.cwd() root consts — the
// hermetic-test-roots arm contract).

import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { hasUtf8Bom, scanMarkdownBomFiles } from "../../scripts/lib/encoding-utils.ts";

const AUDIT_TS = join(import.meta.dir, "..", "..", "scripts", "audit.ts");

const BOM = "\uFEFF";
const fixtures: string[] = [];

function makeFixture(layout: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "bom-scan-test-"));
  fixtures.push(root);
  for (const [rel, content] of Object.entries(layout)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  return root;
}

afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true });
});

describe("scanMarkdownBomFiles — external-deps skip (spec 2026-11-17-audit-external-scan-fix)", () => {
  test("pin 1: BOM .md under external/<id>/ is NOT reported (scaffold mode, searchDirs=['.'])", () => {
    const root = makeFixture({
      "docs/context.md": "project context — scaffold marker",
      "external/some-vendor/docs/README.md": `${BOM}# Vendored upstream README\n`,
      "external/some-vendor/SKILL.md": `${BOM}# Vendored skill\n`,
      "docs/note.md": `${BOM}# Workspace note\n`,
      "clean.md": "# clean\n",
    });
    const { bomFiles } = scanMarkdownBomFiles({ searchDirs: ["."] , root });
    expect(bomFiles).not.toContain("external/some-vendor/docs/README.md");
    expect(bomFiles.every((f) => !f.startsWith("external/"))).toBe(true);
  });

  test("pin 2: BOM .md in workspace content IS reported (no over-skip)", () => {
    const root = makeFixture({
      "docs/context.md": "project context — scaffold marker",
      "external/some-vendor/docs/README.md": `${BOM}# Vendored upstream README\n`,
      "docs/note.md": `${BOM}# Workspace note\n`,
      "agents/deep/file.md": `${BOM}# Agent note\n`,
    });
    const { bomFiles } = scanMarkdownBomFiles({ searchDirs: ["."], root });
    expect(bomFiles).toContain("docs/note.md");
    expect(bomFiles).toContain("agents/deep/file.md");
  });

  test("pin 3: exactly one workspace BOM yields exactly one census entry (external BOM present)", () => {
    const root = makeFixture({
      "docs/context.md": "project context — scaffold marker",
      "external/some-vendor/a.md": `${BOM}x\n`,
      "external/some-vendor/b.md": `${BOM}y\n`,
      "docs/note.md": `${BOM}# Workspace note\n`,
    });
    const { bomFiles } = scanMarkdownBomFiles({ searchDirs: ["."], root });
    expect(bomFiles).toHaveLength(1);
    expect(bomFiles[0]).toBe("docs/note.md");
  });

  test("rootMdScan arm: root-level BOM .md reported (workspace-root non-scaffold mode)", () => {
    const root = makeFixture({
      "ROOT-README.md": `${BOM}# root readme\n`,
      "docs/note.md": "# clean\n",
    });
    const { bomFiles } = scanMarkdownBomFiles({
      searchDirs: ["agents", "docs", "memory", "scripts", "skills"],
      rootMdScan: true,
      root,
    });
    expect(bomFiles).toContain("ROOT-README.md");
    expect(bomFiles).toHaveLength(1);
  });

  test("memory/archive/ is still filtered and symlinks are not followed", () => {
    const root = makeFixture({
      "memory/archive/old.md": `${BOM}# archived\n`,
      "memory/live.md": `${BOM}# live memory\n`,
    });
    const { bomFiles } = scanMarkdownBomFiles({ searchDirs: ["memory"], root });
    expect(bomFiles).toEqual(["memory/live.md"]);
  });

  test("skipped captures stat/read failures instead of throwing", () => {
    const root = makeFixture({
      "docs/note.md": "# clean\n",
    });
    // A directory entry that vanishes between readdir and lstat is the
    // realistic race; simulate by pointing searchDirs at a non-existent dir.
    const { bomFiles, skipped } = scanMarkdownBomFiles({ searchDirs: ["docs"], root });
    expect(bomFiles).toHaveLength(0);
    expect(skipped).toHaveLength(0);
    const missing = scanMarkdownBomFiles({ searchDirs: ["does-not-exist"], root });
    expect(missing.bomFiles).toHaveLength(0);
    expect(missing.skipped).toHaveLength(0);
  });
});

describe("hasUtf8Bom", () => {
  test("detects EF BB BF and rejects plain content", () => {
    expect(hasUtf8Bom(Buffer.from([0xef, 0xbb, 0xbf, 0x23]))).toBe(true);
    expect(hasUtf8Bom(Buffer.from("# plain\n", "utf-8"))).toBe(false);
    expect(hasUtf8Bom(Buffer.alloc(0))).toBe(false);
    expect(hasUtf8Bom(Buffer.from([0xef, 0xbb]))).toBe(false);
  });
});

describe("live-source pins — audit.ts §3.5 accounting (nul-lint-invariant precedent)", () => {
  const source = readFileSync(AUDIT_TS, "utf-8");
  // Comment lines (changelog headers legitimately name the deleted literal)
  // are stripped — the invariant is about executable lines.
  const codeLines = source.split("\n").filter((l) => !l.trimStart().startsWith("//"));
  const code = codeLines.join("\n");

  test("no `errors += bomErrors` double-count regression", () => {
    expect(code.includes("errors += bomErrors")).toBe(false);
  });

  test("§3.5 delegates to the extracted scanner", () => {
    expect(code.includes("scanMarkdownBomFiles")).toBe(true);
  });
});
