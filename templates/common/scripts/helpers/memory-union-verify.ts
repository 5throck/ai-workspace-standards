#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-11-06, T-20261106-007 — the gate-deadlock closure): the
//          archive↔union-verify fight. Merge e73b51057 deleted
//          memory/2026-10-29.md (archive-memory 7-day retention, post-
//          activation); the gate's prescribed repair ("restore in the
//          working tree") is immediately undone by the SAME pipeline's
//          archive step (step 3.8 re-moves the file to memory/archive/
//          before step 3.88 reads it), and with the file absent from the
//          working tree the repaired-at-head check could not run — the
//          finding was permanently FATAL. Fix: the repaired-at-head check
//          now falls back to memory/archive/<basename> when the worktree
//          file is absent — the archive is the documented end-state for
//          aged logs and its content IS the parent blocks (relocated, not
//          destroyed). Also (T-20261106-005 item 2): listMemoryMerges no
//          longer silently fails open on git plumbing errors — a failed
//          log/ls traversal now emits a stderr WARN naming the failed
//          command so an incomplete sweep is observable instead of
//          indistinguishable from an empty window.
// v1.1.1 (2026-11-06, T-20261105-002 follow-through — first post-merge sync
//          finding): the deleted-file arm (archive-memory 7-day retention
//          deletes a flat log; merge e73b51057 landed that deletion
//          post-activation) pushed an unconditional FATAL 'file deleted while
//          a parent still carries session blocks'. Archival deletions are the
//          documented retention cycle — now tiered 'repaired-at-head' (INFO)
//          when the MEMORY.md index row for the deleted log survives (the
//          tombstone is the positive evidence); no tombstone keeps the
//          original tier (a genuine clobber deletion stays FATAL).
// v1.1.0 (2026-11-05, T-20261105-002 — the v1 gap this landing closes):
//          post-activation drop findings were unrecoverable. Arm A compared
//          the merge commit's OWN blob, so the documented "restore the named
//          block(s) in the working tree — the repair lands forward" could
//          never clear a finding: the damaged blob is immutable history and
//          the finding refired on every sync (design §5.3's "a repaired file
//          passes" premise did not hold for the shipped implementation).
//          Repair-completion semantics (design §5.3 made implementable): a
//          finding group whose damage is repaired AT THE CURRENT WORKING
//          TREE is tier 'repaired-at-head' (INFO, not blocking) — verified by
//          the new exported repairedAtHead(): every parent-owed block present
//          in the working-tree content under the SAME strict rules as
//          verifyUnion, PLUS one absorption tolerance for the pause-line
//          class: an UN-HEADED parent block (heading === '') counts as
//          restored when its trimmed text appears VERBATIM inside the
//          working-tree content (it was absorbed into a headed block).
//          Headed parent blocks keep the strict heading+firstLine rule —
//          containment alone cannot fake a heading.
// memory-union-verify.ts — memory session-block union-verify (merge-integrity
// design §5.1, T-20261104-001). On 2026-11-04 two independent PR conflict
// resolutions (#1842, #1845) silently corrupted memory/YYYY-MM-DD.md session
// blocks — dropped blocks and a fused heading/separator, no conflict markers,
// detectable only by a manual post-merge block audit. No machine gate compared
// a merge result against its parents. This helper provides that gate as a
// pure core (no git, fully unit-testable) plus a thin git-plumbing wrapper:
//
//   Arm A — merge-commit union-verify: for bounded recent merge commits
//     touching flat memory logs, every block present in EITHER parent must
//     appear in the merged result (order-tolerant, dedup-tolerant); the merged
//     result must be structurally well-formed. Catches the drop AND fuse
//     shapes regardless of which tool produced the merge.
//   Arm B — worktree structural integrity: every flat memory log at HEAD must
//     be well-formed (block count === separator count + 1; every block starts
//     with a `## ` heading after trim; no block carries ≥ 2 Session Summary
//     headings — the fused-separator signature). Catches fuses that arrived
//     via non-merge commits. Drops via non-merge commits are NOT detectable
//     here (no parents to compare) — documented limit (design §5.3).
//
// Detection rules (design §5.1):
//   1. Drop: every block in `ours` and every block in `theirs` (fingerprint =
//      exact trimmed block text) must appear in `merged`. Order is never
//      checked (union semantics are order-tolerant). Identical blocks present
//      in both parents and deduplicated to one in the merged result pass —
//      correct union behavior, not a drop.
//   2. Fuse: any parsed block in `merged` containing ≥ 2 `## Session Summary`
//      headings — the signature the 11-04 incident produced when a heading
//      and its separator fused. (Scoped to the Session Summary heading, NOT
//      all `^## ` lines: every healthy block legitimately carries four `## `
//      sections.) Also caught by rule 3's count invariant.
//   3. Well-formed result: nonEmptyBlockCount === separatorCount + 1, and
//      every block begins with a `## ` heading after trim. Separator count is
//      taken as the `/\n---\n/` split-point count (the verify-memory.ts:109
//      convention) so the two measures cannot disagree; the invariant was
//      verified against the live repo (memory/2026-11-04.md: 16 blocks / 15
//      separators).
//   4. Match strategy: exact trimmed-text fingerprint first; if not found, a
//      fallback match on `heading + firstLine` prevents false alarms when a
//      resolution legitimately reflowed whitespace inside an otherwise-intact
//      block — the finding fires only when neither matches.
//
// L0/L1 delivery note: dev-sync.ts is L0+L1 (byte-identical mirror), so this
// helper ships to templates/common/scripts/helpers. Unlike ticket-drift.ts it
// has NO L0-only dependency (node:fs + git subprocess only), so the check is
// fully armed everywhere; a variant repo with no memory merge commits simply
// passes — absent memory/ is a documented no-op handled at the dev-sync step
// layer (same posture as step 3.87).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** One parsed session block (verify-memory.ts:108-117 conventions). */
export interface MemoryBlock {
  /** First `^## (.+)` heading in the block (trimmed), or '' when absent. */
  heading: string;
  /** First non-empty line of the trimmed block (fallback-match component). */
  firstLine: string;
  /** The trimmed block text — the exact-text fingerprint. */
  text: string;
}

/** One integrity finding. `detail` names the block (heading + first content
 * line) and, for drops, the owning parent — enough for mechanical repair. */
export interface UnionFinding {
  kind: 'dropped-block' | 'fused-heading' | 'malformed-result';
  /** Repo-relative file, e.g. memory/2026-11-04.md. */
  file: string;
  detail: string;
}

/** Splits content on the verify-memory.ts:109 separator convention and
 * extracts each non-empty block's heading, first CONTENT line and trimmed
 * text. `firstLine` deliberately skips the heading line itself: every healthy
 * session block's first raw line is `## Session Summary`, so a heading-inclusive
 * firstLine would make the heading+firstLine fallback match vacuously true
 * for every pair of blocks and silently disable drop detection. */
export function parseBlocks(content: string): MemoryBlock[] {
  const blocks: MemoryBlock[] = [];
  for (const raw of content.split(/\n---\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    let heading = '';
    let headingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^## (.+)$/);
      if (m) {
        heading = m[1].trim();
        headingIdx = i;
        break;
      }
    }
    let firstLine = '';
    if (headingIdx >= 0) {
      for (let i = headingIdx + 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          firstLine = lines[i].trim();
          break;
        }
      }
    } else {
      for (const line of lines) {
        if (line.trim()) {
          firstLine = line.trim();
          break;
        }
      }
    }
    blocks.push({ heading, firstLine, text: trimmed });
  }
  return blocks;
}

/** Fuse signature: number of `## Session Summary` heading lines in one block. */
function sessionSummaryCount(blockText: string): number {
  return (blockText.match(/^## Session Summary/gm) ?? []).length;
}

/** Arm A/B rule 3: separator count = `/\n---\n/` split points on the raw
 * content (blockCount - 1 for a well-formed file). Empty-trailing-block edge:
 * a file ending in a bare separator yields an extra empty split part, which
 * the count treats as the malformed shape it is. */
function separatorCount(content: string): number {
  return content.split(/\n---\n/).length - 1;
}

/** Arm B (and Arm A rule 3): structural well-formedness of one memory log.
 * A file with zero blocks (empty/whitespace) is vacuously well-formed. */
export function verifyWellFormed(opts: { file: string; content: string }): UnionFinding[] {
  const { file, content } = opts;
  const findings: UnionFinding[] = [];
  const blocks = parseBlocks(content);
  if (blocks.length === 0) return findings;
  const seps = separatorCount(content);
  if (blocks.length !== seps + 1) {
    findings.push({
      kind: 'malformed-result',
      file,
      detail: `block/separator count invariant violated: ${blocks.length} session block(s) vs ${seps} '---' separator(s) (expected blocks === separators + 1)`,
    });
  }
  for (const block of blocks) {
    if (!block.text.startsWith('## ')) {
      findings.push({
        kind: 'malformed-result',
        file,
        detail: `block does not begin with a '## ' heading after trim — first line: ${JSON.stringify(block.firstLine.slice(0, 120))}`,
      });
    }
    if (sessionSummaryCount(block.text) >= 2) {
      findings.push({
        kind: 'fused-heading',
        file,
        detail: `block carries ${sessionSummaryCount(block.text)} '## Session Summary' headings — the fused heading/separator signature (two session blocks share one separator)`,
      });
    }
  }
  return findings;
}

/** Arm A: parent-union integrity of one merged memory log. Every block owed
 * by either parent must be present in `merged` (exact trimmed fingerprint
 * first, then heading + firstLine fallback — design §5.1 rule 4), and the
 * merged content must be structurally well-formed (rules 2 and 3). */
export function verifyUnion(opts: {
  file: string;
  ours: string;
  theirs: string;
  merged: string;
}): UnionFinding[] {
  const { file, ours, theirs, merged } = opts;
  const findings: UnionFinding[] = [...verifyWellFormed({ file, content: merged })];
  for (const { parent, block } of droppedBlocks(ours, theirs, merged)) {
    const label = block.heading !== '' ? `## ${block.heading}` : '(no heading)';
    findings.push({
      kind: 'dropped-block',
      file,
      detail: `block dropped from the ${parent} side of the merge: ${label} — first line: ${JSON.stringify(block.firstLine.slice(0, 120))}`,
    });
  }
  return findings;
}

/** The parent-owed blocks MISSING from `head` content under verifyUnion's
 * strict rules (exact text, or heading+firstLine for headed blocks).
 * Parent-labeled so repair tooling can attribute the debt. */
export function droppedBlocks(
  ours: string,
  theirs: string,
  head: string,
): Array<{ parent: 'ours' | 'theirs'; block: MemoryBlock }> {
  const headBlocks = parseBlocks(head);
  const matchesHead = (block: MemoryBlock): boolean =>
    headBlocks.some((m) => m.text === block.text) ||
    headBlocks.some((m) => m.heading === block.heading && m.heading !== '' && m.firstLine === block.firstLine);
  const dropped: Array<{ parent: 'ours' | 'theirs'; block: MemoryBlock }> = [];
  for (const [parent, content] of [['ours', ours], ['theirs', theirs]] as const) {
    for (const block of parseBlocks(content)) {
      if (matchesHead(block)) continue;
      dropped.push({ parent, block });
    }
  }
  return dropped;
}

/**
 * The T-20261105-002 repair-completion predicate: TRUE when every
 * parent-owed block from droppedBlocks(ours, theirs, head) is accounted for
 * in the working-tree/head content under the strict rules PLUS the
 * absorption tolerance — an UN-HEADED parent block (the single-line
 * pause-window-note class) counts as restored when its trimmed text appears
 * VERBATIM inside the head content (absorbed into a headed session block).
 * Headed parent blocks are NEVER satisfied by containment: a heading must
 * match by heading+firstLine, so containment alone cannot fake a headed
 * block's presence.
 */
export function repairedAtHead(opts: { ours: string; theirs: string; head: string }): boolean {
  const { ours, theirs, head } = opts;
  const dropped = droppedBlocks(ours, theirs, head);
  if (dropped.length === 0) return true;
  for (const { block } of dropped) {
    if (block.heading !== '') return false; // headed debt: strict rule only
    if (!head.includes(block.text)) return false; // un-headed debt: absorbed verbatim?
  }
  return true;
}

/** Scan-layer exemption — the verify-memory.ts:37-42 EXEMPT_PATTERNS set
 * (MEMORY.md, meeting-*, adr-*, date-*-meeting) plus the memory/archive/
 * subtree. `relPath` is repo-relative, e.g. memory/2026-11-04.md. */
export function isExemptMemoryFile(relPath: string): boolean {
  const rest = relPath.startsWith('memory/') ? relPath.slice('memory/'.length) : relPath;
  if (rest.includes('/')) return true; // nested subtree (memory/archive/, memory/skill-review/, ...)
  return (
    /^MEMORY\.md$/.test(rest) ||
    /^meeting-/.test(rest) ||
    /^adr-/.test(rest) ||
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}-.*-meeting/.test(rest)
  );
}

/** Flat memory/*.md file names (relative, repo-root-forward) that pass the
 * exemption filter — the shared scan target list for both arms. */
export function flatMemoryFiles(memoryDir: string): string[] {
  if (!existsSync(memoryDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(memoryDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const rel = `memory/${entry.name}`;
    if (isExemptMemoryFile(rel)) continue;
    out.push(rel);
  }
  return out.sort();
}

// ── Git plumbing (thin wrapper; the pure core above carries the logic) ──────

/** One merge commit and the flat, non-exempt memory files it touched. */
export interface MergeScanTarget {
  commit: string;
  /** Parent hashes in git order — P1 = ours, P2 = theirs. */
  parents: string[];
  /** Repo-relative flat memory log paths touched by the merge. */
  files: string[];
}

/** One merge's union-verify result (findings plus the owning commit so the
 * dev-sync step can print repair guidance naming the exact blobs).
 *
 * `tier` implements the two-tier rollout (user-approved adaptation of design
 * §8 step 3, 2026-11-05): the design's "expected pass on first run" premise
 * was false — the 7-day window contains REAL landed union violations
 * (e.g. merge 3db832974 / PR #1850 dropped ~20 session blocks) that immutable
 * history cannot repair, so findings on merge commits committed at or before
 * the gate-activation instant are tier 'historical' (WARN, ages out with the
 * window) and only post-activation merges are tier 'blocking' (FATAL). */
export interface MergeScanResult {
  commit: string;
  file: string;
  findings: UnionFinding[];
  tier: 'blocking' | 'historical' | 'repaired-at-head';
}

/** Git plumbing failures are no longer silent (T-20261106-005 item 2): a
 *  failed call WARNs to stderr so an incomplete sweep is observable instead
 *  of indistinguishable from an empty window. Return contract unchanged:
 *  null = "no data" (fail-open at the caller). */
function git(args: string[], cwd: string): string | null {
  const res = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (res.exitCode !== 0) {
    console.warn(`⚠️  memory-union-verify: git ${args[0]} failed (exit ${res.exitCode}) — sweep results may be incomplete`);
    return null;
  }
  return res.stdout.toString();
}

/** Bounded Arm A sweep: merge commits from the last `sinceDays` days (max
 * `maxCommits`), touching anything under memory/, with the touched flat
 * non-exempt memory logs enumerated against each parent. A repo without
 * merge commits touching memory returns an empty list (documented no-op). */
export function listMemoryMerges(opts: {
  sinceDays: number;
  maxCommits: number;
  cwd?: string;
}): MergeScanTarget[] {
  // Non-positive window disables the sweep entirely — git's --since is >=
  // semantics, so "0 days" would still include same-instant commits; the
  // bounded-window contract needs a hard off-switch (and maxCommits=0 already
  // falls out naturally from `-n 0`... which git treats as unlimited, hence
  // the explicit guard below too).
  if (opts.sinceDays <= 0 || opts.maxCommits <= 0) return [];
  const cwd = opts.cwd ?? process.cwd();
  const logOut = git(
    [
      'log',
      '--merges',
      // --full-history is required: default history simplification prunes a
      // merge that is TREESAME to one parent for the pathspec — a clean union
      // merge that took one side's file verbatim (the shape union-verify most
      // needs to bless) would silently vanish from the sweep without it.
      '--full-history',
      `--since=${opts.sinceDays} days`,
      '-n',
      String(opts.maxCommits),
      '--format=%H %P',
      '--',
      'memory',
    ],
    cwd,
  );
  if (logOut === null) return [];
  const targets: MergeScanTarget[] = [];
  for (const line of logOut.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [commit, ...parents] = trimmed.split(/\s+/);
    if (parents.length < 2) continue; // defensive: --merges guarantees >= 2
    const touched = new Set<string>();
    for (const parent of parents) {
      const diffOut = git(['diff-tree', '-r', '--name-only', parent, commit], cwd);
      if (diffOut === null) continue;
      for (const f of diffOut.split('\n')) {
        const p = f.trim();
        if (!p.startsWith('memory/') || !p.endsWith('.md')) continue;
        if (isExemptMemoryFile(p)) continue;
        touched.add(p);
      }
    }
    if (touched.size === 0) continue;
    targets.push({ commit, parents: [parents[0], parents[1]], files: [...touched].sort() });
  }
  return targets;
}

/** `git show <commit>:<path>` — null when the path is absent in that commit
 * (file added or deleted relative to that side). */
export function showBlob(commit: string, file: string, cwd?: string): string | null {
  return git(['show', `${commit}:${file}`], cwd ?? process.cwd());
}

/** Full Arm A: run verifyUnion over the bounded merge sweep. A parent blob
 * missing (file added on the other side) contributes no obligations; a merged
 * blob missing while a parent has one is itself the extreme drop shape and is
 * reported as such.
 *
 * `activationIso` (e.g. '2026-11-05T00:00:00+09:00') is the two-tier rollout
 * gate-activation instant: merge commits whose committer date is strictly
 * AFTER it are tier 'blocking'; commits at or before it are tier 'historical'.
 * Omitted = every finding is 'blocking' (the design-literal posture). */
export function unionScan(opts: {
  sinceDays: number;
  maxCommits: number;
  activationIso?: string;
  cwd?: string;
}): MergeScanResult[] {
  const cwd = opts.cwd ?? process.cwd();
  const results: MergeScanResult[] = [];
  for (const target of listMemoryMerges({ sinceDays: opts.sinceDays, maxCommits: opts.maxCommits, cwd })) {
    const tier = tierFor(target.commit, opts.activationIso, cwd);
    const [p1, p2] = target.parents;
    for (const file of target.files) {
      const ours = showBlob(p1, file, cwd);
      const theirs = showBlob(p2, file, cwd);
      const merged = showBlob(target.commit, file, cwd);
      if (merged === null) {
        if (ours !== null || theirs !== null) {
          // v1.1.1 archived-retention tier: a flat log deleted while a parent
          // carries blocks is the DOCUMENTED archive-memory 7-day retention
          // cycle when its MEMORY.md index row survives (the tombstone IS the
          // positive evidence — the same positive-evidence-only posture as
          // filterTransientCheckouts). No tombstone row = original tier.
          let deletedTier: MergeScanResult['tier'] = tier;
          try {
            const memoryIndex = readFileSync(join(cwd, 'memory', 'MEMORY.md'), 'utf8');
            const base = file.replace(/^memory\//, '').replace(/\.md$/, '');
            if (new RegExp(`^\\| ${base} \\|`, 'm').test(memoryIndex)) {
              deletedTier = 'repaired-at-head'; // sanctioned archival — INFO tier shared
            }
          } catch {
            // MEMORY.md unreadable — keep the original tier (fail-closed)
          }
          results.push({
            commit: target.commit,
            file,
            tier: deletedTier,
            findings: [
              {
                kind: 'dropped-block',
                file,
                detail: deletedTier === 'repaired-at-head'
                  ? 'file deleted in the merge commit — archive-memory 7-day retention (MEMORY.md tombstone row present; INFO, ages out with the window)'
                  : 'file deleted in the merge commit while a parent still carries session blocks',
              },
            ],
          });
        }
        continue;
      }
      const findings = verifyUnion({
        file,
        ours: ours ?? '',
        theirs: theirs ?? '',
        merged,
      });
      if (findings.length > 0) {
        // v1.1.0 repaired-at-head: findings computed against the merge's own
        // blob, but the repair contract lands FORWARD — when the current
        // working-tree file accounts for every parent-owed block
        // (repairedAtHead), the group reports tier 'repaired-at-head'
        // (INFO) instead of blocking. Unreadable worktree file = not
        // proven repaired = original tier stands.
        let effectiveTier: MergeScanResult['tier'] = tier;
        try {
          const worktreeContent = readFileSync(join(cwd, file), 'utf8');
          if (repairedAtHead({ ours: ours ?? '', theirs: theirs ?? '', head: worktreeContent })) {
            effectiveTier = 'repaired-at-head';
          }
        } catch {
          // v1.2.0 archive-location fallback (T-20261106-007): the worktree
          // file may be absent because step 3.8's archive-memory just moved
          // it to memory/archive/ — the documented end-state for aged logs.
          // The archived content IS the parent blocks (relocated, not
          // destroyed), so the repaired-at-head check runs against it.
          try {
            const archivedContent = readFileSync(join(cwd, 'memory', 'archive', basename(file)), 'utf8');
            if (repairedAtHead({ ours: ours ?? '', theirs: theirs ?? '', head: archivedContent })) {
              effectiveTier = 'repaired-at-head';
            }
          } catch {
            // neither worktree nor archive readable — keep the original tier
          }
        }
        results.push({ commit: target.commit, file, findings, tier: effectiveTier });
      }
    }
  }
  return results;
}

/** Commit date (committer, ISO-8601) of a merge commit; null when git fails. */
function commitDateIso(commit: string, cwd: string): string | null {
  return git(['show', '-s', '--format=%cI', commit], cwd)?.trim() ?? null;
}

function tierFor(commit: string, activationIso: string | undefined, cwd: string): 'blocking' | 'historical' {
  if (!activationIso) return 'blocking';
  const date = commitDateIso(commit, cwd);
  if (date === null) return 'blocking'; // fail-closed: undatable commit treated as new
  return date > activationIso ? 'blocking' : 'historical';
}

/** Arm B plumbing: verifyWellFormed over every flat, non-exempt memory log in
 * the working tree. Returns one entry per file that produced findings. */
export function wellFormedScan(opts: { memoryDir: string }): Array<{ file: string; findings: UnionFinding[] }> {
  const out: Array<{ file: string; findings: UnionFinding[] }> = [];
  for (const rel of flatMemoryFiles(opts.memoryDir)) {
    const abs = join(opts.memoryDir, rel.slice('memory/'.length));
    const content = readFileSync(abs, 'utf-8');
    const findings = verifyWellFormed({ file: rel, content });
    if (findings.length > 0) out.push({ file: rel, findings });
  }
  return out;
}
