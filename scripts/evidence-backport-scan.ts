#!/usr/bin/env bun
/**
 * evidence-backport-scan.ts — Evidence Backporting candidate scanner
 * (project-resync skill Step 2b).
 * @version 1.1.0
 *
 * v1.1.0 (2026-09-25, spec docs/designs/2026-09-25-verifier-platform-expansion-design.md
 *  site 14 / D14): the F1/M6 skill-dir literals adopt PLATFORM_SKILL_BASES;
 *  iteration order is provably verdict-irrelevant (accumulate-only loops).
 *
 * Read-only inspection of Projects/co-* instances to identify evidence
 * planes mature enough to backport into templates/co-<x>/evidence-models/.
 * Mirrors resync-audit.ts in shape: read-only, per-project verdict tables,
 * --json output, no mutation. This script NEVER writes into templates/ or
 * into any Projects/co-* instance — it only reports candidates. The actual
 * backport (authoring the schema + collection-procedure pair) is a
 * human-reviewed follow-on action per design §4.6.
 *
 * Implements design §4 (Evidence Backporting):
 *   - §4.2 form detection: F1 (prose ledger) / F2 (registry-backed) /
 *     F3 (schema-typed) / F0 (unrecognized) / MIXED / none
 *   - §4.3 maturity bar: M1-M6
 *   - §4.4 M6: a real, repeatedly-used collection procedure (not just a
 *     schema that happens to fit in retrospect)
 *   - §4.5 M2/M4/M6b measured via the project's own Graph Delta Log
 *     (docs/graph-deltas/**), with a git-log fallback marked
 *     UNVERIFIED-BY-DELTA when no delta history exists yet
 *
 * Usage:
 *   bun scripts/evidence-backport-scan.ts                       # whole fleet
 *   bun scripts/evidence-backport-scan.ts --project Projects/co-newbiz --json
 *
 * Options:
 *   --project <path>   project root to scan (repeatable; default: all
 *                      Projects/co-* directories)
 *   --json             print the report as JSON instead of a markdown table
 *
 * Exit codes: 0 (report produced), 1 (usage/setup error).
 *
 * Design of record: docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md §4
 * ADR of record: docs/adr/0084-actor-model-evidence-backporting-graph-delta-log.md Decision 6
 *
 * @module evidence-backport-scan
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PLATFORM_SKILL_BASES } from "./lib/platforms.ts";

const VERSION = "1.1.0";

type Form = "F1" | "F2" | "F3" | "F0" | "MIXED" | "none";

interface MaturityResult {
  id: string;
  pass: boolean;
  detail: string;
  unverifiedByDelta?: boolean;
}

interface PlaneResult {
  plane: string;
  forms: Form[];
  form: Form;
  maturity: MaturityResult[];
  verdict: "PROMOTABLE" | "SCHEMA-ONLY" | "NOT_YET" | "NEEDS_TRIAGE";
  notes: string[];
}

interface ProjectReport {
  project: string;
  planes: PlaneResult[];
}

// ---------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------

function parseArgs(): { projects: string[]; json: boolean; help: boolean } {
  const args = process.argv.slice(2);
  const projects: string[] = [];
  let json = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") help = true;
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--project") projects.push(args[++i]);
    else projects.push(args[i]);
  }
  return { projects, json, help };
}

function defaultProjects(): string[] {
  const out: string[] = [];
  const dir = resolve("Projects");
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith("co-")) out.push(join("Projects", e.name));
  }
  return out.sort();
}

function git(projectPath: string, args: string[]): string {
  const r = spawnSync("git", ["-C", projectPath, ...args], { encoding: "utf-8" });
  return (r.stdout ?? "").toString().trim();
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// §4.2 Form detection
// ---------------------------------------------------------------------------

interface FormSignal {
  form: Form;
  plane: string;
  detail: string;
  /** Governing files for this plane (ledger docs / kill-criteria predicates / valid schema files), used as M1-M6 targets. */
  files?: string[];
}

/** F1: a SKILL.md naming the common `evidence-ledger` base or the 5-column header, plus a materialized ledger table under docs/**. */
function detectF1(projectPath: string): FormSignal[] {
  const signals: FormSignal[] = [];
  // SSOT constant (spec 2026-09-25-verifier-platform-expansion-design site 14);
  // order provably verdict-irrelevant — accumulate-only loops, no first-wins
  // dedup or short-circuit (design D14).
  const skillDirs = PLATFORM_SKILL_BASES;
  const ledgerSkillFiles: string[] = [];
  for (const d of skillDirs) {
    const base = join(projectPath, d);
    if (!existsSync(base)) continue;
    for (const f of walk(base)) {
      if (!f.endsWith("SKILL.md")) continue;
      const content = readFileSync(f, "utf-8");
      if (
        /evidence-ledger/i.test(content) ||
        /\|\s*claim\s*\|\s*source\s*\|.*\|\s*verification\s*\|\s*status\s*\|/i.test(content)
      ) {
        ledgerSkillFiles.push(f);
      }
    }
  }
  if (ledgerSkillFiles.length === 0) return signals;

  const docsDir = join(projectPath, "docs");
  const materializedLedgers: string[] = [];
  for (const f of walk(docsDir)) {
    if (!/evidence|ledger/i.test(f)) continue;
    if (!f.endsWith(".md")) continue;
    const content = readFileSync(f, "utf-8");
    if (/\|\s*claim\s*\|/i.test(content) && /\|\s*status\s*\|/i.test(content)) {
      materializedLedgers.push(f);
    }
  }
  if (materializedLedgers.length > 0) {
    signals.push({
      form: "F1",
      plane: "prose-ledger",
      detail: `${ledgerSkillFiles.length} ledger-naming SKILL.md + ${materializedLedgers.length} materialized ledger table(s): ${materializedLedgers.map((p) => relative(projectPath, p)).join(", ")}`,
      files: materializedLedgers,
    });
  }
  return signals;
}

/** F2: docs/evidence/README.md declaring a registry-backed/formal-var overlay, OR a db/migrations/** evidence-variable table + procedures/_kill-criteria/*.json. */
function detectF2(projectPath: string): FormSignal[] {
  const signals: FormSignal[] = [];
  const readmePath = join(projectPath, "docs", "evidence", "README.md");
  let readmeDeclares = false;
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, "utf-8");
    if (/registry-backed|formal-var/i.test(content)) readmeDeclares = true;
  }

  const migrationsDir = join(projectPath, "db", "migrations");
  const evidenceVarMigrations: string[] = [];
  if (existsSync(migrationsDir)) {
    for (const f of readdirSync(migrationsDir)) {
      const full = join(migrationsDir, f);
      if (statSync(full).isFile() && /evidence.?var/i.test(readFileSync(full, "utf-8"))) {
        evidenceVarMigrations.push(f);
      }
    }
  }

  const killCriteriaDir = join(projectPath, "procedures", "_kill-criteria");
  const killCriteriaFiles = existsSync(killCriteriaDir)
    ? readdirSync(killCriteriaDir).filter((f) => f.endsWith(".json"))
    : [];

  if (readmeDeclares || (evidenceVarMigrations.length > 0 && killCriteriaFiles.length > 0)) {
    signals.push({
      form: "F2",
      plane: "registry-backed",
      detail:
        (readmeDeclares ? `${relative(projectPath, readmePath)} declares registry-backed/formal-var overlay` : "") +
        (readmeDeclares && evidenceVarMigrations.length > 0 ? "; " : "") +
        (evidenceVarMigrations.length > 0
          ? `${evidenceVarMigrations.length} evidence-var migration(s) + ${killCriteriaFiles.length} _kill-criteria predicate(s)`
          : ""),
      files: killCriteriaFiles.length > 0 ? killCriteriaFiles.map((f) => join(killCriteriaDir, f)) : evidenceVarMigrations.map((f) => join(migrationsDir, f)),
    });
  }
  return signals;
}

/** F3: one or more evidence-models/**\/*.schema.json validating against the meta-schema (structural check: required top-level fields). */
function detectF3(projectPath: string, metaSchema: any | null): FormSignal[] {
  const signals: FormSignal[] = [];
  const modelsDir = join(projectPath, "evidence-models");
  if (!existsSync(modelsDir)) return signals;
  let schemaFiles = walk(modelsDir).filter((f) => f.endsWith(".schema.json"));
  let usedFallback = false;
  // Design §4.2's literal glob (evidence-models/**/*.schema.json) matches the
  // _shared/base/ meta-models (finding.schema.json, corrective-action.schema.json,
  // common.schema.json) but NOT the bulk of co-safety's per-domain record files,
  // which are content-valid draft-07 schemas saved with a plain .json extension
  // (verified: equipment-integrity-record.json etc. carry full $schema/$id/required/
  // properties bodies). Fall back to content validation over evidence-models/**/*.json
  // when the literal suffix glob finds nothing, so real F3 planes aren't missed as F0.
  let valid: string[] = [];
  for (const f of schemaFiles) {
    const schema = readJson(f);
    if (!schema) continue;
    if (validatesAgainstMeta(schema, metaSchema)) valid.push(f);
  }
  // Retry against the broader plain-.json set when the literal *.schema.json glob
  // found nothing valid — either no files matched it, or the matched files (e.g. a
  // base meta-model missing $id) didn't validate. Real record-level schemas may live
  // at *.json without the .schema. suffix (verified in co-safety).
  if (valid.length === 0) {
    const fallbackFiles = walk(modelsDir).filter((f) => f.endsWith(".json") && !f.endsWith("README.md") && !schemaFiles.includes(f));
    const fallbackValid: string[] = [];
    for (const f of fallbackFiles) {
      const schema = readJson(f);
      if (!schema) continue;
      if (validatesAgainstMeta(schema, metaSchema)) fallbackValid.push(f);
    }
    if (fallbackValid.length > 0) {
      usedFallback = true;
      schemaFiles = [...schemaFiles, ...fallbackFiles];
      valid = fallbackValid;
    }
  }
  if (valid.length > 0) {
    signals.push({
      form: "F3",
      plane: "schema-typed",
      detail: `${valid.length} evidence-models/** file(s) validate against templates/common/schemas/evidence-model.schema.json (of ${schemaFiles.length} candidate(s)${usedFallback ? "; literal *.schema.json glob found none, fell back to content-validating evidence-models/**/*.json" : ""})`,
      files: valid,
    });
  }
  return signals;
}

/** Structural (not a full JSON-Schema validator) check against the meta-schema's required fields. */
function validatesAgainstMeta(schema: any, metaSchema: any | null): boolean {
  const required = metaSchema?.required ?? ["$schema", "$id", "title", "version", "type", "required", "properties"];
  for (const key of required) {
    if (!(key in schema)) return false;
  }
  if (schema.$schema !== "http://json-schema.org/draft-07/schema#") return false;
  if (schema.type !== "object") return false;
  if (!Array.isArray(schema.required)) return false;
  if (typeof schema.properties !== "object") return false;
  return true;
}

/** F0: evidence-shaped content present but no fingerprint matched. */
function detectF0(projectPath: string, alreadyFound: FormSignal[]): FormSignal[] {
  if (alreadyFound.length > 0) return [];
  const candidateDirs = ["docs", "evidence-models", "procedures"];
  let evidenceShaped = false;
  for (const d of candidateDirs) {
    const base = join(projectPath, d);
    if (!existsSync(base)) continue;
    for (const f of walk(base)) {
      if (/evidence|ledger|finding/i.test(f)) {
        evidenceShaped = true;
        break;
      }
    }
    if (evidenceShaped) break;
  }
  if (!evidenceShaped) return [];
  return [{ form: "F0", plane: "unrecognized", detail: "evidence-shaped paths present, no form fingerprint matched" }];
}

function detectForms(projectPath: string, metaSchema: any | null): FormSignal[] {
  const f1 = detectF1(projectPath);
  const f2 = detectF2(projectPath);
  const f3 = detectF3(projectPath, metaSchema);
  const found = [...f1, ...f2, ...f3];
  if (found.length === 0) {
    const f0 = detectF0(projectPath, found);
    return f0;
  }
  return found;
}

// ---------------------------------------------------------------------------
// §4.5 Graph Delta Log query (with git log fallback)
// ---------------------------------------------------------------------------

interface DeltaRecord {
  schema_version: string;
  generated_at: string;
  commit: string;
  scope: string;
  totals: { nodes_added: number; nodes_removed: number; edges_added: number; edges_removed: number };
  by_node_type: Record<string, { added: number; removed: number }>;
  by_edge_type: Record<string, { added: number; removed: number }>;
  ids: {
    nodes_added?: string[];
    nodes_removed?: string[];
    edges_added?: string[];
    edges_removed?: string[];
    truncated: boolean;
  };
}

function loadDeltaLog(projectPath: string): DeltaRecord[] {
  const dir = join(projectPath, "docs", "graph-deltas");
  if (!existsSync(dir)) return [];
  const records: DeltaRecord[] = [];
  for (const f of walk(dir)) {
    if (!f.endsWith(".json")) continue;
    const rec = readJson(f);
    if (rec) records.push(rec);
  }
  return records.sort((a, b) => a.generated_at.localeCompare(b.generated_at));
}

/** Deltas whose ids (or type-breakdown keys, when truncated) touch one of `nodeIds`. */
function deltasTouching(deltas: DeltaRecord[], nodeIds: string[]): DeltaRecord[] {
  const idSet = new Set(nodeIds);
  return deltas.filter((d) => {
    const touchedIds = [
      ...(d.ids.nodes_added ?? []),
      ...(d.ids.nodes_removed ?? []),
      ...(d.ids.edges_added ?? []),
      ...(d.ids.edges_removed ?? []),
    ];
    if (touchedIds.some((id) => [...idSet].some((n) => id.includes(n)))) return true;
    if (d.ids.truncated) {
      // Can't resolve to specific ids when truncated; fall back to type-breakdown
      // presence of the relevant node types as a weak signal.
      return false;
    }
    return false;
  });
}

interface TimeSpanResult {
  earliest?: string;
  latest?: string;
  spanDays?: number;
  removalInWindow?: boolean;
  source: "delta-log" | "git-log-fallback" | "none";
}

/** M2/M4 span + removal computation over the delta log, or git log fallback. */
function computeSpan(
  projectPath: string,
  deltas: DeltaRecord[],
  nodeIds: string[],
  planePaths: string[]
): TimeSpanResult {
  const touching = deltasTouching(deltas, nodeIds);
  if (touching.length > 0) {
    const earliest = touching[0].generated_at;
    const latest = touching[touching.length - 1].generated_at;
    const spanDays = (new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000;
    const cutoff = Date.now() - 30 * 86400000;
    const removalInWindow = touching.some((d) => {
      const t = new Date(d.generated_at).getTime();
      if (t < cutoff) return false;
      return d.totals.nodes_removed > 0 || d.totals.edges_removed > 0;
    });
    return { earliest, latest, spanDays, removalInWindow, source: "delta-log" };
  }

  // Fallback: git log --format=%cI over the plane paths.
  const existing = planePaths.filter((p) => existsSync(p));
  if (existing.length === 0) return { source: "none" };
  const rel = existing.map((p) => relative(projectPath, p));
  const out = git(projectPath, ["log", "--format=%cI", "--", ...rel]);
  const dates = out.split("\n").filter(Boolean).sort();
  if (dates.length === 0) return { source: "none" };
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const spanDays = (new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000;
  // git diff cannot distinguish a removed edge from a reformatted file; conservatively
  // treat any commit touching the paths in the last 30 days as "changed", not "removed".
  return { earliest, latest, spanDays, removalInWindow: undefined, source: "git-log-fallback" };
}

// ---------------------------------------------------------------------------
// §4.3/§4.4 Maturity tests M1-M6
// ---------------------------------------------------------------------------

function testM1(projectPath: string, resolvesInPlane: (ref: string) => boolean): MaturityResult {
  const decisionsDir = join(projectPath, "docs", "decisions");
  if (!existsSync(decisionsDir)) {
    return { id: "M1", pass: false, detail: "no docs/decisions/ directory" };
  }
  const decFiles = readdirSync(decisionsDir).filter((f) => /^DEC-.*\.md$/.test(f));
  let citing = 0;
  const citingFiles: string[] = [];
  for (const f of decFiles) {
    const content = readFileSync(join(decisionsDir, f), "utf-8");
    const m = content.match(/evidence_refs:\s*\[(.*)\]/);
    if (!m) continue;
    const raw = m[1].trim();
    if (raw.length === 0) continue; // empty evidence_refs excluded from denominator, not a failure
    const refs = raw.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (refs.some((r) => resolvesInPlane(r))) {
      citing++;
      citingFiles.push(f);
    }
  }
  return {
    id: "M1",
    pass: citing >= 3,
    detail: `${citing} decision record(s) with non-empty evidence_refs resolving inside the plane (need >=3): ${citingFiles.join(", ") || "none"}`,
  };
}

function testM2(span: TimeSpanResult): MaturityResult {
  if (span.source === "none") {
    return { id: "M2", pass: false, detail: "no delta history and no git history over plane paths" };
  }
  const pass = (span.spanDays ?? 0) >= 90;
  const unverified = span.source === "git-log-fallback";
  return {
    id: "M2",
    pass,
    unverifiedByDelta: unverified,
    detail: `span ${span.earliest} .. ${span.latest} = ${(span.spanDays ?? 0).toFixed(1)} day(s) (need >=90) [source: ${span.source}]`,
  };
}

function testM4(span: TimeSpanResult): MaturityResult {
  if (span.source === "none") {
    return { id: "M4", pass: false, detail: "no delta history and no git history over plane paths" };
  }
  if (span.source === "delta-log") {
    const pass = !span.removalInWindow;
    return {
      id: "M4",
      pass,
      detail: pass
        ? "no removed node/edge touching the plane's governing nodes in the last 30 days"
        : "a removal (node/edge) touching the plane's governing nodes was recorded in the last 30 days",
    };
  }
  // git-log-fallback: cannot distinguish removal from reformat; report weaker pass with mark.
  return {
    id: "M4",
    pass: true,
    unverifiedByDelta: true,
    detail: "git-log fallback cannot distinguish a removed edge from a reformatted file; no fatal errors found in recent commits over plane paths, but this is UNVERIFIED-BY-DELTA",
  };
}

function testM3(form: Form, projectPath: string, plane: string): MaturityResult {
  // Hygiene gate: best-effort per-form check for unresolved CONTESTED / dangling SUPERSEDED.
  if (form === "F1") {
    const docsDir = join(projectPath, "docs");
    const ledgerFiles = walk(docsDir).filter((f) => /evidence|ledger/i.test(f) && f.endsWith(".md"));
    let contested = 0;
    for (const f of ledgerFiles) {
      const content = readFileSync(f, "utf-8");
      contested += (content.match(/\bCONTESTED\b/g) ?? []).length;
    }
    return { id: "M3", pass: contested === 0, detail: `${contested} unresolved CONTESTED row(s) in ledger file(s)` };
  }
  if (form === "F2") {
    const killDir = join(projectPath, "procedures", "_kill-criteria");
    const count = existsSync(killDir) ? readdirSync(killDir).filter((f) => f.endsWith(".json")).length : 0;
    return { id: "M3", pass: true, detail: `${count} _kill-criteria predicate file(s) present; no reversal-ledger check implemented, reported informational` };
  }
  if (form === "F3") {
    const migDir = join(projectPath, "evidence-models", "migrations");
    const hasReadme = existsSync(join(migDir, "README.md"));
    return { id: "M3", pass: true, detail: hasReadme ? "evidence-models/migrations/README.md present" : "no migrations/ dir found (no supersession claims to check)" };
  }
  return { id: "M3", pass: false, detail: "form F0/MIXED/none — cannot evaluate supersession discipline" };
}

const CLIENT_MARK_PATTERNS = [/\bkr\b/i, /\bko\b/i, /-ko\./i, /_ko\./i, /client[-_]/i];

function testM5(projectPath: string, files: string[]): MaturityResult {
  const flagged: string[] = [];
  for (const f of files) {
    const base = f.split(/[\\/]/).pop() ?? "";
    if (CLIENT_MARK_PATTERNS.some((re) => re.test(base))) flagged.push(relative(projectPath, f));
  }
  return {
    id: "M5",
    pass: flagged.length === 0,
    detail: flagged.length === 0 ? "no country-mark/client-identifier filenames detected (static scan only)" : `flagged filename(s): ${flagged.join(", ")}`,
  };
}

interface M6Result {
  m6a: MaturityResult;
  m6b: MaturityResult;
  procedureFiles: string[];
  recordIdPattern?: string;
}

/**
 * M6a reference synonyms per form — the literal directory/registry-field names
 * (`_kill-criteria`, `evidence_var`) are the fingerprint used for form detection,
 * but a real collection-procedure step may spell the same target differently
 * (verified: co-newbiz's stage-gate-governance/SKILL.md step 5 reads "the recorded
 * kill-criteria ledger" / `kill_criteria_evaluation` — hyphen/underscore/no-prefix
 * variants of the same registry table, not the literal directory name).
 */
function m6aSynonyms(form: Form, planeTargets: string[]): string[] {
  if (form === "F2") {
    return [...planeTargets, "kill-criteria", "kill_criteria", "evidence variable", "evidence-variable"];
  }
  return planeTargets;
}

function testM6(projectPath: string, form: Form, planeTargets: string[]): M6Result {
  const skillDirs = PLATFORM_SKILL_BASES;
  const referencing: string[] = [];
  const synonyms = m6aSynonyms(form, planeTargets);
  for (const d of skillDirs) {
    const base = join(projectPath, d);
    if (!existsSync(base)) continue;
    for (const f of walk(base)) {
      if (!f.endsWith("SKILL.md")) continue;
      const content = readFileSync(f, "utf-8");
      // Only match a reference inside a step body (a numbered/bulleted step or a
      // procedure body line), not a section heading, per design §4.4.
      const lines = content.split("\n");
      const stepBodyLines = lines.filter((l) => /^\s*(\d+\.|[-*])\s+/.test(l) || /^\s{2,}\S/.test(l));
      for (const target of synonyms) {
        if (stepBodyLines.some((l) => l.toLowerCase().includes(target.toLowerCase()))) {
          referencing.push(`${relative(projectPath, f)} (references ${target})`);
        }
      }
    }
  }
  const m6a: MaturityResult = {
    id: "M6a",
    pass: referencing.length > 0,
    detail:
      referencing.length > 0
        ? `collection procedure step(s) reference the plane target: ${referencing.join("; ")}`
        : "no SKILL.md step body references the plane's schema path / registry table / ledger artifact",
  };

  if (!m6a.pass) {
    return { m6a, m6b: { id: "M6b", pass: false, detail: "M6a failed; M6b not evaluated" }, procedureFiles: [] };
  }

  // M6b: >=3 distinct records matching a declared ID pattern, OR >=2 distinct
  // procedure-step references / commits.
  let recordCount = 0;
  const recordIdRe = /\b(FIND|CA)-\d{4}-\d{4,}\b|\b[A-Z]{2,}-\d{6}\b/;
  if (form === "F3" || form === "F1") {
    const memoryDir = join(projectPath, "memory");
    const candidateDirs = [memoryDir, join(projectPath, "docs")];
    const seen = new Set<string>();
    for (const dir of candidateDirs) {
      if (!existsSync(dir)) continue;
      for (const f of walk(dir)) {
        const base = f.split(/[\\/]/).pop() ?? "";
        const m = base.match(recordIdRe);
        if (m) seen.add(m[0]);
      }
    }
    recordCount = seen.size;
  }
  if (form === "F2") {
    const killDir = join(projectPath, "procedures", "_kill-criteria");
    recordCount = existsSync(killDir) ? readdirSync(killDir).filter((f) => f.endsWith(".json")).length : 0;
  }

  const distinctProcedureRefs = new Set(referencing).size;
  const m6bPassByRecords = recordCount >= 3;
  const m6bPassByRefs = distinctProcedureRefs >= 2;
  const m6b: MaturityResult = {
    id: "M6b",
    pass: m6bPassByRecords || m6bPassByRefs,
    detail: `${recordCount} distinct record-id-matching file(s) found (need >=3), ${distinctProcedureRefs} distinct procedure-step reference(s) (need >=2 as alternate path)`,
  };

  return { m6a, m6b, procedureFiles: referencing };
}

// ---------------------------------------------------------------------------
// Plane assembly + verdict
// ---------------------------------------------------------------------------

function resolvesRefInPlane(form: Form, ref: string, planeTargets: string[]): boolean {
  return planeTargets.some((t) => ref.includes(t) || t.includes(ref));
}

/**
 * Governing targets for a plane, derived from the exact files detectForms already
 * identified as the plane's evidence (signal.files) — never recomputed independently,
 * so M1-M6 evaluate against the same files the form-detection verdict was based on.
 */
function planeTargetsForForm(form: Form, projectPath: string, signalFiles: string[] | undefined): { targets: string[]; paths: string[]; nodeIds: string[] } {
  const paths = signalFiles ?? [];
  if (form === "F1") {
    return { targets: ["ledger", "evidence-ledger"], paths, nodeIds: ["evidence-ledger"] };
  }
  if (form === "F2") {
    return { targets: ["evidence_var", "_kill-criteria"], paths, nodeIds: ["evidence_var", "kill-criteria"] };
  }
  if (form === "F3") {
    const targets = paths.map((f) => (f.split(/[\\/]/).pop() ?? f));
    return { targets, paths, nodeIds: targets };
  }
  return { targets: [], paths: [], nodeIds: [] };
}

function evaluatePlane(projectPath: string, signal: FormSignal, allSignals: FormSignal[], deltas: DeltaRecord[]): PlaneResult {
  const forms = allSignals.map((s) => s.form);
  const isMixed = new Set(forms).size > 1;
  const form: Form = isMixed ? "MIXED" : signal.form;
  const notes: string[] = [signal.detail];

  if (form === "F0" || form === "MIXED" || form === "none") {
    return {
      plane: signal.plane,
      forms,
      form,
      maturity: [],
      verdict: "NEEDS_TRIAGE",
      notes: [...notes, form === "MIXED" ? `mixed forms detected: ${forms.join(", ")} — human triage, half-finished migration risk` : "routes to human triage per design §4.2"],
    };
  }

  const { targets, paths, nodeIds } = planeTargetsForForm(form, projectPath, signal.files);
  const resolvesInPlane = (ref: string) => resolvesRefInPlane(form, ref, targets);

  const m1 = testM1(projectPath, resolvesInPlane);
  const span = computeSpan(projectPath, deltas, nodeIds, paths);
  const m2 = testM2(span);
  const m4 = testM4(span);
  const m3 = testM3(form, projectPath, signal.plane);
  const m5 = testM5(projectPath, paths);
  const m6 = testM6(projectPath, form, targets);

  const maturity: MaturityResult[] = [m1, m2, m3, m4, m5, m6.m6a, m6.m6b];
  const allPass = maturity.every((m) => m.pass);
  const m6aPass = m6.m6a.pass;
  const m6bPass = m6.m6b.pass;

  let verdict: PlaneResult["verdict"];
  if (allPass) {
    verdict = "PROMOTABLE";
  } else if (m6aPass && !m6bPass && [m1, m2, m3, m4, m5].every((m) => m.pass)) {
    verdict = "SCHEMA-ONLY";
  } else if (maturity.some((m) => !m.pass)) {
    verdict = "NOT_YET";
  } else {
    verdict = "NEEDS_TRIAGE";
  }

  const unverified = maturity.some((m) => m.unverifiedByDelta);
  if (unverified) notes.push("UNVERIFIED-BY-DELTA: M2/M4 rest on git-log fallback (no project delta history yet)");

  return { plane: signal.plane, forms, form, maturity, verdict, notes };
}

function scanProject(projectPath: string, metaSchema: any | null): ProjectReport {
  const signals = detectForms(projectPath, metaSchema);
  const deltas = loadDeltaLog(projectPath);
  if (signals.length === 0) {
    return {
      project: projectPath,
      planes: [
        {
          plane: "(none)",
          forms: ["none"],
          form: "none",
          maturity: [],
          verdict: "NEEDS_TRIAGE",
          notes: ["no evidence-shaped content detected"],
        },
      ],
    };
  }
  const planes = signals.map((s) => evaluatePlane(projectPath, s, signals, deltas));
  return { project: projectPath, planes };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function markdownReport(reports: ProjectReport[]): string {
  const lines: string[] = [
    `# evidence-backport-scan report — ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Read-only. Verdicts: PROMOTABLE = pair-authoring candidate (Step 2b human review) ·",
    "SCHEMA-ONLY = shape real, practice not yet (M6a pass / M6b fail) ·",
    "NOT_YET = a maturity test failed · NEEDS_TRIAGE = F0/MIXED/none, human triage required.",
    "This script never writes into templates/ or into any Projects/co-* instance.",
    "",
  ];
  for (const p of reports) {
    lines.push(`## ${p.project}`, "");
    lines.push("| plane | form(s) | M1 | M2 | M3 | M4 | M5 | M6a | M6b | verdict |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const plane of p.planes) {
      const get = (id: string) => {
        const m = plane.maturity.find((x) => x.id === id);
        if (!m) return "—";
        return (m.pass ? "PASS" : "FAIL") + (m.unverifiedByDelta ? "*" : "");
      };
      lines.push(
        `| ${plane.plane} | ${plane.forms.join(",")} | ${get("M1")} | ${get("M2")} | ${get("M3")} | ${get("M4")} | ${get("M5")} | ${get("M6a")} | ${get("M6b")} | **${plane.verdict}** |`
      );
    }
    lines.push("");
    for (const plane of p.planes) {
      lines.push(`### ${plane.plane} (${plane.verdict})`, "");
      for (const n of plane.notes) lines.push(`- ${n}`);
      for (const m of plane.maturity) lines.push(`- **${m.id}**: ${m.pass ? "PASS" : "FAIL"} — ${m.detail}`);
      lines.push("");
    }
  }
  lines.push("`*` = UNVERIFIED-BY-DELTA (git-log fallback; no project delta history yet).");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  const { projects, json, help } = parseArgs();
  if (help) {
    console.log(`evidence-backport-scan.ts v${VERSION} — evidence plane maturity scanner (project-resync Step 2b).

Usage:
  bun scripts/evidence-backport-scan.ts [--project <path>]... [--json]

Default projects: all Projects/co-*. Read-only — never modifies templates/ or Projects/*.`);
    process.exit(0);
  }
  const targets = projects.length > 0 ? projects : defaultProjects();
  if (targets.length === 0) {
    console.error("evidence-backport-scan: no Projects/co-* directories found and no --project given.");
    process.exit(1);
  }

  const metaSchemaPath = resolve("templates/common/schemas/evidence-model.schema.json");
  const metaSchema = existsSync(metaSchemaPath) ? readJson(metaSchemaPath) : null;

  const reports: ProjectReport[] = [];
  for (const project of targets) {
    if (!existsSync(project)) {
      console.warn(`⚠️  evidence-backport-scan: ${project} does not exist — skipped.`);
      continue;
    }
    reports.push(scanProject(project, metaSchema));
  }

  if (json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.log(markdownReport(reports));
  }
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal evidence-backport-scan error:", err);
    process.exit(1);
  });
}
