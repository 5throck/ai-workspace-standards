#!/usr/bin/env bun
/**
 * detect-backport.ts — sync-embedded detection of backport candidates and
 * template-layer defects (design docs/designs/2026-11-17-sync-auto-detection-design.md,
 * detection batch PR-B / T-20261118-001).
 * @version 1.0.0
 *
 * v1.0.0 (2026-11-18, spec docs/designs/2026-11-17-sync-auto-detection-design.md
 *         §5/§6, DEC-20261117-06): opt-in detector run by a project's /sync flow
 *         (conditional sync-skill step; `scripts/dev-sync.ts` is NOT modified —
 *         the gate-off path is byte-identical to today's sync, AC-1).
 *
 * Gate (§5.1): variant.json `syncDetection` block (absent key == OFF) or the
 * `--detect-backport` one-off argument override (explicit argument > config).
 * When OFF: one stdout line, exit 0, zero writes, zero git reads.
 *
 * Diff surface (§5.2): `origin/main...HEAD` (the sync's landed surface).
 *
 * Evidence classes:
 *   E1 LOCAL_PATCH        — LOCAL-PATCH(upstream-request: pending) markers found
 *                          by scripts/helpers/local-patch-scan.ts → template-defect
 *                          (file now); markers carrying a real U-id are report-only
 *                          (already filed).
 *   E2 DELIVERED_EDIT     — a file whose scripts/lib/upgrade-policy.ts resolveClaim
 *                          policy is SYNC carries a non-empty diff in the landed
 *                          surface, excluding the mechanical delivery list
 *                          (project-resync Step-2(b): template-version.txt,
 *                          .claude/last-upgrade-*, docs/VERSION_MANIFEST.md,
 *                          memory/, generated registries).
 *   E3 RETIRED_TOKEN      — a delivered-content file in the landed surface still
 *                          matches a `retired_tokens` entry (whole-token \b-bounded
 *                          regex). Delivered-content surface = isDeliveryPolicy
 *                          minus LOCKED (git/gitleaks config) minus WORKSPACE
 *                          (project-authored workspace docs); includes JSON_MERGE
 *                          so the §4 worked example (.agents/mcp.json carrying
 *                          graft) fires (AC-3).
 *   E4 MANAGED_NEW_FILE   — new file in the landed surface under a managed surface
 *                          (skills/<name>/SKILL.md, scripts/helpers/, scripts/lib/,
 *                          evidence-models/, agents/<name>.md) whose claim is not
 *                          PROJECT_STATE → reusable-asset (human-judged promotion,
 *                          ADR-0031).
 *
 * Report (§5.3): `detect-backport-report/1` JSON written to
 * `$(git rev-parse --git-dir)/detect-backport-report.json` (next to
 * sync-pr-body.md — outside the working tree, never committed) plus a console
 * summary. State file `$(git rev-parse --git-dir)/detect-backport-state.json`
 * (§5.5) records filed dedupe tokens so repeat candidates are reported as
 * `duplicate-local`, never re-filed. The state file is script-owned for tokens;
 * the `uid` field is backfilled deterministically from LOCAL-PATCH markers
 * (real ids) found at the entry's affected paths (§5.4 marker protocol), and the
 * session-side skill step may enrich `resolution` after checking
 * upstream_request_status — a state entry with `resolution: "fixed"` drops out
 * of the `unresolved_template_defects` pending set (§5.8). The script itself
 * never queries the MCP (deterministic evidence in the script, MCP-mediated
 * status in the session — the §5.2 split).
 *
 * unresolved_template_defects (§5.3/§5.8): pending set = this run's
 * template-defect candidates plus state-file template-defect records whose
 * resolution is not "fixed". Warning-only, NEVER a gate — no exit code or
 * enforcement hook attaches to it (the §5.8 non-blocking invariant).
 *
 * Cap (§5.5): max_tickets_per_sync (default 3, range 1..5), allocation order
 * E1 > E2 > E3 > E4; over-cap candidates stay in the report as `over-cap` rows.
 * Duplicates (token already in the state file) and already-filed E1 markers are
 * reported but never consume cap.
 *
 * drafted_symptom: declarative observed-vs-expected text, ≤600 chars, no
 * imperative phrases (upstream MCP §9 L1 injection heuristics).
 *
 * Flags: --project <path> (project root, default cwd), --dry-run (no file
 * writes at all — report and console output only, no state file; used by tests
 * and first-enablement rehearsal), --json (stdout carries the report JSON
 * verbatim; the console summary moves to stderr so `--json > report` captures
 * pure JSON), --detect-backport (one-off gate override).
 *
 * Read-only on the working tree; writes only the report + state file under the
 * git dir. A malformed `syncDetection` block is treated as OFF with a stderr
 * WARN line (zero-new-behavior safety; the validate-templates shape check from
 * PR-C owns the loud FAIL).
 */

// @version 1.0.0

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { scanLocalPatches, type LocalPatchFinding } from "./helpers/local-patch-scan.ts";
import { resolveClaim, VARIANT_ASSET_DIRS_PASS } from "./lib/upgrade-policy.ts";
import { isDeliveryPolicy, type UpgradePolicy } from "./lib/upgrade-policy.ts";
import { die } from "./lib/error-handling.ts";

const SCHEMA_REPORT = "detect-backport-report/1";
const SCHEMA_STATE = "detect-backport-state/1";
const REPORT_FILENAME = "detect-backport-report.json";
const STATE_FILENAME = "detect-backport-state.json";
const MAX_SYMPTOM_CHARS = 600;
/** Do-not-exceed cap range (§5.1); outside it the gate is malformed → OFF + WARN. */
const CAP_MIN = 1;
const CAP_MAX = 5;
const DEFAULT_CAP = 3;

// ── Gate (§5.1) ────────────────────────────────────────────────────────────────────────────────

export interface SyncDetectionGate {
  enabled: boolean;
  /** Integer 1..5 after defaulting/clamping; undefined when the block is absent. */
  maxTicketsPerSync?: number;
  retiredTokens: string[];
  source: "variant.json" | "argument";
  /** Non-empty when the block was present but malformed (validator's territory; OFF here). */
  configError?: string;
}

interface RawSyncDetection {
  enabled?: unknown;
  max_tickets_per_sync?: unknown;
  retired_tokens?: unknown;
}

/** Parse the optional `syncDetection` block from a variant.json object (absent key == OFF). */
export function parseSyncDetection(variantJson: Record<string, unknown> | null): SyncDetectionGate | null {
  const raw = variantJson?.syncDetection;
  if (raw === undefined) return null;
  const block = raw as RawSyncDetection;
  if (typeof block !== "object" || block === null || Array.isArray(block)) {
    return {
      enabled: false,
      retiredTokens: [],
      source: "variant.json",
      configError: "syncDetection block is not an object",
    };
  }
  if (typeof block.enabled !== "boolean") {
    return {
      enabled: false,
      retiredTokens: [],
      source: "variant.json",
      configError: "syncDetection.enabled is not a boolean",
    };
  }
  const cap = block.max_tickets_per_sync === undefined ? DEFAULT_CAP : block.max_tickets_per_sync;
  if (typeof cap !== "number" || !Number.isInteger(cap) || cap < CAP_MIN || cap > CAP_MAX) {
    return {
      enabled: false,
      retiredTokens: [],
      source: "variant.json",
      configError: `syncDetection.max_tickets_per_sync must be an integer ${CAP_MIN}..${CAP_MAX}`,
    };
  }
  if (
    block.retired_tokens !== undefined &&
    (!Array.isArray(block.retired_tokens) || block.retired_tokens.some((t) => typeof t !== "string"))
  ) {
    return {
      enabled: false,
      retiredTokens: [],
      source: "variant.json",
      configError: "syncDetection.retired_tokens must be an array of strings",
    };
  }
  return {
    enabled: block.enabled,
    maxTicketsPerSync: cap,
    retiredTokens: block.retired_tokens === undefined ? [] : (block.retired_tokens as string[]),
    source: "variant.json",
  };
}

function readVariantJson(projectRoot: string): { variantJson: Record<string, unknown> | null; variantName: string } {
  const path = join(projectRoot, "variant.json");
  if (!existsSync(path)) return { variantJson: null, variantName: "" };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    return { variantJson: parsed, variantName: typeof parsed.name === "string" ? parsed.name : "" };
  } catch {
    return { variantJson: null, variantName: "" };
  }
}

// ── Diff surface (§5.2) ────────────────────────────────────────────────────────────────────────

interface ChangedFile {
  /** Project-relative path at HEAD (rename target for renames). */
  rel: string;
  status: "A" | "M" | "D" | "R";
}

interface DiffSurface {
  changedFiles: ChangedFile[];
  changedCount: number;
}

function git(args: string[], cwd: string): { ok: boolean; stdout: string } {
  const res = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { ok: res.status === 0, stdout: (res.stdout ?? "").toString() };
}

function readDiffSurface(projectRoot: string): DiffSurface | null {
  const nameStatus = git(["diff", "--name-status", "-M", "origin/main...HEAD"], projectRoot);
  if (!nameStatus.ok) return null;
  const files: ChangedFile[] = [];
  for (const line of nameStatus.stdout.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0] ?? "";
    if (status.startsWith("R")) {
      // Rename: judge the landed content at its new path.
      files.push({ rel: (parts[2] ?? parts[1] ?? "").trim(), status: "R" });
      continue;
    }
    if (status === "A" || status === "M" || status === "D") {
      files.push({ rel: (parts[1] ?? "").trim(), status });
    }
  }
  return { changedFiles: files, changedCount: files.length };
}

function headContent(projectRoot: string, rel: string): string | null {
  const res = git(["show", `HEAD:${rel}`], projectRoot);
  return res.ok ? res.stdout : null;
}

/** Mechanical delivery files excluded from E2 (project-resync Step-2(b) list, design §5.2). */
export function isMechanicalPath(rel: string): boolean {
  return (
    rel === ".claude/template-version.txt" ||
    rel === "template-version.txt" ||
    rel.startsWith(".claude/last-upgrade-") ||
    rel === "docs/VERSION_MANIFEST.md" ||
    rel === "docs/skill-graph.json" ||
    rel === "scripts-snapshot.json" ||
    rel === "memory" ||
    rel.startsWith("memory/")
  );
}

/** E2 surface: exactly the design's literal bar — policy SYNC. */
function isSyncClaim(rel: string, variant: string): boolean {
  return resolveClaim(rel, variant).policy === "SYNC";
}

/** E3 surface: delivered-content policies minus LOCKED minus WORKSPACE (header rationale). */
const E3_DELIVERED_POLICIES: ReadonlySet<UpgradePolicy> = new Set([
  "SYNC",
  "JSON_MERGE",
  "SCHEMA_MERGE",
  "HASH_SYNC",
  "VERSIONED_SYNC",
  "MERGE_MANAGED",
  "OVERWRITE",
  "ADD_IF_MISSING",
]);

function isDeliveredContentClaim(rel: string, variant: string): boolean {
  const { policy } = resolveClaim(rel, variant);
  return E3_DELIVERED_POLICIES.has(policy);
}

/** E4 managed surfaces (design §5.2). */
export function isManagedSurface(rel: string): boolean {
  return (
    /^skills\/[^/]+\/SKILL\.md$/.test(rel) ||
    rel.startsWith("scripts/helpers/") ||
    rel.startsWith("scripts/lib/") ||
    rel.startsWith("evidence-models/") ||
    /^agents\/[^/]+\.md$/.test(rel)
  );
}

// ── Layers (§5.4: delivered-common → L1; variant-delivered → L2; ambiguous → unsure) ──────────

function suspectedLayerFor(rel: string, variant: string): "L1" | "L2" {
  const claim = resolveClaim(rel, variant);
  if (claim.pass === VARIANT_ASSET_DIRS_PASS || claim.pass === "DOCS_MERGE") return "L2";
  return "L1";
}

// ── dedupe_token (§5.3: sha256:<type|paths|anchor>) ────────────────────────────────────────────

export function dedupeToken(candidateType: string, affectedPaths: string[], anchor: string): string {
  const payload = `${candidateType}|${[...affectedPaths].sort().join(",")}|${anchor}`;
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

// ── drafted_symptom (§5.3: declarative observed-vs-expected, ≤600 chars) ──────────────────────

/** Declarative symptom templates — no sentence begins with an imperative verb
 * (upstream MCP §9 heuristics); facts + file:line only. */
export function draftSymptom(evidenceClass: string, file: string, detail: string): string {
  switch (evidenceClass) {
    case "E1_LOCAL_PATCH":
      return (
        `Observed: ${file} carries a LOCAL-PATCH(upstream-request: ${detail}) marker, so template-delivered content was ` +
        `patched locally without a filed upstream request. Expected: local patches on delivered files are tracked by a ` +
        `filed upstream request id.`
      );
    case "E2_DELIVERED_EDIT":
      return (
        `Observed: delivered file ${file} (upgrade policy SYNC) carries a non-empty diff against origin/main in this ` +
        `sync's landed surface. Expected: delivered files change only through template delivery, so a project-side edit ` +
        `points at a template-layer gap.`
      );
    case "E3_RETIRED_TOKEN":
      return (
        `Observed: ${file} still references the retired token '${detail}' after this project migrated away from it. ` +
        `Expected: template-delivered content no longer ships the retired identifier.`
      );
    case "E4_MANAGED_NEW_FILE":
      return (
        `Observed: new managed-surface file ${file} was authored project-side in this sync's landed surface. Expected: ` +
        `reusable assets on managed surfaces are assessed by a human for template-layer promotion (ADR-0031).`
      );
    default:
      return `Observed: ${file} (${detail}). Expected: template-delivered content stays in sync with the template layer.`;
  }
}

function clampSymptom(text: string): string {
  return text.length <= MAX_SYMPTOM_CHARS ? text : `${text.slice(0, MAX_SYMPTOM_CHARS - 1)}…`;
}

// ── Report + state schemas (§5.3, §5.5) ───────────────────────────────────────────────────────

export type CandidateType = "template-defect" | "reusable-asset";
export type EvidenceClass = "E1_LOCAL_PATCH" | "E2_DELIVERED_EDIT" | "E3_RETIRED_TOKEN" | "E4_MANAGED_NEW_FILE";
export type SuggestedAction = "file-upstream" | "file-asset-report" | "mark-local-patch" | "report-only";
export type Disposition = "within-cap" | "over-cap" | "duplicate-local" | "already-filed";

export interface EvidenceItem {
  file: string;
  line?: number;
  note: string;
}

export interface Candidate {
  id: string;
  candidate_type: CandidateType;
  evidence_class: EvidenceClass;
  suspected_layer: "L1" | "L2" | "unsure";
  evidence: EvidenceItem[];
  affected_paths: string[];
  dedupe_token: string;
  drafted_symptom: string;
  suggested_action: SuggestedAction;
  disposition: Disposition;
}

export interface DetectBackportReport {
  schema: typeof SCHEMA_REPORT;
  generated_at: string;
  project: string;
  variant: string;
  gate: { source: "variant.json" | "argument"; enabled: boolean };
  diff_surface: { base: string; head: string; changed_files: number };
  candidates: Candidate[];
  counts: { candidates: number; cap: number; over_cap: number };
  unresolved_template_defects: { count: number; affected_files: string[] };
  notes: string[];
}

export interface StateEntry {
  dedupe_token: string;
  candidate_type: CandidateType;
  affected_paths: string[];
  /** Returned U-ticket id once known (marker backfill or session-side enrichment); null until then. */
  uid: string | null;
  filed_at: string;
  /** Session-side enrichment (§5.8): "fixed" once the upstream request resolved fixed; null until then. */
  resolution: string | null;
}

export interface DetectBackportState {
  schema: typeof SCHEMA_STATE;
  updated_at: string;
  filed: StateEntry[];
}

function emptyState(): DetectBackportState {
  return { schema: SCHEMA_STATE, updated_at: "", filed: [] };
}

function loadState(gitDir: string): { state: DetectBackportState; note?: string } {
  const path = join(gitDir, STATE_FILENAME);
  if (!existsSync(path)) return { state: emptyState() };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as DetectBackportState;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.filed)) {
      return { state: emptyState(), note: "state file malformed — treated as empty" };
    }
    return { state: parsed };
  } catch {
    return { state: emptyState(), note: "state file unreadable — treated as empty" };
  }
}

/** Backfill null `uid` entries from LOCAL-PATCH markers with real ids at the
 * entry's affected paths (§5.4 marker protocol — the session marks patch sites
 * with the returned id after filing; the next run closes the loop deterministically). */
function backfillUids(state: DetectBackportState, findings: LocalPatchFinding[]): string[] {
  const notes: string[] = [];
  const byFile = new Map<string, string[]>();
  for (const f of findings) {
    if (f.id === "pending") continue;
    const list = byFile.get(f.file) ?? [];
    list.push(f.id);
    byFile.set(f.file, list);
  }
  let backfilled = 0;
  for (const entry of state.filed) {
    if (entry.uid) continue;
    for (const p of entry.affected_paths) {
      const ids = byFile.get(p);
      if (ids && ids.length > 0) {
        entry.uid = ids[0];
        backfilled += 1;
        break;
      }
    }
  }
  if (backfilled > 0) notes.push(`${backfilled} state entr(y|ies) had their U-id backfilled from LOCAL-PATCH markers`);
  return notes;
}

// ── Detection core ─────────────────────────────────────────────────────────────────────────────

export interface DetectionOptions {
  /** Project root (default: process.cwd()). */
  projectRoot?: string;
  /** `--detect-backport` argument override (explicit argument > config, §5.1). */
  forceDetect?: boolean;
  /** No file writes at all — report + console only, no state file. */
  dryRun?: boolean;
}

export interface DetectionResult {
  disabled: boolean;
  /** One-line reason when disabled (the single stdout line for the OFF path). */
  disabledReason?: string;
  /** Non-fatal config/gate warnings (stderr lines). */
  warnings: string[];
  report?: DetectBackportReport;
  /** Paths written (empty under --dry-run). */
  written: string[];
}

function escapeRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectE1(findings: LocalPatchFinding[], notes: string[]): Candidate[] {
  const pending = findings.filter((f) => f.id === "pending");
  const filed = findings.filter((f) => f.id !== "pending");
  if (filed.length > 0) notes.push(`${filed.length} E1 marker(s) already carry U-ids (report-only)`);
  const candidates: Candidate[] = [];
  for (const f of [...pending].sort((a, b) => a.file.localeCompare(b.file))) {
    candidates.push({
      id: "",
      candidate_type: "template-defect",
      evidence_class: "E1_LOCAL_PATCH",
      suspected_layer: "L1",
      evidence: [{ file: f.file, note: `LOCAL-PATCH(upstream-request: ${f.id}) marker` }],
      affected_paths: [f.file],
      dedupe_token: dedupeToken("template-defect", [f.file], `E1:${f.file}:${f.id}`),
      drafted_symptom: clampSymptom(draftSymptom("E1_LOCAL_PATCH", f.file, f.id)),
      suggested_action: "file-upstream",
      disposition: "within-cap", // provisional; cap/dedupe pass overwrites
    });
  }
  for (const f of [...filed].sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id))) {
    candidates.push({
      id: "",
      candidate_type: "template-defect",
      evidence_class: "E1_LOCAL_PATCH",
      suspected_layer: "L1",
      evidence: [{ file: f.file, note: `LOCAL-PATCH(upstream-request: ${f.id}) marker (already filed)` }],
      affected_paths: [f.file],
      dedupe_token: dedupeToken("template-defect", [f.file], `E1:${f.file}:${f.id}`),
      drafted_symptom: clampSymptom(draftSymptom("E1_LOCAL_PATCH", f.file, f.id)),
      suggested_action: "report-only",
      disposition: "already-filed",
    });
  }
  return candidates;
}

function collectE2(surface: DiffSurface, variant: string, excludeFiles: ReadonlySet<string>): Candidate[] {
  const candidates: Candidate[] = [];
  for (const f of [...surface.changedFiles].sort((a, b) => a.rel.localeCompare(b.rel))) {
    if (f.status === "D") continue;
    if (excludeFiles.has(f.rel)) continue; // E1 > E2 (§5.5 priority order): marker files are E1's territory
    if (f.status === "A" && isManagedSurface(f.rel)) continue; // new managed files are E4's territory
    if (isMechanicalPath(f.rel)) continue;
    if (!isSyncClaim(f.rel, variant)) continue;
    candidates.push({
      id: "",
      candidate_type: "template-defect",
      evidence_class: "E2_DELIVERED_EDIT",
      suspected_layer: suspectedLayerFor(f.rel, variant),
      evidence: [{ file: f.rel, note: "non-empty diff on a SYNC-claim delivered file in origin/main...HEAD" }],
      affected_paths: [f.rel],
      dedupe_token: dedupeToken("template-defect", [f.rel], `E2:${f.rel}`),
      drafted_symptom: clampSymptom(draftSymptom("E2_DELIVERED_EDIT", f.rel, "")),
      suggested_action: "file-upstream",
      disposition: "within-cap",
    });
  }
  return candidates;
}

function collectE3(surface: DiffSurface, projectRoot: string, variant: string, tokens: string[]): Candidate[] {
  if (tokens.length === 0) return [];
  const byToken = new Map<string, EvidenceItem[]>();
  const seenFiles = new Set<string>();
  for (const f of [...surface.changedFiles].sort((a, b) => a.rel.localeCompare(b.rel))) {
    if (f.status === "D") continue;
    if (seenFiles.has(f.rel)) continue;
    seenFiles.add(f.rel);
    if (!isDeliveredContentClaim(f.rel, variant)) continue;
    const content = headContent(projectRoot, f.rel);
    if (content === null) continue;
    const lines = content.split("\n");
    for (const token of tokens) {
      const re = new RegExp(`\\b${escapeRegExp(token)}\\b`);
      for (let i = 0; i < lines.length; i += 1) {
        if (re.test(lines[i] ?? "")) {
          const items = byToken.get(token) ?? [];
          items.push({ file: f.rel, line: i + 1, note: `retired token '${token}'` });
          byToken.set(token, items);
        }
      }
    }
  }
  const candidates: Candidate[] = [];
  for (const token of [...byToken.keys()].sort()) {
    const evidence = (byToken.get(token) ?? []).sort(
      (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0),
    );
    const paths = [...new Set(evidence.map((e) => e.file))];
    candidates.push({
      id: "",
      candidate_type: "template-defect",
      evidence_class: "E3_RETIRED_TOKEN",
      suspected_layer: suspectedLayerFor(paths[0] ?? "", variant),
      evidence,
      affected_paths: paths,
      dedupe_token: dedupeToken("template-defect", paths, `E3:${token}`),
      drafted_symptom: clampSymptom(draftSymptom("E3_RETIRED_TOKEN", paths[0] ?? "", token)),
      suggested_action: "file-upstream",
      disposition: "within-cap",
    });
  }
  return candidates;
}

function collectE4(surface: DiffSurface, variant: string, excludeFiles: ReadonlySet<string>): Candidate[] {
  const candidates: Candidate[] = [];
  for (const f of [...surface.changedFiles].sort((a, b) => a.rel.localeCompare(b.rel))) {
    if (f.status !== "A") continue;
    if (excludeFiles.has(f.rel)) continue; // E1 > E4: a marker-carrying new managed file is E1's territory
    if (!isManagedSurface(f.rel)) continue;
    if (resolveClaim(f.rel, variant).policy === "PROJECT_STATE") continue;
    candidates.push({
      id: "",
      candidate_type: "reusable-asset",
      evidence_class: "E4_MANAGED_NEW_FILE",
      suspected_layer: "unsure",
      evidence: [{ file: f.rel, note: "new file under a managed surface in origin/main...HEAD" }],
      affected_paths: [f.rel],
      dedupe_token: dedupeToken("reusable-asset", [f.rel], `E4:${f.rel}`),
      drafted_symptom: clampSymptom(draftSymptom("E4_MANAGED_NEW_FILE", f.rel, "")),
      suggested_action: "file-asset-report",
      disposition: "within-cap",
    });
  }
  return candidates;
}

/** unresolved_template_defects pending set (§5.3/§5.8): this run's template-defect
 * candidates plus state-file template-defect records whose resolution is not
 * "fixed". Warning-only — never a gate condition. */
export function computeUnresolvedTemplateDefects(
  candidates: Candidate[],
  state: DetectBackportState,
): { count: number; affected_files: string[] } {
  const fixedTokens = new Set(state.filed.filter((e) => e.resolution === "fixed").map((e) => e.dedupe_token));
  const pending = new Map<string, string[]>();
  const add = (token: string, paths: string[]) => {
    if (fixedTokens.has(token)) return;
    const merged = pending.get(token) ?? [];
    for (const p of paths) if (!merged.includes(p)) merged.push(p);
    pending.set(token, merged);
  };
  for (const c of candidates) {
    if (c.candidate_type === "template-defect") add(c.dedupe_token, c.affected_paths);
  }
  for (const entry of state.filed) {
    if (entry.candidate_type === "template-defect") add(entry.dedupe_token, entry.affected_paths);
  }
  const affected = [...new Set([...pending.values()].flat())].sort();
  return { count: pending.size, affected_files: affected };
}

/** Pure disposition pass: cap allocation E1 > E2 > E3 > E4; duplicates and
 * already-filed rows never consume cap (§5.5). */
export function allocateDispositions(candidates: Candidate[], state: DetectBackportState, cap: number): number {
  const filedTokens = new Set(state.filed.map((e) => e.dedupe_token));
  let budget = cap;
  let overCap = 0;
  for (const c of candidates) {
    if (c.disposition === "already-filed") continue; // E1 with real U-id: report-only, no cap
    if (filedTokens.has(c.dedupe_token)) {
      c.disposition = "duplicate-local";
      c.suggested_action = "report-only";
      continue;
    }
    if (budget > 0) {
      c.disposition = "within-cap";
      budget -= 1;
    } else {
      c.disposition = "over-cap";
      overCap += 1;
    }
  }
  return overCap;
}

function assignIds(candidates: Candidate[]): void {
  candidates.forEach((c, i) => {
    c.id = `cand-${String(i + 1).padStart(3, "0")}`;
  });
}

// ── Entry point ────────────────────────────────────────────────────────────────────────────────

/** Full detection run. Import-safe (no side effects unless the caller persists). */
export function runDetection(options: DetectionOptions = {}): DetectionResult {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const warnings: string[] = [];

  // Gate read (§5.1) — BEFORE any git access so the OFF path stays zero-behavior.
  const { variantJson, variantName } = readVariantJson(projectRoot);
  let gate = parseSyncDetection(variantJson);
  if (options.forceDetect) {
    gate = { enabled: true, retiredTokens: gate?.retiredTokens ?? [], source: "argument" };
  }
  if (gate === null) {
    return {
      disabled: true,
      disabledReason: "sync-detection: disabled (no variant.json syncDetection gate and no --detect-backport flag)",
      warnings,
      written: [],
    };
  }
  if (gate.configError) {
    warnings.push(
      `sync-detection WARN: ${gate.configError} — detection stays OFF (run validate-templates.ts for the loud check)`,
    );
    return {
      disabled: true,
      disabledReason: "sync-detection: disabled (malformed syncDetection gate)",
      warnings,
      written: [],
    };
  }
  if (!gate.enabled) {
    return {
      disabled: true,
      disabledReason:
        "sync-detection: disabled (syncDetection.enabled is false; use --detect-backport for a one-off run)",
      warnings,
      written: [],
    };
  }

  const cap = gate.maxTicketsPerSync ?? DEFAULT_CAP;

  // Diff surface (§5.2) — origin/main...HEAD.
  const surface = readDiffSurface(projectRoot);
  if (surface === null) {
    return {
      disabled: true,
      disabledReason:
        "sync-detection: no diff surface (origin/main not found or not a git repository) — nothing to detect",
      warnings,
      written: [],
    };
  }

  const gitRes = git(["rev-parse", "--git-dir"], projectRoot);
  if (!gitRes.ok) {
    return {
      disabled: true,
      disabledReason: "sync-detection: no git directory — nothing to detect",
      warnings,
      written: [],
    };
  }
  const gitDir = resolve(projectRoot, gitRes.stdout.trim());

  const notes: string[] = [];
  const findings = scanLocalPatches(projectRoot);
  const state = loadState(gitDir);
  if (state.note) notes.push(state.note);
  notes.push(...backfillUids(state.state, findings));

  // Evidence classes, priority order E1 > E2 > E3 > E4; a file reports in the
  // highest-priority class only (per-file exclusivity prevents double-counting).
  const e1Files = new Set(findings.map((f) => f.file));
  const candidates: Candidate[] = [
    ...collectE1(findings, notes),
    ...collectE2(surface, variantName, e1Files),
    ...collectE3(surface, projectRoot, variantName, gate.retiredTokens),
    ...collectE4(surface, variantName, e1Files),
  ];
  const overCap = allocateDispositions(candidates, state.state, cap);
  assignIds(candidates);

  const unresolved = computeUnresolvedTemplateDefects(candidates, state.state);

  const report: DetectBackportReport = {
    schema: SCHEMA_REPORT,
    generated_at: new Date().toISOString(),
    project: variantName,
    variant: variantName,
    gate: { source: gate.source, enabled: true },
    diff_surface: { base: "origin/main", head: "HEAD", changed_files: surface.changedCount },
    candidates,
    counts: { candidates: candidates.length, cap, over_cap: overCap },
    unresolved_template_defects: unresolved,
    notes,
  };

  const written: string[] = [];
  if (!options.dryRun) {
    // Persist state: append within-cap candidates (both types) not already recorded (§5.5).
    const withinCap = candidates.filter((c) => c.disposition === "within-cap");
    const known = new Set(state.state.filed.map((e) => e.dedupe_token));
    let appended = 0;
    for (const c of withinCap) {
      if (known.has(c.dedupe_token)) continue;
      state.state.filed.push({
        dedupe_token: c.dedupe_token,
        candidate_type: c.candidate_type,
        affected_paths: c.affected_paths,
        uid: null,
        filed_at: report.generated_at,
        resolution: null,
      });
      appended += 1;
    }
    if (appended > 0 || state.state.filed.length > 0) {
      state.state.updated_at = report.generated_at;
      writeFileSync(join(gitDir, STATE_FILENAME), `${JSON.stringify(state.state, null, 2)}\n`, "utf-8");
      written.push(join(gitDir, STATE_FILENAME));
    }
    writeFileSync(join(gitDir, REPORT_FILENAME), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    written.push(join(gitDir, REPORT_FILENAME));
  }

  return { disabled: false, warnings, report, written };
}

/** Console summary. Human mode: stdout. `--json` mode: stderr (`toStderr`) so
 * `--json > report` captures pure JSON. Includes the §5.8 warning-only
 * unresolved line. */
export function printSummary(report: DetectBackportReport, gitDirHint: string, toStderr = false): void {
  const filed = report.candidates.filter((c) => c.disposition === "within-cap").length;
  const duplicates = report.candidates.filter((c) => c.disposition === "duplicate-local").length;
  const alreadyFiled = report.candidates.filter((c) => c.disposition === "already-filed").length;
  const lines = [
    `sync-detection: enabled (gate: ${report.gate.source}), changed files: ${report.diff_surface.changed_files}`,
    `sync-detection: ${report.counts.candidates} candidates, ${filed} within cap, ${report.counts.over_cap} over-cap, ` +
      `${duplicates} duplicate-local, ${alreadyFiled} already-filed`,
  ];
  if (report.unresolved_template_defects.count > 0) {
    lines.push(
      `sync-detection: ${report.unresolved_template_defects.count} unresolved template defects (upgrade NOT blocked; ` +
        `report: ${gitDirHint}/${REPORT_FILENAME})`,
    );
  }
  for (const line of lines) (toStderr ? console.error : console.log)(line);
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { project?: string; dryRun: boolean; json: boolean; detectBackport: boolean } {
  let project: string | undefined;
  let dryRun = false;
  let json = false;
  let detectBackport = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--project") {
      project = argv[i + 1];
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--detect-backport") {
      detectBackport = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("usage: bun scripts/detect-backport.ts [--project <path>] [--dry-run] [--json] [--detect-backport]");
      process.exit(0);
    }
  }
  return { project, dryRun, json, detectBackport };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const result = runDetection({
    projectRoot: args.project,
    forceDetect: args.detectBackport,
    dryRun: args.dryRun,
  });
  for (const w of result.warnings) console.error(w);
  if (result.disabled) {
    console.log(result.disabledReason ?? "sync-detection: disabled");
    process.exit(0);
  }
  const report = result.report;
  if (!report) die("detect-backport: no report produced", 1);
  if (args.json) {
    // stdout carries the report verbatim (skill step 3: `--json > report`);
    // the console summary moves to stderr.
    console.log(JSON.stringify(report, null, 2));
    printSummary(report, "$(git rev-parse --git-dir)", true);
  } else {
    printSummary(report, "$(git rev-parse --git-dir)");
    for (const p of result.written) console.log(`sync-detection: wrote ${p}`);
  }
  process.exit(0);
}

if (import.meta.main) {
  try {
    main();
  } catch (err) {
    die(`detect-backport failed: ${err instanceof Error ? err.message : String(err)}`, 1);
  }
}
