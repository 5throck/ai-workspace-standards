/**
 * Unit tests for the validate-templates.ts `variant-common-shadow` arm
 * (v1.83.0, T-20261114-012): pure helpers computeShadowSet / classifyShadows /
 * collapseShadowItems, plus an exit-code check that the arm only WARNs.
 *
 * v1.1.0 (2026-11-17, design docs/designs/2026-11-17-template-lifecycle-batch-design.md §4.2/§8
 *          PR-5, T-20261116-004): zone-override class — in-zone-only deltas go silent,
 *          out-of-zone drift / common-zone-dirty / nested-markers assertions fire on seeded
 *          violations; live-tree pins for the co-learning workflows.md conversion.
 *
 * @version 1.1.0
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  CANONICAL_EMPTY_ZONE_CONTENT,
  type ShadowAllowlistEntry,
  classifyShadows,
  collapseShadowItems,
  computeShadowSet,
  extractZoneContent,
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

// ─── zone-override (v1.85.0, design 2026-11-17-template-lifecycle-batch §4.2 / §8 PR-5) ──

const ZONE = "VARIANT-ROLE-BOUNDARY";
const ZS = `<!-- ${ZONE}-START -->`;
const ZE = `<!-- ${ZONE}-END -->`;
// Mirrors CANONICAL_EMPTY_ZONE_CONTENT (the B-A10 placeholder) as an inline literal so a
// canonical-side edit cannot silently unpin these fixtures.
const CANONICAL =
  "<!-- Add project-specific role boundary rules here. Example:\n" +
  "     | Design implementation approach | `[design specialist]` | `[implementation specialist]` |\n" +
  "     | Write or modify documentation | `[docs specialist]` | `[design specialist]` | -->";

const tmpZ = mkdtempSync(join(tmpdir(), "vt-zone-"));
afterAll(() => rmSync(tmpZ, { recursive: true, force: true }));

const commonZ = join(tmpZ, "common");
const vZdir = join(tmpZ, "co-z");
const withZone = (zoneContent: string, tail = "after\n"): string => `before\n${ZS}\n${zoneContent}\n${ZE}\n${tail}`;

put(commonZ, "zone-silent.md", withZone(CANONICAL));
put(commonZ, "zone-out.md", withZone(CANONICAL));
put(commonZ, "zone-nomarkers.md", "no managed zone\ncommon body\n");
put(commonZ, "zone-nested.md", withZone(CANONICAL));
put(commonZ, "plain-divergent.md", "---\nv: 1\n---\nbody\n");
put(vZdir, "zone-silent.md", withZone(`${CANONICAL}\n\n### Stream Boundaries (delta)\n\n| rows |\n`));
put(vZdir, "zone-out.md", withZone(CANONICAL, "after\nextra out-of-zone line\n"));
put(vZdir, "zone-nomarkers.md", "no managed zone\nvariant body\n");
put(vZdir, "zone-nested.md", withZone(`${CANONICAL}\n${ZS}\n${ZE}`));
put(vZdir, "plain-divergent.md", "---\nv: 2\n---\nbody\n");

const zoneDirs = { "co-z": vZdir };
const zoneFiles = ["zone-silent.md", "zone-out.md", "zone-nomarkers.md", "zone-nested.md", "plain-divergent.md"];
const zoneEntry = (path: string): ShadowAllowlistEntry => ({
  path,
  variants: ["co-z"],
  class: "zone-override",
  zones: [ZONE],
});

describe("zone-override classification (v1.85.0)", () => {
  const set = computeShadowSet(commonZ, zoneDirs, zoneFiles, [
    zoneEntry("zone-silent.md"),
    zoneEntry("zone-out.md"),
    zoneEntry("zone-nomarkers.md"),
    zoneEntry("zone-nested.md"),
  ]);
  const setFor = (path: string): typeof set => set.filter((i) => i.path === path);
  test("in-zone-only delta registers as a silent instance (design §8 PR-5: goes silent)", () => {
    const inst = set.find((i) => i.path === "zone-silent.md");
    expect(inst?.zoneInOnly).toBe(true);
    expect(inst?.zoneOutOf).toBe(false);
    const r = classifyShadows(commonZ, setFor("zone-silent.md"), [zoneEntry("zone-silent.md")], zoneDirs);
    expect(r.undeclared).toEqual([]);
    expect(r.outOfZone).toEqual([]);
    expect(r.declaredSilent).toBe(1);
  });
  test("OUT-OF-ZONE drift on a zone-override path still reports (design §8 PR-5)", () => {
    const inst = set.find((i) => i.path === "zone-out.md");
    expect(inst?.zoneOutOf).toBe(true);
    const r = classifyShadows(commonZ, set, [zoneEntry("zone-out.md")], zoneDirs);
    expect(r.outOfZone).toEqual([{ variant: "co-z", path: "zone-out.md", zones: [ZONE] }]);
    expect(r.declaredSilent).toBe(0); // out-of-zone drift is reported, not silent
  });
  test("missing managed markers on a zone-override path fail-closes as out-of-zone drift", () => {
    const inst = set.find((i) => i.path === "zone-nomarkers.md");
    expect(inst?.zoneOutOf).toBe(true);
    const r = classifyShadows(commonZ, set, [zoneEntry("zone-nomarkers.md")], zoneDirs);
    expect(r.outOfZone.map((o) => o.path)).toEqual(["zone-nomarkers.md"]);
  });
  test("nested managed markers inside the variant zone fire the assertion", () => {
    const r = classifyShadows(commonZ, set, [zoneEntry("zone-nested.md")], zoneDirs);
    expect(r.zoneNestedMarkers).toEqual([{ variant: "co-z", path: "zone-nested.md", zone: ZONE }]);
    // the precise nested-marker row suppresses the coarser out-of-zone row for the same instance
    expect(r.outOfZone).toEqual([]);
    expect(r.declaredSilent).toBe(0); // a violation is never silent
  });
  test("a zone-override path does not change other paths' classification", () => {
    const r = classifyShadows(commonZ, set, [zoneEntry("zone-silent.md")], zoneDirs);
    expect(r.undeclared.map((i) => i.path).sort()).toEqual([
      "plain-divergent.md",
      "zone-nested.md",
      "zone-nomarkers.md",
      "zone-out.md",
    ]);
    // a path with no zone-override entry keeps the exact pre-v1.85.0 instance shape
    expect(r.undeclared.find((i) => i.path === "plain-divergent.md")).toEqual({
      variant: "co-z",
      path: "plain-divergent.md",
      frontmatterOnly: true, // the fixture diverges only in frontmatter
    });
  });
  test("seeded violation: common's zone carrying content fires shadow-common-zone-dirty", () => {
    // Instance-independent structural assertion: common's workflows-zone analogue carries
    // non-canonical content → dirty, even with zero instances.
    put(commonZ, "zone-dirty-common.md", withZone(`${CANONICAL}\nsneaky common-side zone edit\n`));
    const r = classifyShadows(commonZ, [], [zoneEntry("zone-dirty-common.md")], zoneDirs);
    expect(r.commonZoneDirty).toEqual([{ path: "zone-dirty-common.md", zone: ZONE }]);
  });
  test("common's canonical-placeholder zone is clean", () => {
    const r = classifyShadows(commonZ, [], [zoneEntry("zone-silent.md")], zoneDirs);
    expect(r.commonZoneDirty).toEqual([]);
  });
});

describe("live tree pins (design 2026-11-17-template-lifecycle-batch §8 PR-5)", () => {
  const root = resolve(import.meta.dir, "..", "..");
  const realCommon = join(root, "templates", "common");
  const realCo = join(root, "templates", "co-learning");
  const wfRel = "docs/governance/agents/workflows.md";
  const allow = JSON.parse(readFileSync(join(root, "docs", "templates", "variant-shadow-allowlist.json"), "utf-8")) as {
    entries: ShadowAllowlistEntry[];
  };
  const wfEntry = allow.entries.find((e) => e.path === wfRel && e.class === "zone-override");

  test("allowlist entry is the converted zone-override entry (atomic switch, design §4.3)", () => {
    expect(wfEntry).toBeDefined();
    expect(wfEntry?.variants).toEqual(["co-learning"]);
    expect(wfEntry?.zones).toEqual(["VARIANT-ROLE-BOUNDARY"]);
    expect(wfEntry?.commonSha256).toBeUndefined(); // dropped — normalization subsumes it
    expect(wfEntry?.reason).toContain("2026-11-17-template-lifecycle-batch-design.md");
  });

  test("common's workflows.md zone is the canonical empty placeholder (B-A10 form)", () => {
    const text = readFileSync(join(realCommon, wfRel), "utf-8").replace(/\r\n/g, "\n");
    expect(extractZoneContent(text, ZONE)?.trim()).toBe(CANONICAL_EMPTY_ZONE_CONTENT[ZONE].trim());
  });

  test("co-learning workflows.md is in-zone-only and goes silent; no assertion fires", () => {
    expect(wfEntry).toBeDefined();
    const instances = computeShadowSet(realCommon, { "co-learning": realCo }, [wfRel], [wfEntry as ShadowAllowlistEntry]);
    expect(instances).toHaveLength(1); // still a shadow (raw bytes differ) ...
    expect(instances[0].zoneInOnly).toBe(true); // ... but only inside the zone
    expect(instances[0].zoneOutOf).toBe(false);
    const r = classifyShadows(realCommon, instances, [wfEntry as ShadowAllowlistEntry], { "co-learning": realCo });
    expect(r.outOfZone).toEqual([]);
    expect(r.commonZoneDirty).toEqual([]);
    expect(r.zoneNestedMarkers).toEqual([]);
    expect(r.stale).toEqual([]);
    expect(r.declaredSilent).toBe(1);
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
    // T-20261117-009 T1: stdout is pure JSON (no TRACE prefix, no slicing).
    expect(out.split("\n").some((line) => line.startsWith("TRACE"))).toBe(false);
    const json = JSON.parse(out);
    expect(json.errors.filter((e: { check: string }) => e.check === "variant-common-shadow")).toEqual([]);
    expect(json.warnings.some((w: { check: string }) => w.check === "variant-common-shadow")).toBe(true);
  }, 120000);
});
