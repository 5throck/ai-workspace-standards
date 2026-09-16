// @version 1.1.0
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
// APPENDED / RECONCILED / WARNING / INFO) — callers print them and tests
// grep them.

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
  { open: /<!-- WORKSPACE-MANAGED(?::[^\-]*?)? -->/, close: '<!-- /WORKSPACE-MANAGED -->', label: 'WORKSPACE-MANAGED' },
  { open: /<!-- COMMON-CLAUDE:START -->/, close: '<!-- COMMON-CLAUDE:END -->', label: 'COMMON-CLAUDE' },
  { open: /<!-- COMMON-GEMINI:START -->/, close: '<!-- COMMON-GEMINI:END -->', label: 'COMMON-GEMINI' },
  { open: /<!-- VARIANT-INJECT(?::[^\-]*?)? -->/, close: '<!-- END VARIANT-INJECT -->', label: 'VARIANT-INJECT' },
  { open: /<!-- COMMON-AGENTS:START -->/, close: '<!-- COMMON-AGENTS:END -->', label: 'COMMON-AGENTS' },
  { open: /<!-- COMMON-CONTEXT:START -->/, close: '<!-- COMMON-CONTEXT:END -->', label: 'COMMON-CONTEXT' },
  { open: /<!-- DYNAMIC_SKILLS_START -->/, close: '<!-- DYNAMIC_SKILLS_END -->', label: 'DYNAMIC_SKILLS' },
];

/** ManagedBlock with extracted key from `: description` suffix. */
export interface ManagedBlock {
  start: number;
  end: number;
  matched: string;
  key: string;  // extracted `: description` suffix, or '' for unlabeled blocks
}

function escapeClose(close: string): string {
  return close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternRegex(pattern: ManagedPattern): RegExp {
  return new RegExp(pattern.open.source + '[\\s\\S]*?' + escapeClose(pattern.close), 'g');
}

/** Scan `content` for every match of one pattern, extracting block keys from
 *  the optional `: description` suffix (WORKSPACE-MANAGED and VARIANT-INJECT
 *  only); unlabeled blocks have an empty key and match by position. */
function scanPatternBlocks(content: string, pattern: ManagedPattern): ManagedBlock[] {
  const blocks: ManagedBlock[] = [];
  for (const occ of content.matchAll(patternRegex(pattern))) {
    const matched = occ[0]!;
    let key = '';
    if (pattern.label === 'WORKSPACE-MANAGED' || pattern.label === 'VARIANT-INJECT') {
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
export function buildBlockKeyMap(managed: Array<{ pattern: ManagedPattern; blocks: ManagedBlock[] }>): Map<string, { pattern: ManagedPattern; blocksByKey: Map<string, ManagedBlock>; blocksByIndex: ManagedBlock[] }> {
  const map = new Map<string, { pattern: ManagedPattern; blocksByKey: Map<string, ManagedBlock>; blocksByIndex: ManagedBlock[] }>();
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
      for (const block of commonBlocks) {
        if (!entry.blocksByKey.has(block.key)) {
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
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^#+\\s+.*${escapedKey}.*$`, 'm');
  const headingMatch = content.match(headingRegex);
  if (headingMatch) {
    const headingEnd = headingMatch.index! + headingMatch[0].length;
    return headingEnd;
  }

  // Fallback: find the last block of the same label and insert after it
  const regex = patternRegex(pattern);
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    lastMatch = match;
  }
  if (lastMatch) {
    return lastMatch.index! + lastMatch[0].length;
  }

  // Ultimate fallback: end of file
  return content.length;
}

export interface ManagedBlockMergeResult {
  /** The merged content (=== projectContent when nothing changed). */
  content: string;
  /** True when the merge modified the content OR the no-project-markers
   *  append branch fired (both warrant a file write in apply mode). */
  merged: boolean;
  /** Verbatim log lines (4-space indented, `[DRY RUN] ` tagged when dryRun). */
  log: string[];
  /** T-20260917-010: exact project span(s) replaced by an unlabeled-block
   *  reconcile, in merge order. The caller must persist each to
   *  `<target>.pre-reconcile.bak` BEFORE writing the merged content (and
   *  abort fail-closed when the write fails); dry-run callers skip writing.
   *  Empty unless a count-mismatch reconcile fired. */
  snapshots: { rel: string; content: string }[];
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
): ManagedBlockMergeResult {
  const dryTag = dryRun ? '[DRY RUN] ' : '';
  const log: string[] = [];
  const snapshots: { rel: string; content: string }[] = [];
  const mergedManaged = buildMergedTemplateBlocks(templateContent, commonContent);

  if (mergedManaged.length === 0) {
    log.push(`    INFO: Template has no managed markers — skipping ${rel}`);
    return { content: projectContent, merged: false, log, snapshots };
  }

  let updated = projectContent;
  let merged = false;

  for (const { pattern, blocks: tplBlocks } of mergedManaged) {
    // Scan the project's blocks for this label (pre-keyed-phase offsets).
    const projBlocksAll = scanPatternBlocks(updated, pattern);

    // Build map of project blocks by key/index
    const projBlocksByKey = new Map<string, ManagedBlock>();
    for (const block of projBlocksAll) {
      projBlocksByKey.set(block.key, block);
    }

    // T-20260916-012 fix 1: count ONLY unlabeled project occurrences for the
    // unlabeled reconciliation. Keyed blocks belong to the keyed phase below
    // and must never influence — or be consumed by — the positional phase.
    const projUnlabeledCount = projBlocksAll.filter((b) => !b.key).length;

    // Separate keyed from unlabeled blocks
    const keyedTplBlocks = tplBlocks.filter(b => b.key);
    const unlabeledTplBlocks = tplBlocks.filter(b => !b.key);

    // Process keyed blocks: match by key, insert if not found
    for (const tplBlock of keyedTplBlocks) {
      const projBlock = projBlocksByKey.get(tplBlock.key);
      if (projBlock) {
        // Found by key — replace it
        updated = updated.slice(0, projBlock.start) + tplBlock.matched + updated.slice(projBlock.end);
        merged = true;
        log.push(`    ${dryTag}MERGED ${pattern.label}:${tplBlock.key} in: ${rel}`);
      } else {
        // Not found by key — insert with insertion anchor logic
        const insertionPos = findInsertionPosition(updated, rel, tplBlock.key, pattern);
        updated = updated.slice(0, insertionPos) + '\n\n' + tplBlock.matched + '\n' + updated.slice(insertionPos);
        merged = true;
        log.push(`    ${dryTag}INSERTED ${pattern.label}:${tplBlock.key} in: ${rel}`);
      }
    }

    // Process unlabeled blocks: use positional matching for backward compatibility
    if (projUnlabeledCount === 0) {
      // No matching block in project — append all unlabeled template blocks
      for (const tplBlock of unlabeledTplBlocks) {
        updated = updated + '\n\n' + tplBlock.matched + '\n';
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
        log.push(`    WARNING: ${pattern.label} unlabeled block count mismatch in ${rel} (project has ${projUnlabeledCount}, template has ${unlabeledTplBlocks.length}) — replacing all project blocks with the template sequence (this may cause prose loss if prose exists between project blocks)`);
        const first = fresh[0];
        const last = fresh[fresh.length - 1];
        // T-20260917-010: capture the exact replaced span so the caller can
        // persist a recovery snapshot before applying this destructive
        // replace. Pure data here — the fs write lives in upgrade-project.
        snapshots.push({ rel, content: updated.slice(first.start, last.end) });
        updated = updated.slice(0, first.start) + unlabeledTplBlocks.map((b) => b.matched).join('\n\n') + updated.slice(last.end);
        merged = true;
        log.push(`    ${dryTag}RECONCILED ${pattern.label} blocks in: ${rel}`);
      }
    } else {
      // Counts match — replace positionally, back-to-front so earlier offsets stay valid.
      // Fresh scan (fix 2): offsets must reflect the post-keyed-phase content.
      const fresh = scanPatternBlocks(updated, pattern).filter((b) => !b.key);
      for (let i = unlabeledTplBlocks.length - 1; i >= 0; i--) {
        const occ = fresh[i];
        if (!occ) continue;
        const tplBlock = unlabeledTplBlocks[i];
        updated = updated.slice(0, occ.start) + tplBlock.matched + updated.slice(occ.end);
        merged = true;
        log.push(`    ${dryTag}MERGED ${pattern.label} block in: ${rel}`);
      }
    }
  }

  if (findManagedBlocks(projectContent).length === 0 && !merged) {
    log.push(`    WARNING: ${rel} has no managed markers in project.`);
    log.push('             Appending template managed blocks at end of file.');
    merged = true;
    log.push(`    ${dryTag}APPENDED managed blocks to: ${rel}`);
  }

  return { content: updated, merged, log, snapshots };
}
