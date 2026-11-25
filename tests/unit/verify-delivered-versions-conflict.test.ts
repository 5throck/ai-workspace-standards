#!/usr/bin/env bun
// @version 1.0.0
// verify-delivered-versions-conflict.test.ts — T-20261124-011 (design
// docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.4 test):
// a fixture project with a v2 manifest — one CONFLICT path with a matching
// hash gives `conflict`; one with a changed hash gives `conflict-overwritten`; a
// common script present only in `baselines` is probed; a template path under
// `scripts/**` that the manifest does not list is probed.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baselineKeyFor, toPosixPath } from "../../scripts/lib/upgrade-policy.ts";
import { sep } from "node:path";
import { type Finding, verifyDeliveredVersions } from "../../scripts/verify-delivered-versions.ts";

const dirs: string[] = [];
function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vdv-conflict-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const script = (v: string) => `// @version ${v}\nexport const a = 1;\n`;
const AGENT_PROJECT = `---\nname: kept\ntier: low\nversion: 1.0.0\n---\nbody\n`;
const AGENT_TEMPLATE = `---\nname: kept\ntier: low\nversion: 1.1.0\n---\nbody\n`;
const kindOf = (findings: Finding[], path: string) => findings.find((f) => f.path === path)?.kind;

describe("verifyDeliveredVersions — conflicts (design §4.4)", () => {
  const template = tree({
    "scripts/lib/common.ts": script("2.0.0"),
    "scripts/variant/only.ts": script("1.0.0"),
    "agents/kept.md": AGENT_TEMPLATE,
    "agents/edited.md": AGENT_TEMPLATE,
    "scripts/old.ts": script("2.0.0"),
  });

  test("a CONFLICT path with a matching hash is `conflict`, never `stale`", () => {
    const project = tree({
      "agents/kept.md": AGENT_PROJECT,
      "scripts/lib/common.ts": script("1.0.0"),
      "scripts/variant/only.ts": script("1.0.0"),
    });
    const findings = verifyDeliveredVersions({
      projectDir: project,
      templateDir: template,
      manifest: {
        files: ["scripts/variant/only.ts"],
        baselines: { "scripts/lib/common.ts": { hash: "x" } },
        pendingBackport: [{ path: "agents/kept.md", kind: "CONFLICT", projectHash: baselineKeyFor("agents/kept.md", AGENT_PROJECT) }],
      },
    });
    expect(kindOf(findings, "agents/kept.md")).toBe("conflict");
    expect(findings.filter((f) => f.path === "agents/kept.md")).toHaveLength(1);
  });

  test("a CONFLICT path whose project copy changed is `conflict-overwritten`", () => {
    const project = tree({ "agents/kept.md": AGENT_PROJECT });
    const findings = verifyDeliveredVersions({
      projectDir: project,
      templateDir: template,
      manifest: {
        pendingBackport: [{ path: "agents/kept.md", kind: "CONFLICT", projectHash: "0".repeat(64) }],
      },
    });
    expect(kindOf(findings, "agents/kept.md")).toBe("conflict-overwritten");
  });

  test("a decisions[] CONFLICT entry (no pendingBackport row) is `conflict`", () => {
    const project = tree({ "agents/edited.md": AGENT_PROJECT });
    const findings = verifyDeliveredVersions({
      projectDir: project,
      templateDir: template,
      manifest: { decisions: [{ path: "agents/edited.md", verdict: "CONFLICT" }] },
    });
    expect(kindOf(findings, "agents/edited.md")).toBe("conflict");
  });

  test("a common script present only in `baselines` is probed", () => {
    const project = tree({ "scripts/lib/common.ts": script("1.5.0") });
    const findings = verifyDeliveredVersions({
      projectDir: project,
      templateDir: template,
      manifest: { files: [], baselines: { "scripts/lib/common.ts": { hash: "x" } } },
    });
    expect(kindOf(findings, "scripts/lib/common.ts")).toBe("stale");
  });

  test("a template path under scripts/** the manifest does not list is probed", () => {
    const project = tree({});
    const findings = verifyDeliveredVersions({ projectDir: project, templateDir: template, manifest: { files: [] } });
    expect(kindOf(findings, "scripts/variant/only.ts")).toBe("absent");
    expect(kindOf(findings, "scripts/old.ts")).toBe("absent");
    // OS-independent: a template-derived finding is addressed by its manifest-style
    // (POSIX) path. Bun.Glob yields `\`-separated entries on Windows; PR #2177's
    // Windows CI received `undefined` here before the sweep normalised them.
    // The project tree is empty, so every template script is `absent` — exactly these three.
    expect(findings.map((f) => f.path).sort()).toEqual([
      "scripts/lib/common.ts",
      "scripts/old.ts",
      "scripts/variant/only.ts",
    ]);
    expect(findings.every((f) => !f.path.includes("\\"))).toBe(true);
  });

  test("toPosixPath: the Windows arm normalises Bun.Glob separators on any OS", () => {
    // Literal backslashes stand in for what Bun.Glob.scanSync yields on Windows
    // (it yields `/` here, so the real sweep cannot reproduce it on POSIX/macOS).
    expect(toPosixPath("scripts\\variant\\only.ts", "win32")).toBe("scripts/variant/only.ts");
    expect(toPosixPath("deck\\tests\\x.svg", "win32")).toBe("deck/tests/x.svg");
    expect(toPosixPath("a.ts", "win32")).toBe("a.ts");
    // POSIX: identity — a backslash is a legal filename character, never a separator.
    expect(toPosixPath("a\\b.ts", "darwin")).toBe("a\\b.ts");
    expect(toPosixPath("a\\b.ts", "linux")).toBe("a\\b.ts");
    // The default is the running platform, so the sweep is a no-op here.
    expect(toPosixPath("scripts/variant/only.ts")).toBe("scripts/variant/only.ts");
    expect(["win32", "darwin", "linux"]).toContain(process.platform);
    expect(toPosixPath(sep === "\\" ? "a\\b" : "a/b")).toBe("a/b");
  });

  test("a clean project has no findings and no conflict rows", () => {
    const project = tree({
      "scripts/lib/common.ts": script("2.0.0"),
      "scripts/variant/only.ts": script("1.0.0"),
      "scripts/old.ts": script("2.0.0"),
    });
    const findings = verifyDeliveredVersions({
      projectDir: project,
      templateDir: template,
      manifest: { files: ["scripts/lib/common.ts"] },
    });
    expect(findings).toEqual([]);
  });
});
