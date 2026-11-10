#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-11-10, spec docs/designs/2026-11-10-delivery-gating-hardening-design.md
//          §4 Scope B + C-B — PR-1 of the DEC-20261110-04 rollout, T-20261110-010/-012):
//          per-variant script sets + version-aware row classes + LOCAL-PATCH and
//          orphan-test labels in BOTH sections.
//          • Per-variant section: for each fleet project the variant is parsed
//            from its template-version.txt (`variant=` line, the
//            upgrade-project.ts:1767 parse, with the legacy .claude marker
//            fallback) and templates/<v>/scripts/<v>/** is compared against
//            Projects/<p>/scripts/<v>/** (.ts/.mjs/.json only — the design's
//            variant universe).
//          • Rows are HASH-PRIMARY, @version is a classifier only: the
//            2026-11-10 co-deck run recorded 171 equal-version DRIFT_RESTORED
//            rows (Projects/co-deck/.claude/last-upgrade-delivery.json), so
//            equal @version never implies equal content. Classes:
//            match / mismatch-equal-version (equal @version, bytes differ — the
//            fork class, WARN) / version-ahead (project newer — pending port,
//            INFO, not drift) / version-behind (template newer — pending
//            delivery, INFO) / missing / mismatch (hash-diff fallback when
//            either side lacks a parseable @version).
//          • C-B labels (both sections): a project file carrying canonical
//            LOCAL-PATCH(upstream-request: …) markers (reused verbatim from
//            helpers/local-patch-scan.ts — single marker definition) is labeled
//            `local-patch (id)` — intentional divergence, not drift; a
//            project-only X.test.ts beside a tracked X.ts is surfaced as an
//            `orphan-test` (WARN) row with the adopt-or-delete disposition
//            hint — surfacing only, adoption stays the project's call (first
//            live hit: Projects/co-deck/scripts/helpers/
//            security-validator.test.ts, the T-20261110-012 orphan).
//          • Parity verdict counts only UNEXPLAINED divergence (mismatch /
//            mismatch-equal-version / missing without a local-patch label);
//            version-ahead/behind and orphan-test rows are informational.
//          • Gate location unchanged (design §4 Scope B): WARN-level fleet
//            scan, exits 0 — deliberately NOT a blocking upgrade pre-flight
//            (project-ahead divergence is legitimate pending port and the
//            in-run DRIFT_RESTORED heal already exists; this detector covers
//            the between-runs window the heal cannot).
// v1.1.0 (2026-11-07, spec docs/designs/2026-11-07-fleet-membership-ssot-design.md
//          §5, DEC-20261107-01): fleet membership SSOT — the project set is
//          derived through lib/fleet.ts listFleetProjects() (Projects/co-*
//          minus the docs/fleet-membership.json exclusions; co-abap-plugin
//          out — not compared against templates/common/scripts, A5).
//          Excluded repos cannot produce parity rows.
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §8 Phase 4 verification sweep): fleet-script-parity — hashes the
//          common script set (every file under templates/common/scripts/,
//          relative paths) against each Projects/co-*/scripts/ tree and
//          reports per-script match/mismatch counts plus a per-repo summary.
//          WARN-level by design: mismatches never FAIL — upgrade-project is
//          the delivery vehicle and repos await their next cycle. Extra files
//          in a project tree (variant hooks, project-only tests) are counted
//          as informational, not drift.
//
// Usage: bun scripts/fleet-script-parity.ts [--json]
//
// Output: console tables + WARN summary line; always exits 0. `--json` prints
// the structured form (summaries for both sections + non-match rows + the
// flattened detail lines).

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { listFleetProjects } from "./lib/fleet.ts";
import { scanLocalPatches } from "./helpers/local-patch-scan.ts";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Row class of one compared pair (or one surfaced project-only file).
 * Hash-primary (spec 2026-11-10-delivery-gating-hardening-design §2/§4-B):
 * hash equality decides `match`; @version classifies the divergence only when
 * BOTH sides carry a parseable @version.
 */
export type ScriptStatus =
  | "match"
  | "mismatch"
  | "mismatch-equal-version"
  | "version-ahead"
  | "version-behind"
  | "missing"
  | "orphan-test";

export interface ScriptRow {
  script: string;
  status: ScriptStatus;
  project: string;
  /**
   * C-B annotation label, present only on non-match rows that carry one:
   * `local-patch (ticket id)` when the project copy carries canonical
   * LOCAL-PATCH(upstream-request:) markers (intentional divergence — not
   * drift), or the orphan-test disposition hint (`adopt (register L3) or
   * delete`) on orphan rows.
   */
  label?: string;
}

export interface RepoSummary {
  project: string;
  /** Variant of the per-variant section, null for the common section. */
  variant: string | null;
  match: number;
  /** Hash-diff rows without a usable @version classifier (WARN drift). */
  mismatch: number;
  /** mismatch-equal-version — the fork class (WARN drift). */
  fork: number;
  /** Project @version newer — pending port (INFO, not drift). */
  ahead: number;
  /** Template @version newer — pending delivery (INFO). */
  behind: number;
  missing: number;
  /** Project-only X.test.ts beside a tracked X.ts (C-B, WARN surface). */
  orphanTest: number;
  /** Rows carrying a `local-patch (…)` label (intentional divergence). */
  localPatch: number;
  extra: number;
  /**
   * True when zero UNEXPLAINED divergence: local-patch rows are intentional,
   * version-ahead/behind are pending-port/delivery INFO, orphan-test is
   * surface-only — none of those flips parity.
   */
  parity: boolean;
}

/** Optional classification inputs; all default to empty (v1.0/v1.1 behavior). */
export interface CompareOptions {
  /** Template-side @version per relative path ("" when absent). */
  templateVersions?: Record<string, string>;
  /** Project-side @version per relative path ("" when absent). */
  projectVersions?: Record<string, string>;
  /** Project-relative path → distinct LOCAL-PATCH marker ticket ids. */
  localPatchIds?: Record<string, string[]>;
}

// ── fs helpers ───────────────────────────────────────────────────────────────

/**
 * Recursively list relative file paths under `dir` (POSIX-style separators).
 * v1.2.0 fix (found while implementing Scope B/C-B): the v1.0 recursion pushed
 * each SUBTREE's own listRelativeFiles result verbatim, dropping the directory
 * prefix — subdir files then ENOENT'd at the join(dir, name) hash step and
 * were silently dropped from BOTH canonical and observed maps (the v1 sweep
 * actually compared only the root-level files of each tree, ~77 of the 188
 * common files). True tree-relative paths restore the documented universe
 * ("every file under templates/common/scripts/") and make subdir rows
 * (helpers/, lib/, hooks/, tests/, …) visible.
 */
export function listRelativeFiles(dir: string): string[] {
  const out: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  const walk = (cur: string): void => {
    for (const entry of readdirSync(cur)) {
      const full = join(cur, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * sha256 (raw bytes) + @version (utf-8 text) of one file in a single read;
 * null when the file vanished mid-scan (transient entry — skipped, not drift).
 */
export interface FileMeta {
  hash: string;
  version: string;
}

export function loadFileMeta(path: string): FileMeta | null {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    return null;
  }
  return {
    hash: createHash("sha256").update(bytes).digest("hex"),
    version: extractVersion(bytes.toString("utf-8"), path),
  };
}

// ── @version classifier ──────────────────────────────────────────────────────

/** Same header convention upgrade-project.ts gates on (`@version X.Y.Z`). */
const TEMPLATE_VERSION_RE = /@version[ \t]+(\d+\.\d+\.\d+)/;
/** .json files carry no comment header — fall back to a top-level version key. */
const JSON_VERSION_RE = /"version"[ \t]*:[ \t]*"(\d+\.\d+\.\d+)"/;

/** First parseable version in the file, or "" (classifier unavailable). */
export function extractVersion(content: string, file: string): string {
  if (file.endsWith(".json")) {
    const j = content.match(JSON_VERSION_RE)?.[1];
    if (j) return j;
  }
  return content.match(TEMPLATE_VERSION_RE)?.[1] ?? "";
}

/** -1 when a < b, 0 when equal, 1 when a > b (numeric, dot components). */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// ── orphan-test detection (C-B) ──────────────────────────────────────────────

const ORPHAN_SUFFIX = ".test.ts";
const ORPHAN_SUBJECT_EXTS = [".ts", ".mjs", ".json"];

/** Candidate tracked-subject paths for a project-only `X.test.ts`: the same
 * directory's X.ts (the design's "beside"), with .mjs/.json subject fallbacks
 * for delivered non-comment files. */
export function orphanSubjectCandidates(testPath: string): string[] {
  const base = testPath.slice(0, -ORPHAN_SUFFIX.length);
  const slash = base.lastIndexOf("/");
  const dir = slash >= 0 ? base.slice(0, slash) : "";
  const name = slash >= 0 ? base.slice(slash + 1) : base;
  const stem = dir ? `${dir}/${name}` : name;
  return ORPHAN_SUBJECT_EXTS.map((ext) => stem + ext);
}

/**
 * Project-only `*.test.ts` files whose subject `X.ts` exists in the TRACKED
 * (template) set — the C-B orphan-test population. Tests whose subject is
 * itself project-only are legitimate project-local tests, not orphans; a
 * tracked X.test.ts is a compared pair, not an orphan.
 */
export function findOrphanTests(
  canonical: Record<string, string>,
  observed: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const f of Object.keys(observed).sort()) {
    if (f in canonical) continue;
    if (!f.endsWith(ORPHAN_SUFFIX)) continue;
    if (orphanSubjectCandidates(f).some((s) => s in canonical)) out.push(f);
  }
  return out;
}

// ── pure core ────────────────────────────────────────────────────────────────

/**
 * Pure core: compare the canonical script set against one project tree.
 * Canonical and observed are maps of relative path → sha256; the optional
 * context adds the @version classifier and LOCAL-PATCH labels (v1.2.0).
 * Omitted context reproduces the v1 match/mismatch/missing behavior.
 */
export function compareScriptSet(
  canonical: Record<string, string>,
  observed: Record<string, string>,
  project: string,
  options: CompareOptions = {},
): ScriptRow[] {
  const tplV = options.templateVersions ?? {};
  const projV = options.projectVersions ?? {};
  const patches = options.localPatchIds ?? {};
  return Object.keys(canonical)
    .sort()
    .map((script) => {
      if (!(script in observed)) return { script, project, status: "missing" as const };
      if (observed[script] === canonical[script]) return { script, project, status: "match" as const };
      // Hashes differ — @version classifies the divergence when both sides
      // carry one; otherwise the unexplained fallback stays `mismatch`.
      const tv = tplV[script] ?? "";
      const pv = projV[script] ?? "";
      let status: ScriptStatus = "mismatch";
      if (tv !== "" && pv !== "") {
        const cmp = compareSemver(pv, tv);
        status = cmp > 0 ? "version-ahead" : cmp < 0 ? "version-behind" : "mismatch-equal-version";
      }
      const ids = patches[script] ?? [];
      const row: ScriptRow = { script, project, status };
      if (ids.length > 0) row.label = `local-patch (${ids.join(", ")})`;
      return row;
    });
}

export function summarize(
  project: string,
  rows: ScriptRow[],
  extraCount: number,
  variant: string | null = null,
): RepoSummary {
  const count = (s: ScriptStatus) => rows.filter((r) => r.status === s).length;
  const localPatch = rows.filter((r) => r.label?.startsWith("local-patch")).length;
  const unexplained = rows.some(
    (r) =>
      (r.status === "mismatch" || r.status === "mismatch-equal-version" || r.status === "missing") &&
      !r.label?.startsWith("local-patch"),
  );
  return {
    project,
    variant,
    match: count("match"),
    mismatch: count("mismatch"),
    fork: count("mismatch-equal-version"),
    ahead: count("version-ahead"),
    behind: count("version-behind"),
    missing: count("missing"),
    orphanTest: count("orphan-test"),
    localPatch,
    extra: extraCount,
    parity: !unexplained,
  };
}

// ── fleet scan ───────────────────────────────────────────────────────────────

/** Variant-universe extensions (design §4 Scope B): .ts / .mjs / .json. */
const VARIANT_SCRIPT_EXTS = new Set([".ts", ".mjs", ".json"]);

function hasVariantExt(file: string): boolean {
  const dot = file.lastIndexOf(".");
  return dot >= 0 && VARIANT_SCRIPT_EXTS.has(file.slice(dot).toLowerCase());
}

interface ObservedTree {
  files: string[];
  hashes: Record<string, string>;
  versions: Record<string, string>;
}

function observeTree(dir: string, filterVariantExts: boolean): ObservedTree {
  const files = listRelativeFiles(dir).filter((f) => !filterVariantExts || hasVariantExt(f));
  const hashes: Record<string, string> = {};
  const versions: Record<string, string> = {};
  for (const f of files) {
    const meta = loadFileMeta(join(dir, f));
    if (meta === null) continue; // transient entry — skipped, not drift
    hashes[f] = meta.hash;
    versions[f] = meta.version;
  }
  return { files, hashes, versions };
}

/**
 * Variant of a fleet project: the `variant=` line of its template-version.txt
 * (the upgrade-project.ts:1767 parse, legacy .claude marker fallback).
 * null when no marker declares one.
 */
export function resolveProjectVariant(projectDir: string): string | null {
  const markers = [
    join(projectDir, "template-version.txt"),
    join(projectDir, ".claude", "template-version.txt"),
  ];
  for (const marker of markers) {
    try {
      const raw = readFileSync(marker, "utf-8").match(/^variant=(.*)$/m)?.[1];
      const v = raw?.trim();
      if (v) return v;
    } catch {
      // absent — try the next marker
    }
  }
  return null;
}

/**
 * LOCAL-PATCH marker ids per scripts-relative path, from the canonical
 * scanner (helpers/local-patch-scan.ts — one marker definition fleet-wide).
 * `pathPrefix` narrows to the compared tree ("scripts/" for the common
 * section, "scripts/<variant>/" for the variant section).
 */
function localPatchIdMap(projectDir: string, pathPrefix: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const finding of scanLocalPatches(projectDir)) {
    if (!finding.file.startsWith(pathPrefix)) continue;
    const rel = finding.file.slice(pathPrefix.length);
    const ids = map[rel] ?? (map[rel] = []);
    if (!ids.includes(finding.id)) ids.push(finding.id);
  }
  return map;
}

/** Compared rows (sorted) + orphan-test surface rows for one tree pair. */
function treeRows(
  project: string,
  canonical: Record<string, string>,
  canonicalVersions: Record<string, string>,
  observed: ObservedTree,
  patchIds: Record<string, string[]>,
): ScriptRow[] {
  const rows = compareScriptSet(canonical, observed.hashes, project, {
    templateVersions: canonicalVersions,
    projectVersions: observed.versions,
    localPatchIds: patchIds,
  });
  for (const orphan of findOrphanTests(canonical, observed.hashes)) {
    rows.push({ script: orphan, project, status: "orphan-test", label: "adopt (register L3) or delete" });
  }
  return rows.sort((a, b) => (a.script < b.script ? -1 : a.script > b.script ? 1 : 0));
}

function detailLine(row: ScriptRow, variant: string | null): string {
  const scope = variant === null ? row.project : `${row.project} (variant ${variant})`;
  const label = row.label === undefined ? "" : ` ${row.label}`;
  return `${scope}: ${row.script} [${row.status}]${label}`;
}

function main(): void {
  const workspaceRoot = join(import.meta.dir, "..");
  const commonDir = join(workspaceRoot, "templates", "common", "scripts");
  const projectsDir = join(workspaceRoot, "Projects");

  // Fleet membership SSOT (design docs/designs/2026-11-07-fleet-membership-ssot-design.md
  // §5, DEC-20261107-01): Projects/co-* minus the docs/fleet-membership.json
  // exclusions, derived exclusively through lib/fleet.ts (the sole membership
  // path — no co- prefix filter here). Excluded members are not compared
  // against templates/common/scripts (§6.1) — and, lacking a variant marker
  // obligation, get no per-variant section either.
  const fleetPaths = listFleetProjects(workspaceRoot).sort();
  const projects = fleetPaths.map((p) => p.split(/[\\/]/).pop() ?? p);

  // Canonical (template-side) sets.
  const commonCanonicalFiles = listRelativeFiles(commonDir);
  const commonCanonical: Record<string, string> = {};
  const commonVersions: Record<string, string> = {};
  for (const f of commonCanonicalFiles) {
    const meta = loadFileMeta(join(commonDir, f));
    if (meta !== null) {
      commonCanonical[f] = meta.hash;
      commonVersions[f] = meta.version;
    }
  }

  const variantSets: Record<string, number> = {};
  interface RepoReport {
    project: string;
    variant: string | null;
    common: RepoSummary;
    variantSet: RepoSummary | null;
    rows: { common: ScriptRow[]; variant: ScriptRow[] };
  }
  const repoReports: RepoReport[] = [];
  const details: string[] = [];

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const projectDir = join(workspaceRoot, fleetPaths[i]);

    // ── common section (universe unchanged: every file under scripts/) ──
    const commonObserved = observeTree(join(projectsDir, project, "scripts"), false);
    const commonPatches = localPatchIdMap(projectDir, "scripts/");
    const commonRows = treeRows(project, commonCanonical, commonVersions, commonObserved, commonPatches);
    const commonOrphans = commonRows.filter((r) => r.status === "orphan-test").length;
    // extras = project-only files minus the orphan rows now surfaced as rows.
    const commonExtras = commonObserved.files.filter((f) => !(f in commonCanonical)).length - commonOrphans;
    const commonSummary = summarize(project, commonRows, commonExtras, null);
    for (const r of commonRows) if (r.status !== "match") details.push(detailLine(r, null));

    // ── per-variant section (design §4 Scope B) ──
    const variant = resolveProjectVariant(projectDir);
    let variantSummary: RepoSummary | null = null;
    let variantRows: ScriptRow[] = [];
    if (variant !== null) {
      const variantTemplateDir = join(workspaceRoot, "templates", variant, "scripts", variant);
      const variantProjectDir = join(projectsDir, project, "scripts", variant);
      const canonicalObserved = observeTree(variantTemplateDir, true);
      if (canonicalObserved.files.length > 0) {
        variantSets[variant] = canonicalObserved.files.length;
        const projectObserved = observeTree(variantProjectDir, true);
        const patches = localPatchIdMap(projectDir, `scripts/${variant}/`);
        variantRows = treeRows(project, canonicalObserved.hashes, canonicalObserved.versions, projectObserved, patches);
        const orphans = variantRows.filter((r) => r.status === "orphan-test").length;
        const variantExtras = projectObserved.files.filter((f) => !(f in canonicalObserved.hashes)).length - orphans;
        variantSummary = summarize(project, variantRows, variantExtras, variant);
        for (const r of variantRows) if (r.status !== "match") details.push(detailLine(r, variant));
      }
    }

    repoReports.push({
      project,
      variant,
      common: commonSummary,
      variantSet: variantSummary,
      rows: { common: commonRows.filter((r) => r.status !== "match"), variant: variantRows.filter((r) => r.status !== "match") },
    });
  }

  const json = process.argv.includes("--json");
  if (json) {
    console.log(
      JSON.stringify(
        {
          canonicalCount: commonCanonicalFiles.length,
          variantSets,
          repos: repoReports,
          mismatchDetails: details,
        },
        null,
        2,
      ),
    );
  } else {
    const variantLine =
      Object.keys(variantSets).length === 0
        ? ""
        : `variant sets compared: ${Object.keys(variantSets)
            .sort()
            .map((v) => `${v}(${variantSets[v]})`)
            .join(" ")}`;
    console.log(
      `${CYAN}fleet-script-parity — canonical set: templates/common/scripts (${commonCanonicalFiles.length} files)${RESET}`,
    );
    console.log(`${CYAN}projects scanned: ${projects.length}${RESET}`);
    if (variantLine) console.log(`${CYAN}${variantLine}${RESET}`);
    console.log("");

    console.log(`${CYAN}Per-repo summary — common set${RESET}`);
    for (const r of repoReports) printSummary(r.common);
    console.log("");

    const withVariants = repoReports.filter((r) => r.variantSet !== null);
    if (withVariants.length > 0) {
      console.log(`${CYAN}Per-repo summary — variant sets${RESET}`);
      for (const r of withVariants) printSummary(r.variantSet as RepoSummary);
      console.log("");
    }

    if (details.length === 0) {
      console.log(
        `${GREEN}[OK] all ${projects.length} project trees match the canonical + variant script sets (no unexplained divergence).${RESET}`,
      );
    } else {
      console.log(
        `${YELLOW}[WARN] ${details.length} row-level finding(s) across the fleet (no FAIL — WARN-soak by design; labels mark intentional/pending divergence):${RESET}`,
      );
      for (const d of details) console.log(`  ${YELLOW}-${RESET} ${d}`);
    }
  }
  process.exit(0);
}

function printSummary(s: RepoSummary): void {
  const verdict = s.parity ? `${GREEN}FULL${RESET}` : `${YELLOW}DRIFT${RESET}`;
  console.log(
    `  ${s.project.padEnd(34)} match=${String(s.match).padEnd(4)} fork=${String(s.fork).padEnd(3)} ahead=${String(s.ahead).padEnd(3)} behind=${String(s.behind).padEnd(3)} mismatch=${String(s.mismatch).padEnd(3)} missing=${String(s.missing).padEnd(3)} orphan-test=${String(s.orphanTest).padEnd(3)} local-patch=${String(s.localPatch).padEnd(3)} extra=${String(s.extra).padEnd(3)} parity=${verdict}`,
  );
}

if (import.meta.main) main();
