/**
 * Unit tests for the validate-templates.ts `variant-common-shadow` arm
 * (v1.83.0, T-20261114-012): pure helpers computeShadowSet / classifyShadows /
 * collapseShadowItems, plus an exit-code check that the arm only WARNs.
 *
 * @version 1.0.0
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  type ShadowAllowlistEntry,
  classifyShadows,
  collapseShadowItems,
  computeShadowSet,
  shadowSha256,
} from "../../scripts/validate-templates.ts";

const tmp = mkdtempSync(join(tmpdir(), "vt-shadow-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function put(root: string, rel: string, body: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

const common = join(tmp, "common");
const vA = join(tmp, "co-a");
put(common, "same.md", "same\n");
put(common, "diff.md", "---\nv: 1\n---\nbody\n");
put(common, "crlf.md", "a\nb\n");
put(common, "only-common.md", "x\n");
put(common, "skills/s1/SKILL.md", "---\nv: 1\n---\nbody\n");
put(common, ".claude/skills/s1/SKILL.md", "---\nv: 1\n---\nbody\n");
put(vA, "same.md", "same\n");
put(vA, "diff.md", "---\nv: 2\n---\nbody\n");
put(vA, "crlf.md", "a\r\nb\r\n");
put(vA, "only-variant.md", "y\n");
put(vA, "skills/s1/SKILL.md", "---\nv: 2\n---\nbody\n");
put(vA, ".claude/skills/s1/SKILL.md", "---\nv: 2\n---\nbody\n");

const dirs = { "co-a": vA };
const own = (path: string): ShadowAllowlistEntry => ({ path, variants: "*", class: "variant-owned" });

describe("computeShadowSet", () => {
  const set = computeShadowSet(common, dirs);
  test("identical copies are silent", () => {
    expect(set.find((i) => i.path === "same.md")).toBeUndefined();
  });
  test("CRLF-only difference is not a shadow", () => {
    expect(set.find((i) => i.path === "crlf.md")).toBeUndefined();
  });
  test("a file present on one side only is ignored", () => {
    expect(set.find((i) => i.path === "only-common.md")).toBeUndefined();
    expect(set.find((i) => i.path === "only-variant.md")).toBeUndefined();
  });
  test("byte-different copy is a shadow, frontmatter-only detected", () => {
    const d = set.find((i) => i.path === "diff.md");
    expect(d).toEqual({ variant: "co-a", path: "diff.md", frontmatterOnly: true });
  });
});

describe("classifyShadows", () => {
  const set = computeShadowSet(common, dirs);
  const skillPaths = ["skills/s1/SKILL.md", ".claude/skills/s1/SKILL.md"];
  test("undeclared divergence is reported", () => {
    const r = classifyShadows(common, set, []);
    expect(r.undeclared.map((i) => i.path).sort()).toEqual(["diff.md", ...skillPaths].sort());
  });
  test("allowlisted divergence is silent", () => {
    const r = classifyShadows(common, set, [own("diff.md"), ...skillPaths.map(own)]);
    expect(r.undeclared).toEqual([]);
    expect(r.declaredSilent).toBe(3);
  });
  test("tracked entry with matching hash is silent; moved hash warns", () => {
    const hash = shadowSha256("---\nv: 1\n---\nbody\n");
    const tracked = (h: string): ShadowAllowlistEntry => ({
      path: "diff.md",
      variants: ["co-a"],
      class: "tracked",
      commonSha256: h,
    });
    const rest = skillPaths.map(own);
    expect(classifyShadows(common, set, [tracked(hash), ...rest]).moved).toEqual([]);
    const moved = classifyShadows(common, set, [tracked("0".repeat(64)), ...rest]).moved;
    expect(moved).toHaveLength(1);
    expect(moved[0].path).toBe("diff.md");
  });
  test("stale entries are detected", () => {
    const r = classifyShadows(common, set, [own("same.md"), { path: "diff.md", variants: ["co-b"], class: "variant-owned" }]);
    expect(r.stale).toEqual([
      { path: "same.md", variant: "*" },
      { path: "diff.md", variant: "co-b" },
    ]);
  });
});

describe("collapseShadowItems", () => {
  test("platform copies of one skill collapse to one item", () => {
    const items = collapseShadowItems([
      { variant: "co-a", path: "skills/s1/SKILL.md", frontmatterOnly: true },
      { variant: "co-a", path: ".claude/skills/s1/SKILL.md", frontmatterOnly: true },
      { variant: "co-a", path: "package.json", frontmatterOnly: false },
    ]);
    expect(items).toEqual(["package.json", "skill s1 (2 copies)"]);
  });
});

describe("live validator", () => {
  test("WARNs are emitted without changing the exit semantics of the arm", () => {
    const root = resolve(import.meta.dir, "..", "..");
    const proc = Bun.spawnSync(["bun", join(root, "scripts", "validate-templates.ts"), "--json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = proc.stdout.toString();
    const json = JSON.parse(out.slice(out.indexOf('{\n  "variantsScanned"')));
    expect(json.errors.filter((e: { check: string }) => e.check === "variant-common-shadow")).toEqual([]);
    expect(json.warnings.some((w: { check: string }) => w.check === "variant-common-shadow")).toBe(true);
  }, 120000);
});
