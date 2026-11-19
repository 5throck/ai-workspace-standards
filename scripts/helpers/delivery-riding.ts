// @version 1.0.0
/**
 * delivery-riding.ts — pure helpers for delivery-riding records and registry rows.
 *
 * Spec: docs/designs/2026-11-19-delivery-riding-records-design.md (T-20261119-005
 * residual + T-20261119-009). The upgrade delivery engine delivered content without
 * the records that document it: (a) a delivered SKILL.md version bump left the
 * project's docs/lifecycle/skills/<name>.md behind (the record is a WORKSPACE
 * seed — copied once, never updated), and (b) a script delivered from
 * templates/<variant>/scripts/<subdir>/ carries its SCRIPTS.md row only in the
 * variant sub-registry (bare names), which reconcileScriptRegistry's L0/L1 lookup
 * never consulted — so the project main registry missed the row entirely.
 *
 * This module carries the PURE decision + string transforms; scripts/upgrade-project.ts
 * is the only caller that touches the filesystem. Everything here is unit-pinned in
 * tests/unit/delivery-riding.test.ts.
 *
 * R1 (record riding): a delivered SKILL.md reconciles its project record in-pass —
 * marker-bearing records refresh to the template bytes (their own marker declares
 * hand edits overwritable), hand-authored records get surgical Version/Owner line
 * alignment only, an absent record stays with the WORKSPACE seeding channel.
 *
 * R2 (row riding): a delivered main-registry-governed script (outside
 * scripts/<variant>/) resolves its row from L0 → L1 common → the variant
 * sub-registry (unique bare-basename match). Sub-registry-governed paths
 * (scripts/<variant>/…) are governed by the sub-registry file that ships alongside
 * them (verify-scripts walkScripts skips a co-* directory holding its own
 * SCRIPTS.md), so their rows ride inside that file and per-file reconciliation is
 * out of scope. No upstream row anywhere → the delivery fails loud (UNREGISTERED_SCRIPT).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveRecord,
  isGeneratedRecord,
  parseOwnerMap,
  type Frontmatter,
  type OwnerMap,
} from "../generate-skill-lifecycle-records.ts";

// ── R2: variant sub-registry governance scope ────────────────────────────────

/** True when `rel` (project-relative, e.g. `scripts/co-deck/gen-slides-pdf.ts`) is
 *  governed by the variant sub-registry `scripts/<variant>/SCRIPTS.md` that ships
 *  alongside it — i.e. it lives under `scripts/<variant>/`. */
export function isSubRegistryGoverned(rel: string, variant: string): boolean {
  const norm = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  return norm.startsWith(`scripts/${variant}/`);
}

export type SubRegistryLookup =
  | { kind: "unique"; row: string; version: string }
  | { kind: "ambiguous"; rows: string[] }
  | { kind: "absent" };

const TABLE_ROW_RE = /^\| `([^`]+)` \|(.*)(?:\r?)$/;
const DETAIL_HEADER_RE = /^####\s+`/;
const VERSION_CELL_RE = /^\d+\.\d+\.\d+$/;

/** First version-looking cell among the row's cells after the name (main-registry
 *  shape has it in cell 3, the variant sub-registry shape in cell 2 — both match). */
function rowVersionCell(row: string): string {
  const cells = row
    .replace(/^\|/, "")
    .split("|")
    .map((c) => c.trim());
  for (const c of cells.slice(1, 4)) if (VERSION_CELL_RE.test(c)) return c;
  return "";
}

/**
 * Look up `basename` in the variant sub-registry content. Matching is by exact bare
 * basename inside the registry table region (before the first `#### \`` detail
 * header — the same boundary reconcileScriptRegistry's append scan respects).
 * Exactly one match → unique; several → ambiguous (fail-closed upstream); none → absent.
 */
export function variantSubRegistryRowFor(content: string, basename: string): SubRegistryLookup {
  const hits: string[] = [];
  for (const line of content.split("\n")) {
    if (DETAIL_HEADER_RE.test(line)) break; // table region ends at the first detail header
    const m = line.match(TABLE_ROW_RE);
    if (m && m[1] === basename) hits.push(line.replace(/\r$/, ""));
  }
  if (hits.length === 1) return { kind: "unique", row: hits[0], version: rowVersionCell(hits[0]) };
  if (hits.length > 1) return { kind: "ambiguous", rows: hits };
  return { kind: "absent" };
}

/** One 8-column main-registry table row in the deck-precedent shape
 *  (Projects/co-work `deck/ppt-master-adapter.ts`, 2026-11-08/19): script path
 *  project-relative, source `L3`, delivered version, `active`, provenance
 *  description, layer `L3`, pair `—`. Cell-unsafe characters are sanitized so the
 *  row always parses as exactly 8 columns. */
export function buildMainRegistryRow(opts: {
  script: string;
  version: string;
  variant: string;
  subRowDescription?: string;
}): string {
  const version = VERSION_CELL_RE.test(opts.version) ? opts.version : "—";
  const description = `${opts.subRowDescription ? `${sanitizeCell(opts.subRowDescription)} — ` : ""}variant-delivered script (auto-registered at upgrade from templates/${opts.variant}/scripts, spec 2026-11-19-delivery-riding-records-design)`;
  return `| \`${opts.script}\` | L3 | ${version} | active | ${description} | — | L3 | — |`;
}

function sanitizeCell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s+/g, " ").replace(/\r?\n/g, " ").trim();
}

// ── R1: lifecycle-record riding ──────────────────────────────────────────────

export interface RecordMetadataAlignment {
  content: string;
  changed: boolean;
  /** Human-readable notes for the decision-log detail (one per applied edit). */
  notes: string[];
}

const VERSION_LINE_RE = /^(\s*-\s+\*\*Version\*\*:\s*)([^\r\n]*?)(\s*)$/;
const OWNER_LINE_RE = /^(\s*-\s+\*\*Owner\*\*:\s*)([^\r\n]*?)(\s*)$/;

/**
 * Surgical metadata alignment of a hand-authored record (R1 arm 3): rewrite the
 * `- **Version**:` line to the delivered frontmatter version and the `- **Owner**:`
 * line to the delivered frontmatter owner; insert a Version line when the record
 * carries none (after `- **Status**:`, else after `- **Skill**:`, else directly
 * under the `## Metadata` heading; no anchor → skipped with a note). Nothing else
 * changes; the original EOL style is preserved.
 */
export function synchronizeRecordMetadata(
  record: string,
  fm: { version?: string; owner?: string },
): RecordMetadataAlignment {
  const eol = record.includes("\r\n") ? "\r\n" : "\n";
  const lines = record.split(/\r?\n/);
  const notes: string[] = [];
  let changed = false;
  let hasVersionLine = false;

  for (let i = 0; i < lines.length; i++) {
    if (fm.version) {
      const vm = lines[i].match(VERSION_LINE_RE);
      if (vm) {
        hasVersionLine = true;
        const current = vm[2].trim().replace(/^v/i, "");
        const delivered = fm.version.replace(/^v/i, "");
        if (current !== delivered) {
          lines[i] = `${vm[1]}${fmVersionText(fm.version)}${vm[3]}`;
          notes.push(`Version ${vm[2].trim() || "(empty)"} → ${fmVersionText(fm.version)}`);
          changed = true;
        }
      }
    }
    if (fm.owner) {
      const om = lines[i].match(OWNER_LINE_RE);
      if (om && om[2].trim() !== fm.owner.trim()) {
        notes.push(`Owner ${om[2].trim() || "(empty)"} → ${fm.owner.trim()}`);
        lines[i] = `${om[1]}${fm.owner.trim()}${om[3]}`;
        changed = true;
      }
    }
  }

  if (fm.version && !hasVersionLine) {
    const at = insertionIndex(lines);
    if (at >= 0) {
      const indent = lines[at].match(/^(\s*)/)?.[1] ?? "";
      lines.splice(at + 1, 0, `${indent}- **Version**: ${fmVersionText(fm.version)}`);
      notes.push(`Version line inserted (${fmVersionText(fm.version)} — record carried none)`);
      changed = true;
    } else {
      notes.push("Version line NOT inserted — no Metadata/Status/Skill anchor line found");
    }
  }

  return { content: changed ? lines.join(eol) : record, changed, notes };
}

function fmVersionText(version: string): string {
  return version.trim();
}

/** Insertion anchor order: `- **Status**:` line, else `- **Skill**:` line, else the
 *  `## Metadata` heading. -1 when none exists (insertion skipped). */
function insertionIndex(lines: string[]): number {
  const anchors = [/^\s*-\s+\*\*Status\*\*:/, /^\s*-\s+\*\*Skill\*\*:/, /^##\s+Metadata\s*$/];
  for (const re of anchors) {
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) return i;
  }
  return -1;
}

// ── R1: the bump-plan decision ───────────────────────────────────────────────

export type RecordBumpPlan =
  | { action: "noop"; reason: string }
  | { action: "refresh-template"; content: string; changed: boolean }
  | { action: "derive"; content: string; changed: boolean }
  | { action: "derive-failed"; reason: string }
  | { action: "metadata-align"; content: string; changed: boolean; notes: string[] };

/**
 * Decide the in-pass record bump for one delivered skill (R1 arms 1–3).
 *
 * - No existing record → `noop` (the TEMPLATE TREE SYNC WORKSPACE claim owns seeding;
 *   the reconcile never duplicates that channel).
 * - Generated record (GENERATED_MARKER first line) → refresh to the template record
 *   when one resolves; otherwise re-derive from the delivered frontmatter (derive
 *   failure → `derive-failed` with the reason; upstream renders a WARN, no write).
 * - Hand-authored record → `metadata-align` via synchronizeRecordMetadata (arm 3).
 */
export function recordBumpPlan(opts: {
  existingRecord: string | null;
  templateRecord: string | null;
  frontmatter: Frontmatter | null;
  skill: string;
  variant: string;
  ownerMap: OwnerMap;
}): RecordBumpPlan {
  if (opts.existingRecord === null)
    return { action: "noop", reason: "no project record — WORKSPACE seeding owns the first copy" };

  if (isGeneratedRecord(opts.existingRecord)) {
    if (opts.templateRecord !== null) {
      if (opts.templateRecord === opts.existingRecord)
        return { action: "noop", reason: "generated record already at template bytes" };
      return { action: "refresh-template", content: opts.templateRecord, changed: true };
    }
    const res = deriveRecord({
      skill: opts.skill,
      variant: opts.variant,
      frontmatter: opts.frontmatter,
      ownerMap: opts.ownerMap,
    });
    if (!res.ok) return { action: "derive-failed", reason: res.reason };
    if (res.content === opts.existingRecord)
      return { action: "noop", reason: "generated record already at derived bytes" };
    return { action: "derive", content: res.content, changed: true };
  }

  const version = typeof opts.frontmatter?.version === "string" ? opts.frontmatter.version : undefined;
  const owner = typeof opts.frontmatter?.owner === "string" ? opts.frontmatter.owner : undefined;
  const aligned = synchronizeRecordMetadata(opts.existingRecord, { version, owner });
  if (!aligned.changed)
    return { action: "noop", reason: "hand-authored record metadata already matches the delivered SKILL.md" };
  return { action: "metadata-align", content: aligned.content, changed: true, notes: aligned.notes };
}

/** Load the workspace-root skill-owner map (generate-skill-lifecycle-records'
 *  loadOwnerMap is module-private; same file + same parseOwnerMap semantics). */
export function loadSkillOwnerMap(workspaceRoot: string): OwnerMap {
  const p = join(workspaceRoot, "scripts", "data", "skill-owner-map.json");
  return parseOwnerMap(existsSync(p) ? readFileSync(p, "utf-8") : null);
}
