#!/usr/bin/env bun
// @version 2.0.0
// v2.0.0 (2026-11-28, T-20261128-004 — design
//           docs/designs/2026-11-28-origin-l2-drift-design.md §3.3/§3.4):
//           check-drift repair + frontmatter-preserving heal.
//           (1) Unscoped (no --skill/--script) mode now enumerates ALL
//           common↔variant pairs: every templates/common skill (and script)
//           against every co-* variant copy that exists — the old loop built
//           `diffs` only inside the scoped branches, so unscoped --check-drift
//           printed the header over an empty array and exited 0 (the no-op).
//           (2) Classification is a NUMERIC semver compare on both sides'
//           version (frontmatter `version` for skills, `@version` header for
//           scripts): L2-STALE (common strictly newer), L2-AHEAD (variant
//           strictly newer), SAME-VER-DIFF (equal version, differing bytes),
//           in-sync, missing. The lexicographic trap ("1.6.0" > "1.10.0" as
//           strings) misfiled co-safety sync as L2-AHEAD — reproduced by the
//           design; numeric compare fixes it.
//           (3) Exit semantics: --check-drift exits 1 iff any L2-STALE,
//           SAME-VER-DIFF, missing, or UNDECLARED L2-AHEAD row exists.
//           L2-AHEAD rows covered by a `fork` entry in
//           docs/templates/variant-shadow-allowlist.json (DEC-20261128-001:
//           the 7 re-derived legitimate variant forks) print annotated but do
//           not fail — a fork must be DECLARED to exist, so an undeclared
//           L2-AHEAD still fails the gate.
//           (4) --apply heals only L2-STALE skill rows via
//           lib/skill-frontmatter-merge.ts healSkillFile — body from the
//           common canonical, variant frontmatter preserved verbatim except
//           stamp advance + absent-key fill (byte-copy --apply is FORBIDDEN
//           for scope-bearing copies: it flips `scope: co-*` → `scope: common`,
//           verified destructive). Script applies keep byte-copy (scripts have
//           no variant frontmatter). L2-AHEAD rows and fork-declared rows are
//           REFUSED with an error naming the fork declaration requirement —
//           never written. SAME-VER-DIFF needs a human ruling and is refused.
//           Scoped single-target runs keep their meaning; `missing` applies
//           byte-copy-create the common source (no variant identity exists to
//           preserve on a not-yet-existing copy).
//
// v1.0.1: previous behavior — scoped-only diff enumeration, byte-copy apply.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { compareVersions, healSkillFile, readVersion, splitFrontmatter } from "./lib/skill-frontmatter-merge.ts";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isCheckDrift = args.includes("--check-drift");
const isApply = args.includes("--apply") && !isDryRun && !isCheckDrift;

const variantArg = args.find((a) => a.startsWith("--variant="));
const skillArg = args.find((a) => a.startsWith("--skill="));
const scriptArg = args.find((a) => a.startsWith("--script="));

if (!variantArg && !isCheckDrift) {
  console.error(
    "Usage: bun scripts/sync-skills-to-l2.ts [--variant=<co-*>] [--skill=<name>] [--script=<name>] [--dry-run|--check-drift|--apply]",
  );
  if (import.meta.main) {
    process.exit(1);
  }
}

const ROOT = process.cwd();
const templatesDir = join(ROOT, "templates");
const variants = variantArg ? [variantArg.split("=")[1]] : readdirSync(templatesDir).filter((d) => d.startsWith("co-"));

const l1SkillsDir = join(templatesDir, "common", "skills");
const l1ScriptsDir = join(templatesDir, "common", "scripts");

// ── fork declarations (design §3.3) ──────────────────────────────────────────
export interface ForkDeclarations {
  /** `${variant}\0${skillName}` → allowlist path note */
  byPair: Map<string, string>;
}

export function loadForkDeclarations(rootDir: string = ROOT): ForkDeclarations {
  const byPair = new Map<string, string>();
  const allowPath = join(rootDir, "docs", "templates", "variant-shadow-allowlist.json");
  if (!existsSync(allowPath)) return { byPair };
  try {
    const parsed = JSON.parse(readFileSync(allowPath, "utf-8")) as {
      entries?: Array<{ path?: string; variants?: string | string[]; class?: string; note?: string; reason?: string }>;
    };
    for (const e of parsed.entries ?? []) {
      if (e.class !== "fork" || typeof e.path !== "string") continue;
      const m = /^skills\/([^/]+)\/SKILL\.md$/.exec(e.path);
      if (!m) continue;
      const note = e.note ?? e.reason ?? "";
      const vars = e.variants === "*" ? "*" : Array.isArray(e.variants) ? e.variants : [];
      for (const v of vars === "*" ? ["*"] : vars) byPair.set(`${v}\0${m[1]}`, note);
    }
  } catch {
    // unparseable allowlist → no declarations; undeclared L2-AHEAD fails the
    // gate (fail-closed), matching validate-templates' allowlist posture.
  }
  return { byPair };
}

export function isDeclaredFork(forks: ForkDeclarations, variant: string, skillName: string): boolean {
  return forks.byPair.has(`${variant}\0${skillName}`);
}

// ── version readers ──────────────────────────────────────────────────────────
export function parseSkillVersion(text: string): string | null {
  const fm = splitFrontmatter(text);
  return fm ? readVersion(fm.inner) : null;
}

export function parseScriptVersion(text: string): string | null {
  const m = /^\s*\/\/\s*@version\s+(\S+)/m.exec(text);
  return m ? m[1] : null;
}

// ── drift rows ───────────────────────────────────────────────────────────────
interface Diff {
  type: "skill" | "script";
  name: string;
  variant: string;
  source: string;
  target: string;
  status: "missing" | "L2-STALE" | "L2-AHEAD" | "SAME-VER-DIFF" | "in-sync";
  commonVersion: string | null;
  variantVersion: string | null;
  declaredFork: boolean;
}

const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");

function isFileSync(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Pure classification (numeric semver): byte-equal → in-sync; missing target →
 *  missing; else strictly-newer side decides, equal/unparseable versions on
 *  differing bytes → SAME-VER-DIFF (human ruling required). */
export function classifyPair(
  sourceText: string,
  targetText: string | null,
  commonVersion: string | null,
  variantVersion: string | null,
): Diff["status"] {
  if (targetText === null) return "missing";
  if (sha256(sourceText) === sha256(targetText)) return "in-sync";
  const c = commonVersion ?? "0";
  const v = variantVersion ?? "0";
  const cmp = compareVersions(c, v);
  if (cmp > 0) return "L2-STALE";
  if (cmp < 0) return "L2-AHEAD";
  return "SAME-VER-DIFF";
}

const diffs: Diff[] = [];
const forks = loadForkDeclarations();

for (const variant of variants) {
  const pushRow = (
    type: Diff["type"],
    name: string,
    source: string,
    target: string,
    versionOf: (t: string) => string | null,
  ) => {
    const srcText = readFileSync(source, "utf-8");
    const tgtText = existsSync(target) ? readFileSync(target, "utf-8") : null;
    const status = classifyPair(srcText, tgtText, versionOf(srcText), tgtText === null ? null : versionOf(tgtText));
    // A fork declaration suppresses the gate's informational classes on that
    // pair (design §3.4 names L2-AHEAD; SAME-VER-DIFF is the post-heal steady
    // state of the retained fork copies — equal stamps, variant frontmatter
    // preserved — and §6 requires exit 0 with the declarations in place).
    // L2-STALE stays gate-failing even when declared: common-ahead is
    // heal-eligible and the fork owner must respond (port/adopt or re-declare).
    const forkCandidate = type === "skill" && (status === "L2-AHEAD" || status === "SAME-VER-DIFF");
    diffs.push({
      type,
      name,
      variant,
      source,
      target,
      status,
      commonVersion: versionOf(srcText),
      variantVersion: tgtText === null ? null : versionOf(tgtText),
      declaredFork: forkCandidate && isDeclaredFork(forks, variant, name),
    });
  };

  if (skillArg) {
    const skill = skillArg.split("=")[1];
    const srcMd = join(l1SkillsDir, skill, "SKILL.md");
    const tgtMd = join(templatesDir, variant, "skills", skill, "SKILL.md");
    if (existsSync(srcMd)) pushRow("skill", skill, srcMd, tgtMd, parseSkillVersion);
  }
  if (scriptArg) {
    const script = scriptArg.split("=")[1];
    const srcPath = join(l1ScriptsDir, script);
    const tgtPath = join(templatesDir, variant, "scripts", script);
    if (existsSync(srcPath)) pushRow("script", script, srcPath, tgtPath, parseScriptVersion);
  }
  if (!skillArg && !scriptArg) {
    // Unscoped enumeration (design §3.4): ALL common skills × all variants and
    // ALL common scripts × all variants. Only EXISTING pairs become rows — a
    // variant that does not mirror a common skill is not drift (scoped runs
    // still report `missing` for an explicitly requested target).
    if (existsSync(l1SkillsDir)) {
      for (const name of readdirSync(l1SkillsDir)) {
        const srcMd = join(l1SkillsDir, name, "SKILL.md");
        const tgtMd = join(templatesDir, variant, "skills", name, "SKILL.md");
        if (!existsSync(srcMd) || !existsSync(tgtMd)) continue;
        pushRow("skill", name, srcMd, tgtMd, parseSkillVersion);
      }
    }
    if (existsSync(l1ScriptsDir)) {
      for (const name of readdirSync(l1ScriptsDir)) {
        const srcPath = join(l1ScriptsDir, name);
        const tgtPath = join(templatesDir, variant, "scripts", name);
        if (!isFileSync(srcPath) || !isFileSync(tgtPath)) continue;
        pushRow("script", name, srcPath, tgtPath, parseScriptVersion);
      }
    }
  }
}

/** Pure exit predicate (design §3.4): L2-STALE, missing, and UNDECLARED
 *  L2-AHEAD fail the gate. Declared-fork rows (L2-AHEAD, and SAME-VER-DIFF as
 *  the retained forks' post-heal steady state) print but do not fail. */
export function rowFailsGate(row: Pick<Diff, "status" | "declaredFork">): boolean {
  if (row.status === "L2-STALE" || row.status === "missing") return true;
  if (row.status === "L2-AHEAD" || row.status === "SAME-VER-DIFF") return !row.declaredFork;
  return false;
}

if (isCheckDrift || isDryRun || !isApply) {
  console.log(`\n=== L1 -> L2 Drift Report ===`);
  for (const d of diffs) {
    const ver =
      d.status === "in-sync" || d.status === "missing"
        ? ""
        : ` (common=${d.commonVersion ?? "?"} variant=${d.variantVersion ?? "?"})`;
    const forkTag = d.declaredFork ? " [declared fork]" : "";
    console.log(`[${d.variant}] ${d.type} ${d.name}: ${d.status}${ver}${forkTag}`);
  }

  if (isCheckDrift) {
    const failing = diffs.filter(rowFailsGate);
    const declared = diffs.filter((d) => d.declaredFork);
    if (declared.length > 0) {
      console.log(
        `\n${declared.length} declared fork row(s) print but do not fail (design 2026-11-28-origin-l2-drift §3.4).`,
      );
    }
    if (failing.length > 0) {
      const byClass = new Map<string, number>();
      for (const f of failing) byClass.set(f.status, (byClass.get(f.status) ?? 0) + 1);
      console.log(
        `\nFound ${failing.length} drifted row(s) requiring action: ${[...byClass].map(([k, n]) => `${k}=${n}`).join(", ")}.`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\nNo undeclared drift (0 of ${diffs.length} enumerated row(s) fail the gate).`);
    }
  }
}

if (isApply) {
  console.log(`\n=== Applying Sync to L2 (frontmatter-preserving heal, design 2026-11-28-origin-l2-drift §3.1) ===`);
  let healed = 0;
  let refused = 0;
  for (const d of diffs) {
    if (d.status === "in-sync") continue;
    if (d.status === "L2-AHEAD" || d.declaredFork) {
      console.error(
        `❌ REFUSED ${d.type} ${d.name} for ${d.variant}: ${
          d.declaredFork ? "declared fork" : "undeclared L2-AHEAD"
        } — variant copies ahead of (or forked from) common are variant-authoritative; declare the fork in docs/templates/variant-shadow-allowlist.json (class "fork") or resolve by hand. Nothing was written.`,
      );
      refused++;
      continue;
    }
    if (d.status === "SAME-VER-DIFF") {
      console.error(
        `❌ REFUSED ${d.type} ${d.name} for ${d.variant}: same version, differing bytes — needs a human ruling (equal-version content change), not an automatic sync. Nothing was written.`,
      );
      refused++;
      continue;
    }
    if (d.type === "skill" && d.status === "L2-STALE") {
      const result = healSkillFile(readFileSync(d.target, "utf-8"), readFileSync(d.source, "utf-8"));
      if (!result.changed) {
        console.log(`ℹ️  ${d.type} ${d.name} for ${d.variant}: heal produced identical bytes — skipped`);
        continue;
      }
      if (!isDryRun) {
        mkdirSync(dirname(d.target), { recursive: true });
        writeFileSync(d.target, result.content, "utf-8");
      }
      console.log(
        `✅ Healed ${d.type} ${d.name} for ${d.variant}: body from common, frontmatter preserved (advanced: ${result.changedKeys.join(", ") || "none"}; filled: ${result.filledKeys.join(", ") || "none"}; audit_exception lines preserved: ${result.auditExceptionPreserved}; WS-05a legalization: ${result.ws05aDroppedLines} row(s) dropped, ${result.ws05aRewrittenLines} line(s) rewritten)`,
      );
      healed++;
      continue;
    }
    // scripts and scoped `missing` targets: byte-copy (no variant frontmatter
    // exists to preserve / no existing copy carries identity)
    if (!isDryRun) {
      mkdirSync(dirname(d.target), { recursive: true });
      writeFileSync(d.target, readFileSync(d.source, "utf-8"), "utf-8");
    }
    console.log(`✅ Synced ${d.type} ${d.name} to ${d.variant} (byte-copy)`);
    healed++;
  }
  console.log(`Healed/synced ${healed} file(s), refused ${refused}.`);
  if (refused > 0) process.exitCode = 1;
}
