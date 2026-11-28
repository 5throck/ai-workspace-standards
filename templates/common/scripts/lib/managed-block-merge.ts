// @version 1.8.0
// v1.8.0 (2026-11-28, T-20261128-003 — design
//           docs/designs/2026-11-28-origin-l2-drift-design.md §4.2/§4.3):
//           new exported pure seedBaseSections(projectContent,
//           templateBaseContent) — ADDITIVE base-section propagation for
//           MERGE_MANAGED docs. Template base-region H2/H3 sections (outside
//           every managed-marker span) whose exact heading line
//           (whitespace-normalized) is absent from the project copy are
//           inserted: anchored right after the project's copy of the
//           section that precedes them in the template (nearest preceding
//           template heading present in the project — or one planned earlier
//           in the same run, so consecutive additions stack in template
//           order at one shared run base), else appended at the project
//           copy's end. Delete-safe by construction: never removes or
//           reorders project content; insertion points falling inside a
//           project managed-zone span are clamped to after the span; a
//           template section overlapping a template zone span is not seeded
//           (marker-adjacent partial headings stay out of the parse). Pure,
//           idempotent — a second run over seeded output inserts nothing and
//           returns byte-identical content. Positions planned in original
//           coordinates, applied back-to-front. Consumers:
//           upgrade-project.ts v1.128.0 DOCS_MERGE (context-doc claims);
//           unit-pinned by tests/unit/base-section-seed.test.ts. Existing
//           mergeManagedBlocks semantics untouched.
// v1.7.0 (2026-11-17, T-20261116-001 — design
//           docs/designs/2026-11-17-template-lifecycle-batch-design.md §2.2,
//           O-7 default Option A): monotonic Last Updated guard on the two
//           template-wins replace paths (keyed by-key replace and equal-count
//           positional unlabeled replace). templates/common/CLAUDE.md carries
//           its `*Last Updated:` provenance line INSIDE the last COMMON-CLAUDE
//           zone, so the positional replace overwrites a project's newer date
//           with the template's older one — falsifying provenance even though
//           template prose is authoritative. Guard: template prose still wins
//           for every other line, but the `*Last Updated:` line is
//           date-monotonic — when the PROJECT span's date is strictly NEWER,
//           the project's date line wins verbatim inside the replacement and a
//           `RESTAMPED Last Updated (project newer)` log line is emitted;
//           equal dates and missing dates on either side splice nothing. The
//           span-local correction is NOT restamp-classified: v1.6.0's
//           restamps[] semantics are untouched (the date swap never changes a
//           line count, so a guard-resolved divergence never becomes a row).
//           Idempotent — after the merge, a re-run's span is either byte-equal
//           to the template or differs ONLY by the date line the guard
//           restores; the latter is a silent no-op at the call sites, so the
//           re-run reports `merged: false` for that block. Count-mismatch
//           destructive reconcile stays out of scope (it already carries
//           WARNING + snapshot + recovery file).
// v1.6.0 (2026-11-01, addendum
//           docs/designs/2026-10-31-registry-platform-vocabulary-design.md
//           §Addendum): the result carries `restamps[]` — one block-level row
//           per managed block whose PROJECT content diverged from the template
//           and was therefore restamped template-wins (the tier-model-mapping
//           / COMMON-CODEX vocabulary class). This is the decision-log parity
//           half of the PR #1787 precedent (SCHEMA_TEMPLATE_AUTHORITATIVE_KEYS
//           logs TEMPLATE_DELTA INFO rows for schema vocabulary landings): the
//           MERGE pass already restamped these blocks template-wins — keyed
//           blocks by key (v1.4.0), equal-count unlabeled zones positionally —
//           but only on the console, so a fleet convergence wave was invisible
//           in the persisted decision log and its absence read as a code gap.
//           Rows fire ONLY on a real byte divergence (projBlock.matched !==
//           tplBlock.matched); byte-equal keyed replaces keep today's silent
//           MERGED log and no row, making the second pass a zero-row no-op
//           (idempotent). The destructive count-mismatch reconcile is NOT
//           restamp-classified — it already carries WARNING + snapshot +
//           recovery file. Pure data: the caller (upgrade-project.ts
//           mergeWorkspaceManaged) records one TEMPLATE_DELTA (INFO) decision
//           row per entry.
// v1.5.0 (2026-10-28, design
//           docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
//           D2): the destructive unlabeled-block count-mismatch reconcile now
//           consults the instruction-region census. New optional trailing
//           parameter `censusGate` (structurally upgrade-policy's
//           InstructionCensusGate — defined inline here so the pure lib stays
//           import-cycle-free): when the gate says the file carries
//           out-of-zone divergence AND the span about to be replaced carries
//           project-authored content AND no --disposition adopt-template grant
//           covers the path, the reconcile is BLOCKED (skipped, span returned
//           in the new `escalated[]` result field — the engine records the
//           CONFLICT (ERROR) row and names the adjudicated-port procedure).
//           An adapted span under an explicit grant proceeds with its recovery
//           snapshot as today and is counted in `adaptedReplaces` (ADOPT row).
//           In-sync files (gate.divergent === false) and clean spans behave
//           exactly as before. Keyed-block replaces are engine-zone (I1)
//           delivery and are never gated.
// v1.4.0 (2026-09-29): WORKSPACE-MANAGED keys may contain hyphens (`tier-model-mapping`
//           was never matched, so model bumps never reached projects); repeated keys pair
//           by occurrence order (fresh scan per replace) and a missing later occurrence is
//           inserted after its predecessor; common contributes every occurrence of a key
//           the variant lacks. VARIANT-INJECT key matching is unchanged.
// v1.3.0 (spec docs/designs/2026-09-27-hermes-merge-marker-design.md):
//           COMMON-HERMES joins MANAGED_PATTERNS, placed after its COMMON-CODEX
//           platform twin — the HERMES.md counterpart of v1.2.0's COMMON-CODEX
//           addition. Marker pair matches templates/common/HERMES.md:24/:76 and
//           every templates/co-*/HERMES.md exactly (ADR-0093 delivered the file
//           to L0/L1 on 2026-09-27 but existing L2 projects never received it:
//           upgrade-policy already lists HERMES.md in MERGE_MANAGED_FILES, so
//           the MERGE pass claimed it and then skipped it with `INFO: Template
//           has no managed markers` because this table lacked the pattern).
//           COMMON-HERMES zones are key-less — positional path, byte-identical
//           semantics to COMMON-CLAUDE/GEMINI/CODEX; engine code unchanged.
// v1.2.0 (T-20260924-010 — spec docs/designs/2026-09-25-codex-merge-claim-routing-design.md
//           D1): COMMON-CODEX joins MANAGED_PATTERNS, placed after its COMMON-GEMINI
//           platform twin. Marker pair matches L0 CODEX.md:86/:173 and
//           templates/common/CODEX.md:86/:173 exactly. Engine code unchanged —
//           COMMON-CODEX zones are key-less, so they take the existing positional
//           path (byte-identical semantics to COMMON-CLAUDE/GEMINI); the MERGE pass
//           already lists CODEX.md and resolveClaim already routes it MERGE_MANAGED/
//           MERGE (upgrade-policy 1.13.0), so this pattern is the last missing piece
//           of the CODEX.md union-merge.
// v1.1.0 (T-20260917-010): the result carries `snapshots` — the exact project
//           span(s) an unlabeled count-mismatch reconcile replaces — so the
//           caller can persist `<target>.pre-reconcile.bak` before writing the
//           merged content (fail-closed; design
//           docs/designs/2026-09-17-governance-backlog-batch-design.md). The
//           lib stays pure: it returns data, never touches the filesystem.
// v1.0.0 (T-20260916-012): extracted the managed-block merge core from
//           scripts/upgrade-project.ts mergeWorkspaceManaged() into this pure
//           lib (L0-only — it serves only the L0-only upgrader), fixing two
//           compounding defects in the unlabeled-blocks reconciliation phase:
//
//   Defect 1 (over-counting): the project-side occurrence list collected ALL
//   pattern matches — keyed blocks (WORKSPACE-MANAGED/VARIANT-INJECT with a
//   `: key` suffix) INCLUDED — while the template side counted only its
//   key-less blocks. When a project file's only managed blocks were keyed and
//   the template had zero unlabeled blocks, the count check fired and the
//   reconcile branch replaced the whole first-to-last span (keyed blocks
//   included) with an EMPTY join — deleting every keyed block in the file.
//   Real damage (2026-09-16 co-develop upgrade): .gitignore lost its
//   WORKSPACE-MANAGED secrets block (.env/*.pem patterns — the upgrade's own
//   security bootstrap gate failed, the only reason it was caught) and
//   AGENTS.md lost its 43-line graft block. Log shape:
//   `MERGED WORKSPACE-MANAGED:Git ignore patterns...` then
//   `WARNING: ... unlabeled block count mismatch (project has 1, template
//   has 0)` then `RECONCILED WORKSPACE-MANAGED blocks`.
//
//   Defect 2 (stale offsets): the project occurrence offsets were captured
//   BEFORE the keyed-block replacements mutated the content, so even a
//   legitimate reconcile sliced by stale positions (keyed merge/insert
//   changes content length, shifting every later offset).
//
//   Fixes: keyed and unlabeled project occurrences are tracked separately;
//   the unlabeled append/reconcile/positional branches compare and slice
//   ONLY unlabeled occurrences; and unlabeled occurrences are RE-SCANNED
//   from the updated content AFTER the keyed replacements (fresh offsets).
//   When a reconcile replaces an unlabeled span with the template's
//   unlabeled blocks joined ('\n\n'), a template with ZERO unlabeled blocks
//   legitimately removes stale unlabeled project blocks (designed cleanup
//   for truly unlabeled classes) — after the fix it can never touch keyed
//   blocks. COMMON-* zones (COMMON-CLAUDE/GEMINI, COMMON-AGENTS/CONTEXT,
//   DYNAMIC_SKILLS) are always key-less: their counts were never polluted
//   and no keyed phase ever mutates the content inside their iteration, so
//   their behavior is byte-identical to the pre-extraction code.
//
// Import-safe: no I/O at import time; pure string/Map processing only.
// All logging lines are returned verbatim in `log` (MERGED / INSERTED /
// APPENDED / RECONCILED / RESTAMPED / WARNING / INFO) — callers print them
// and tests grep them.

/**
 * Marker patterns supported by the managed-block merge.
 *
 *  WORKSPACE-MANAGED open pattern accepts an optional `: description` suffix.
 *  VARIANT-INJECT uses asymmetric open/close naming (open: VARIANT-INJECT, close: END VARIANT-INJECT).
 *  COMMON-AGENTS, COMMON-CONTEXT and DYNAMIC_SKILLS use asymmetric START/END naming.
 */
export interface ManagedPattern {
  open: RegExp;
  close: string;
  label: string;
}

export const MANAGED_PATTERNS: ManagedPattern[] = [
  { open: /<!-- WORKSPACE-MANAGED(?::[^>]*?)? -->/, close: "<!-- /WORKSPACE-MANAGED -->", label: "WORKSPACE-MANAGED" },
  { open: /<!-- COMMON-CLAUDE:START -->/, close: "<!-- COMMON-CLAUDE:END -->", label: "COMMON-CLAUDE" },
  { open: /<!-- COMMON-GEMINI:START -->/, close: "<!-- COMMON-GEMINI:END -->", label: "COMMON-GEMINI" },
  { open: /<!-- COMMON-CODEX:START -->/, close: "<!-- COMMON-CODEX:END -->", label: "COMMON-CODEX" },
  { open: /<!-- COMMON-HERMES:START -->/, close: "<!-- COMMON-HERMES:END -->", label: "COMMON-HERMES" },
  { open: /<!-- VARIANT-INJECT(?::[^\-]*?)? -->/, close: "<!-- END VARIANT-INJECT -->", label: "VARIANT-INJECT" },
  { open: /<!-- COMMON-AGENTS:START -->/, close: "<!-- COMMON-AGENTS:END -->", label: "COMMON-AGENTS" },
  { open: /<!-- COMMON-CONTEXT:START -->/, close: "<!-- COMMON-CONTEXT:END -->", label: "COMMON-CONTEXT" },
  { open: /<!-- DYNAMIC_SKILLS_START -->/, close: "<!-- DYNAMIC_SKILLS_END -->", label: "DYNAMIC_SKILLS" },
];

/** ManagedBlock with extracted key from `: description` suffix. */
export interface ManagedBlock {
  start: number;
  end: number;
  matched: string;
  key: string; // extracted `: description` suffix, or '' for unlabeled blocks
}

function escapeClose(close: string): string {
  return close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** v1.6.0: line count of a marker-inclusive block text. */
function lineCount(blockText: string): number {
  return blockText.split("\n").length;
}

/** v1.7.0: the `*Last Updated:` provenance line, as carried inside the last
 *  COMMON-CLAUDE zone of templates/common/CLAUDE.md (and any block span that
 *  borrows the convention). Line-anchored so the verbatim splice stays a
 *  single-line swap. */
const LAST_UPDATED_LINE_RE = /^\*Last Updated: \d{4}-\d{2}-\d{2}.*$/m;
const LAST_UPDATED_DATE_RE = /\*Last Updated: (\d{4}-\d{2}-\d{2})/;

/** v1.7.0 (T-20261116-001, design
 *  docs/designs/2026-11-17-template-lifecycle-batch-design.md §2.2 O-7):
 *  monotonic Last Updated guard for the two template-wins replace paths.
 *  Template prose wins for every line EXCEPT `*Last Updated:` — when the
 *  PROJECT span's date is strictly NEWER than the template block's, the
 *  project's date line is spliced into the replacement verbatim (ISO dates,
 *  so lexicographic order is chronological; equal dates change nothing).
 *  Missing dates on either side splice nothing. Pure: returns
 *  `{ replacement, fired, projDate, tplDate }` — `replacement` is the span to
 *  splice (=== tplBlockText unless the guard fired), `fired` is true when the
 *  project's strictly newer date line was spliced in. The RESTAMPED log line
 *  and the idempotency (silent no-op) decision belong to the caller, which
 *  knows whether the guarded replacement still differs from the project span.
 *  Not restamp-classified — the swap never changes a line count, so
 *  restamps[] linesBefore/linesAfter stay exact. Idempotent: post-merge the
 *  span's date is max(both sides), so a re-run either is byte-equal or has
 *  its only difference resolved by the guard (see the call sites). */
function guardLastUpdatedLine(
  projSpanText: string,
  tplBlockText: string,
): { replacement: string; fired: boolean; projDate: string | null; tplDate: string | null } {
  const projDate = projSpanText.match(LAST_UPDATED_DATE_RE)?.[1] ?? null;
  const tplDate = tplBlockText.match(LAST_UPDATED_DATE_RE)?.[1] ?? null;
  if (projDate === null || tplDate === null || projDate <= tplDate) {
    return { replacement: tplBlockText, fired: false, projDate, tplDate };
  }
  const projLine = projSpanText.match(LAST_UPDATED_LINE_RE)?.[0];
  if (projLine === undefined) return { replacement: tplBlockText, fired: false, projDate, tplDate };
  const replacement = tplBlockText.replace(LAST_UPDATED_LINE_RE, projLine);
  if (replacement === tplBlockText) return { replacement: tplBlockText, fired: false, projDate, tplDate };
  return { replacement, fired: true, projDate, tplDate };
}

function patternRegex(pattern: ManagedPattern): RegExp {
  return new RegExp(pattern.open.source + "[\\s\\S]*?" + escapeClose(pattern.close), "g");
}

/** Scan `content` for every match of one pattern, extracting block keys from
 *  the optional `: description` suffix (WORKSPACE-MANAGED and VARIANT-INJECT
 *  only); unlabeled blocks have an empty key and match by position. */
function scanPatternBlocks(content: string, pattern: ManagedPattern): ManagedBlock[] {
  const blocks: ManagedBlock[] = [];
  for (const occ of content.matchAll(patternRegex(pattern))) {
    const matched = occ[0]!;
    let key = "";
    if (pattern.label === "WORKSPACE-MANAGED" || pattern.label === "VARIANT-INJECT") {
      const keyMatch = matched.match(/:\s*([^\s].*?)\s*-->/);
      if (keyMatch) key = keyMatch[1].trim();
    }
    blocks.push({ start: occ.index!, end: occ.index! + matched.length, matched, key });
  }
  return blocks;
}

/**
 * Find all managed blocks in the given content.
 * Returns an array of { pattern, blocks: [ManagedBlock] }.
 * The key is extracted from the optional `: description` suffix for WORKSPACE-MANAGED and VARIANT-INJECT;
 * unlabeled blocks have an empty key and match by position.
 */
export function findManagedBlocks(content: string): Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }> {
  const results: Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }> = [];
  for (const p of MANAGED_PATTERNS) {
    const blocks = scanPatternBlocks(content, p);
    if (blocks.length > 0) results.push({ pattern: p, blocks });
  }
  return results;
}

/**
 * Build a map-of-maps for efficient key-based block lookup.
 */
export function buildBlockKeyMap(
  managed: Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }>,
): Map<string, { pattern: ManagedPattern; blocksByKey: Map<string, ManagedBlock>; blocksByIndex: ManagedBlock[] }> {
  const map = new Map<
    string,
    { pattern: ManagedPattern; blocksByKey: Map<string, ManagedBlock>; blocksByIndex: ManagedBlock[] }
  >();
  for (const { pattern, blocks } of managed) {
    const blocksByKey = new Map<string, ManagedBlock>();
    const blocksByIndex: ManagedBlock[] = [];
    for (const block of blocks) {
      blocksByKey.set(block.key, block);
      blocksByIndex.push(block);
    }
    map.set(pattern.label, { pattern, blocksByKey, blocksByIndex });
  }
  return map;
}

/**
 * Build the effective template block set for a merge: the per-key union of
 * the variant template's blocks with the common template's (variant wins on
 * key collision; common-only labels/keys are added). `commonContent` is null
 * when no common counterpart exists.
 */
export function buildMergedTemplateBlocks(
  templateContent: string,
  commonContent: string | null,
): Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }> {
  const tplManaged = findManagedBlocks(templateContent);

  // Per-key union: build a union of template blocks (variant ∪ common, variant wins on key collision)
  const tplBlocksByKey = buildBlockKeyMap(tplManaged);
  if (commonContent !== null) {
    const commonManaged = findManagedBlocks(commonContent);
    const commonBlocksByKey = buildBlockKeyMap(commonManaged);
    for (const { pattern, blocks: commonBlocks } of commonManaged) {
      if (!tplBlocksByKey.has(pattern.label)) {
        tplBlocksByKey.set(pattern.label, { pattern, blocksByKey: new Map(), blocksByIndex: [] });
      }
      const entry = tplBlocksByKey.get(pattern.label)!;
      // Keys the variant already defines win; common contributes every
      // occurrence (repeated keys included) of the keys it alone defines.
      const variantKeys = new Set(entry.blocksByKey.keys());
      for (const block of commonBlocks) {
        if (!variantKeys.has(block.key)) {
          entry.blocksByKey.set(block.key, block);
          entry.blocksByIndex.push(block);
        }
      }
    }
  }

  // Flatten the per-key map back into a managed array for processing
  const mergedManaged: Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }> = [];
  for (const entry of tplBlocksByKey.values()) {
    mergedManaged.push({ pattern: entry.pattern, blocks: entry.blocksByIndex });
  }
  return mergedManaged;
}

/**
 * Find insertion position for a keyed block that has no project counterpart.
 * Preference order: (a) immediately after the heading whose text names the key,
 * (b) after the project's last block of the same label, (c) end of file.
 */
export function findInsertionPosition(content: string, rel: string, key: string, pattern: ManagedPattern): number {
  // Try to find a heading with the key text and insert after it.
  // Escape the key: block keys come from arbitrary `: description` suffixes and
  // may contain RegExp metacharacters — unescaped interpolation would throw
  // mid-upgrade or silently mis-anchor the insertion (T-20260917-review).
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRegex = new RegExp(`^#+\\s+.*${escapedKey}.*$`, "m");
  const headingMatch = content.match(headingRegex);
  if (headingMatch) {
    const headingEnd = headingMatch.index! + headingMatch[0].length;
    return headingEnd;
  }

  // Fallback: find the last block of the same label and insert after it
  const regex = patternRegex(pattern);
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null = regex.exec(content);
  while (match !== null) {
    lastMatch = match;
    match = regex.exec(content);
  }
  if (lastMatch) {
    return lastMatch.index! + lastMatch[0].length;
  }

  // Ultimate fallback: end of file
  return content.length;
}

/** v1.6.0: one block-level restamp row — a managed block whose project content
 *  diverged from the template and was restamped template-wins. `key` is ''
 *  for unlabeled (COMMON-*) zones. Line counts are of the full marker-inclusive
 *  block text. Emitted for the keyed by-key replace and the equal-count
 *  positional unlabeled replace ONLY when the two sides actually differ; the
 *  count-mismatch reconcile is not restamp-classified (it already carries
 *  WARNING + snapshot + recovery file). */
export interface ManagedBlockRestamp {
  label: string;
  key: string;
  linesBefore: number;
  linesAfter: number;
}

export interface ManagedBlockMergeResult {
  /** The merged content (=== projectContent when nothing changed). */
  content: string;
  /** True when the merge modified the content OR the no-project-markers
   *  append branch fired (both warrant a file write in apply mode). */
  merged: boolean;
  /** Verbatim log lines (4-space indented, `[DRY RUN] ` tagged when dryRun). */
  log: string[];
  /** T-20261017-010 / T-20260917-010: exact project span(s) replaced by an
   *  unlabeled-block reconcile, in merge order. The caller must persist each
   *  to `<target>.pre-reconcile.bak` BEFORE writing the merged content (and
   *  abort fail-closed when the write fails); dry-run callers skip writing.
   *  Empty unless a count-mismatch reconcile fired. */
  snapshots: { rel: string; content: string }[];
  /** v1.5.0 (D2): spans the census BLOCKED — an adapted out-of-zone span the
   *  count-mismatch reconcile would have replaced without an explicit
   *  --disposition adopt-template grant. The engine records the CONFLICT
   *  (ERROR) decision for each and the span is left untouched. */
  escalated: { rel: string; content: string }[];
  /** v1.5.0 (D2): count of adapted-span reconciles that PROCEEDED under an
   *  explicit --disposition adopt-template grant (snapshot + replace as
   *  today; the engine records the ADOPT row). */
  adaptedReplaces: number;
  /** v1.6.0: block-level restamp rows (one per genuinely diverged block the
   *  merge restamped template-wins) — the caller records one TEMPLATE_DELTA
   *  (INFO) decision row per entry. Empty when every block was byte-equal. */
  restamps: ManagedBlockRestamp[];
}

/** v1.5.0 (D2): the instruction-region census gate. Structurally
 *  upgrade-policy's InstructionCensusGate (declared inline so this pure lib
 *  stays free of an import cycle); the engine builds it from
 *  censusInstructionRegions + spanCarriesProjectAuthoredLines + the
 *  --disposition flag. */
export interface ManagedBlockCensusGate {
  /** The file's census found out-of-zone divergence — false closes the gate
   *  entirely (in-sync files keep today's reconcile behavior). */
  divergent: boolean;
  /** The span about to be replaced carries project-authored content. */
  isSpanAdapted: (spanContent: string) => boolean;
  /** --disposition adopt-template[=glob] covers this rel. */
  dispositionGranted: boolean;
}

/**
 * Merge the template's managed blocks into the project content.
 * Pure: no filesystem access. `dryRun` only affects the `[DRY RUN] ` log tag,
 * never the returned content.
 *
 * Strategy: for keyed blocks (WORKSPACE-MANAGED, VARIANT-INJECT), match by key.
 * For unlabeled blocks, match positionally (backward-compatible with existing
 * behavior). Keyed blocks with no project counterpart are inserted.
 */
export function mergeManagedBlocks(
  projectContent: string,
  templateContent: string,
  commonContent: string | null,
  rel: string,
  dryRun: boolean,
  censusGate?: ManagedBlockCensusGate,
): ManagedBlockMergeResult {
  const dryTag = dryRun ? "[DRY RUN] " : "";
  const log: string[] = [];
  const snapshots: { rel: string; content: string }[] = [];
  const escalated: { rel: string; content: string }[] = [];
  const restamps: ManagedBlockRestamp[] = [];
  let adaptedReplaces = 0;
  const mergedManaged = buildMergedTemplateBlocks(templateContent, commonContent);

  if (mergedManaged.length === 0) {
    log.push(`    INFO: Template has no managed markers — skipping ${rel}`);
    return { content: projectContent, merged: false, log, snapshots, escalated, adaptedReplaces, restamps };
  }

  let updated = projectContent;
  let merged = false;

  for (const { pattern, blocks: tplBlocks } of mergedManaged) {
    // Scan the project's blocks for this label (pre-keyed-phase offsets).
    const projBlocksAll = scanPatternBlocks(updated, pattern);

    // T-20260916-012 fix 1: count ONLY unlabeled project occurrences for the
    // unlabeled reconciliation. Keyed blocks belong to the keyed phase below
    // and must never influence — or be consumed by — the positional phase.
    const projUnlabeledCount = projBlocksAll.filter((b) => !b.key).length;

    // Separate keyed from unlabeled blocks
    const keyedTplBlocks = tplBlocks.filter((b) => b.key);
    const unlabeledTplBlocks = tplBlocks.filter((b) => !b.key);

    // Process keyed blocks: match by key, insert if not found. A key may
    // repeat (AGENTS.md carries two `tier-model-mapping` blocks), so the Nth
    // template occurrence pairs with the Nth project occurrence, and the
    // project is re-scanned each time so offsets never go stale.
    const keySeen = new Map<string, number>();
    for (const tplBlock of keyedTplBlocks) {
      const nth = keySeen.get(tplBlock.key) ?? 0;
      keySeen.set(tplBlock.key, nth + 1);
      const projBlock = scanPatternBlocks(updated, pattern).filter((b) => b.key === tplBlock.key)[nth];
      if (projBlock) {
        // Found by key — replace it
        // v1.7.0: template-wins, except the `*Last Updated:` line is
        // date-monotonic (project's strictly newer date wins verbatim).
        const guard = guardLastUpdatedLine(projBlock.matched, tplBlock.matched);
        if (guard.replacement !== projBlock.matched) {
          if (projBlock.matched !== tplBlock.matched) {
            restamps.push({
              label: pattern.label,
              key: tplBlock.key,
              linesBefore: lineCount(projBlock.matched),
              linesAfter: lineCount(guard.replacement),
            });
          }
          if (guard.fired) {
            log.push(
              `    ${dryTag}RESTAMPED Last Updated (project newer) ${guard.projDate} > ${guard.tplDate} in: ${rel} (${pattern.label}:${tplBlock.key})`,
            );
          }
          updated = updated.slice(0, projBlock.start) + guard.replacement + updated.slice(projBlock.end);
          merged = true;
          log.push(`    ${dryTag}MERGED ${pattern.label}:${tplBlock.key} in: ${rel}`);
        } else if (projBlock.matched === tplBlock.matched) {
          // Byte-equal: v1.6.0's silent MERGED log and no row — the splice is
          // a no-op and the behavior is kept byte-for-byte.
          updated = updated.slice(0, projBlock.start) + tplBlock.matched + updated.slice(projBlock.end);
          merged = true;
          log.push(`    ${dryTag}MERGED ${pattern.label}:${tplBlock.key} in: ${rel}`);
        }
        // else: the ONLY byte difference was the `*Last Updated:` date line
        // and the guard restored the project's strictly newer one — the span
        // is already in its post-merge state. Silent no-op (no splice, no
        // row, no log): the idempotent re-run over merged content reports
        // `merged: false` (v1.7.0 design §2.3 obligation).
      } else {
        // Not found by key — insert with insertion anchor logic
        // A repeated key's later occurrence goes right after its predecessor.
        const prevSameKey =
          nth > 0 ? scanPatternBlocks(updated, pattern).filter((b) => b.key === tplBlock.key)[nth - 1] : undefined;
        const insertionPos = prevSameKey ? prevSameKey.end : findInsertionPosition(updated, rel, tplBlock.key, pattern);
        updated = updated.slice(0, insertionPos) + "\n\n" + tplBlock.matched + "\n" + updated.slice(insertionPos);
        merged = true;
        log.push(`    ${dryTag}INSERTED ${pattern.label}:${tplBlock.key} in: ${rel}`);
      }
    }

    // Process unlabeled blocks: use positional matching for backward compatibility
    if (projUnlabeledCount === 0) {
      // No matching block in project — append all unlabeled template blocks
      for (const tplBlock of unlabeledTplBlocks) {
        updated = updated + "\n\n" + tplBlock.matched + "\n";
        merged = true;
        log.push(`    ${dryTag}APPENDED ${pattern.label} block to: ${rel}`);
      }
    } else if (projUnlabeledCount !== unlabeledTplBlocks.length) {
      // Counts diverged for unlabeled blocks — warn and replace all.
      // T-20260916-012 fix 2: re-scan AFTER the keyed replacements above —
      // keyed merge/insert changes content length, so pre-keyed offsets are
      // stale. The fresh scan also guarantees (via fix 1) that the sliced
      // span contains only unlabeled blocks; a template with zero unlabeled
      // blocks legitimately removes the project's stale unlabeled span.
      const fresh = scanPatternBlocks(updated, pattern).filter((b) => !b.key);
      if (fresh.length > 0) {
        const first = fresh[0];
        const last = fresh[fresh.length - 1];
        const spanContent = updated.slice(first.start, last.end);
        // v1.5.0 (design D2 §4.2): the census gates the destructive reconcile
        // when the replaced span carries project-authored out-of-zone content
        // and no --disposition adopt-template grant covers the path.
        const adapted = Boolean(censusGate && censusGate.divergent && censusGate.isSpanAdapted(spanContent));
        if (adapted && censusGate && !censusGate.dispositionGranted) {
          log.push(
            `    ${dryTag}RECONCILE BLOCKED (adapted out-of-zone span): ${rel} — the instruction-region census found project-authored content in the replaced span; delivery SKIPPED (CONFLICT — ERROR, project copy preserved)`,
          );
          log.push(
            "      proceed with --disposition adopt-template[=glob], or port the content template-side per the adjudicated-port procedure (sync-overwrite-policy design §6): land it inside a managed zone or skeleton-registry section with a version bump",
          );
          escalated.push({ rel, content: spanContent });
          continue;
        }
        log.push(
          `    WARNING: ${pattern.label} unlabeled block count mismatch in ${rel} (project has ${projUnlabeledCount}, template has ${unlabeledTplBlocks.length}) — replacing all project blocks with the template sequence (this may cause prose loss if prose exists between project blocks)`,
        );
        // T-20260917-010: capture the exact replaced span so the caller can
        // persist a recovery snapshot before applying this destructive
        // replace. Pure data here — the fs write lives in upgrade-project.
        snapshots.push({ rel, content: spanContent });
        if (adapted) adaptedReplaces++;
        updated =
          updated.slice(0, first.start) +
          unlabeledTplBlocks.map((b) => b.matched).join("\n\n") +
          updated.slice(last.end);
        merged = true;
        log.push(
          `    ${dryTag}RECONCILED ${pattern.label} blocks in: ${rel}${adapted ? " (adapted span — delivered via --disposition adopt-template)" : ""}`,
        );
      }
    } else {
      // Counts match — replace positionally, back-to-front so earlier offsets stay valid.
      // Fresh scan (fix 2): offsets must reflect the post-keyed-phase content.
      const fresh = scanPatternBlocks(updated, pattern).filter((b) => !b.key);
      for (let i = unlabeledTplBlocks.length - 1; i >= 0; i--) {
        const occ = fresh[i];
        if (!occ) continue;
        const tplBlock = unlabeledTplBlocks[i];
        // v1.7.0: template-wins, except the `*Last Updated:` line is
        // date-monotonic (project's strictly newer date wins verbatim).
        const guard = guardLastUpdatedLine(occ.matched, tplBlock.matched);
        if (guard.replacement !== occ.matched) {
          if (occ.matched !== tplBlock.matched) {
            restamps.push({
              label: pattern.label,
              key: "",
              linesBefore: lineCount(occ.matched),
              linesAfter: lineCount(guard.replacement),
            });
          }
          if (guard.fired) {
            log.push(
              `    ${dryTag}RESTAMPED Last Updated (project newer) ${guard.projDate} > ${guard.tplDate} in: ${rel} (${pattern.label})`,
            );
          }
          updated = updated.slice(0, occ.start) + guard.replacement + updated.slice(occ.end);
          merged = true;
          log.push(`    ${dryTag}MERGED ${pattern.label} block in: ${rel}`);
        } else if (occ.matched === tplBlock.matched) {
          // Byte-equal: v1.6.0's MERGED log and no row — the splice is a
          // no-op and the behavior is kept byte-for-byte.
          updated = updated.slice(0, occ.start) + tplBlock.matched + updated.slice(occ.end);
          merged = true;
          log.push(`    ${dryTag}MERGED ${pattern.label} block in: ${rel}`);
        }
        // else: the ONLY byte difference was the `*Last Updated:` date line
        // and the guard restored the project's strictly newer one — silent
        // no-op, so the idempotent re-run over merged content reports
        // `merged: false` (v1.7.0 design §2.3 obligation).
      }
    }
  }

  if (findManagedBlocks(projectContent).length === 0 && !merged) {
    log.push(`    WARNING: ${rel} has no managed markers in project.`);
    log.push("             Appending template managed blocks at end of file.");
    merged = true;
    log.push(`    ${dryTag}APPENDED managed blocks to: ${rel}`);
  }

  return { content: updated, merged, log, snapshots, escalated, adaptedReplaces, restamps };
}

// ─── base-section seeding (v1.8.0, T-20261128-003 — design
//     docs/designs/2026-11-28-origin-l2-drift-design.md §4.2) ─────────────────
// ADDITIVE base-section propagation for MERGE_MANAGED docs: template
// base-region section additions were dead letters for existing instances
// (mergeManagedBlocks touches only managed zones), so `## Computational
// Integrity` reached 10/16 variant templates but 1/18 project instances. The
// seeder parses the TEMPLATE's H2/H3 sections OUTSIDE every managed-marker
// span and inserts each section whose exact heading line (whitespace-
// normalized) is absent from the project copy — delete-safe by construction:
// sections absent from the template stay untouched, sections present in both
// are left to the existing zone machinery, and project-authored text is never
// deleted or rewritten. Anchored insertion: a missing section lands right
// after the end of the project's copy of the section that precedes it in the
// template (the nearest preceding template heading present in the project —
// or a section planned earlier in this same run, so consecutive additions
// stack in template order); without any anchor it is appended at the project
// copy's end. An insertion point falling inside a project managed-zone span
// is clamped to after that span (never inside a zone), and a template
// section that itself overlaps a template zone span is not seeded
// (marker-adjacent partial headings stay out of the parse). All positions
// are planned in the ORIGINAL project coordinates and applied back-to-front
// — no offset drift, pure, idempotent (a second run over seeded output
// inserts nothing and returns byte-identical content).

/** One parsed markdown section: normalized heading line + body span. */
interface BaseSection {
  heading: string;
  /** Heading line index within the provided line array. */
  lineIndex: number;
  /** Exclusive end line: index of the next heading, or lines.length. */
  endLine: number;
}

/** Seedable section headings: H2/H3 only (design §4.2 — `^## `/`^### `;
 *  H1 title lines are document identity, never seeded). */
const HEADING_LINE_RE = /^#{2,3}[ \t]+\S/;
const SECTION_END_HEADING_RE = /^#{1,6}[ \t]+\S/;

function normalizeHeading(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

/** Line index containing byte `offset`. */
function lineIndexOf(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length - 1;
}

/** Parse H2/H3 sections over a line array; `excluded` marks line indices that
 *  sit inside a managed-zone span — a section whose span intersects one is
 *  skipped, and a heading inside a zone never starts a section. */
function parseBaseSections(lines: string[], excluded: Set<number>): BaseSection[] {
  const sections: BaseSection[] = [];
  let current: BaseSection | null = null;
  let crossedZone = false;
  for (let i = 0; i < lines.length; i++) {
    const isHeading = HEADING_LINE_RE.test(lines[i] ?? "");
    if (current && (isHeading || i === lines.length - 1)) {
      const end = isHeading ? i : i + 1;
      if (!crossedZone) sections.push({ ...current, endLine: end });
      current = null;
      crossedZone = false;
    }
    if (excluded.has(i) && current !== null) crossedZone = true;
    if (isHeading && current === null) {
      current = { heading: normalizeHeading(lines[i]!), lineIndex: i, endLine: lines.length };
    }
  }
  return sections;
}

/** Line spans [start, end) of every managed-zone match in `content` (all
 *  MANAGED_PATTERNS), covering the open-marker line through the close-marker
 *  line inclusive. Used to exclude template sections overlapping zones and to
 *  clamp project insertion points. */
function managedLineSpans(content: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  for (const pattern of MANAGED_PATTERNS) {
    for (const occ of content.matchAll(patternRegex(pattern))) {
      const at = occ.index ?? 0;
      spans.push({ start: lineIndexOf(content, at), end: lineIndexOf(content, at + occ[0]!.length - 1) + 1 });
    }
  }
  return spans;
}

function spanEndAt(spans: Array<{ start: number; end: number }>, line: number): number {
  for (const s of spans) if (line >= s.start && line < s.end) return s.end;
  return -1;
}

export interface BaseSectionSeed {
  /** The exact normalized heading line that was inserted. */
  heading: string;
  /** The anchor heading the section was inserted after, or null when appended
   *  at the project copy's end (no anchor present). */
  anchor: string | null;
}

export interface SeedBaseSectionsResult {
  content: string;
  /** One entry per insertion, in template order. */
  seeded: BaseSectionSeed[];
}

/** Pure additive seeder (T-20261128-003 §4.2): insert each template
 *  base-region H2/H3 section whose exact heading line has no match in the
 *  project copy. Never deletes or reorders project content; idempotent. */
export function seedBaseSections(projectContent: string, templateContent: string): SeedBaseSectionsResult {
  const projLines = projectContent.split("\n");
  const tplLines = templateContent.split("\n");

  const tplSpans = managedLineSpans(templateContent);
  const projSpans = managedLineSpans(projectContent);
  const tplExcluded = new Set<number>();
  for (const s of tplSpans) for (let i = s.start; i < s.end; i++) tplExcluded.add(i);

  const tplSections = parseBaseSections(tplLines, tplExcluded);
  if (tplSections.length === 0) return { content: projectContent, seeded: [] };

  const projHeadingAt = new Map<string, number>();
  for (let i = 0; i < projLines.length; i++) {
    if (SECTION_END_HEADING_RE.test(projLines[i] ?? "")) {
      const norm = normalizeHeading(projLines[i]!);
      if (!projHeadingAt.has(norm)) projHeadingAt.set(norm, i);
    }
  }

  // Project section end for an anchor: the next heading line (any level) after
  // the anchor heading, else EOF — all original coordinates.
  const sectionEndInProject = (anchorLine: number): number => {
    for (let i = anchorLine + 1; i < projLines.length; i++) {
      if (SECTION_END_HEADING_RE.test(projLines[i] ?? "")) return i;
    }
    return projLines.length;
  };

  interface PlannedInsertion {
    atLine: number;
    lines: string[];
    seed: BaseSectionSeed;
  }

  // Plan in ORIGINAL coordinates; apply back-to-front at the end. Consecutive
  // template sections missing from the project stack at ONE shared run base
  // (the first section's anchored position) — inserting each "after the
  // previous planned section" would overshoot across project content that
  // sits between the base and later sections. Same-position buckets are
  // applied in reverse so the final order matches template order.
  //
  // The ANCHOR CHAIN walks every template H2/H3 heading OUTSIDE zone spans in
  // order — independently of seed eligibility. A section whose body runs up
  // against a zone-open marker (marker-adjacent, not seedable per §4.4) still
  // anchors later sections when the project carries it; only zone-INTERIOR
  // headings (the template's own copy of a zone) are invisible to the chain.
  const sectionsByHeading = new Map(tplSections.map((s) => [s.heading, s]));
  const plan: PlannedInsertion[] = [];
  let anchorLine = -1; // original project line of a PRESENT anchor heading
  let anchorIsPlanned = false; // anchor heading was itself inserted by this run
  let anchorHeading: string | null = null;
  let runBase = -1; // insertion line of the current planned run

  for (let i = 0; i < tplLines.length; i++) {
    if (!HEADING_LINE_RE.test(tplLines[i] ?? "") || tplExcluded.has(i)) continue;
    const heading = normalizeHeading(tplLines[i]!);
    const presentLine = projHeadingAt.get(heading);
    if (presentLine !== undefined) {
      anchorLine = presentLine;
      anchorIsPlanned = false;
      anchorHeading = heading;
      continue;
    }
    const section = sectionsByHeading.get(heading);
    if (!section) continue; // marker-adjacent (zone-crossing) — not seedable

    const sectionLines = tplLines.slice(section.lineIndex, section.endLine);
    while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1]!.trim() === "") sectionLines.pop();
    if (sectionLines.length === 0) continue;

    let atLine: number;
    let needSep: boolean; // blank separator line before the inserted section
    let anchor: string | null;
    if (anchorHeading === null) {
      // no anchor at all → append at the end
      atLine = projLines.length;
      needSep = (projLines[projLines.length - 1] ?? "").trim() !== "";
      anchor = null;
      runBase = atLine;
    } else if (anchorIsPlanned) {
      // stack at the shared run base (see the comment above); items after the
      // first always get a separator (the preceding planned section's trimmed
      // last line is non-blank by construction)
      atLine = runBase;
      needSep = true;
      anchor = anchorHeading;
    } else {
      atLine = sectionEndInProject(anchorLine);
      // zone clamp: never land inside a project managed-zone span
      for (;;) {
        const spanEnd = spanEndAt(projSpans, atLine);
        if (spanEnd < 0) break;
        atLine = spanEnd;
      }
      needSep = atLine > 0 && (projLines[atLine - 1] ?? "").trim() !== "";
      anchor = anchorHeading;
      runBase = atLine;
    }
    const sep = needSep ? [""] : [];
    plan.push({ atLine, lines: [...sep, ...sectionLines], seed: { heading, anchor } });
    // the planned heading becomes the anchor for following template sections
    anchorIsPlanned = true;
    anchorHeading = heading;
  }

  const byLine = new Map<number, PlannedInsertion[]>();
  for (const p of plan) {
    const bucket = byLine.get(p.atLine) ?? [];
    bucket.push(p);
    byLine.set(p.atLine, bucket);
  }
  const lines = [...projLines];
  const positions = [...byLine.keys()].sort((a, b) => b - a);
  for (const pos of positions) {
    const bucket = byLine.get(pos)!.slice().reverse();
    for (const item of bucket) lines.splice(pos, 0, ...item.lines);
  }
  // report in template (plan) order — application order is position-sorted
  return { content: lines.join("\n"), seeded: plan.map((p) => p.seed) };
}
