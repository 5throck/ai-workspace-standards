// @version 1.1.0
// v1.1.0: add parseCachedNameStatus() — parses `git diff --cached --name-status -z`
//           into the set of paths the index records as REMOVED (status `D` plus the
//           SOURCE path of every `R<score>` staged rename). Consumed by dev-sync
//           step 6.5 scoped staging to skip paths whose desired state is already in
//           the index (a plain pathspec `git add` fatals on them — spec Amendment 2,
//           docs/designs/2026-09-24-constitution-s33-context-injection-design.md §13).
// v1.0.0: initial parseStatusPorcelain() for the S0/S1 snapshots (design:
//           docs/designs/2026-09-12-dev-sync-scoped-staging-design.md).
/**
 * git-status.ts
 *
 * Shared NUL-delimited parsers for dev-sync's scoped staging.
 *
 * parseStatusPorcelain reads `git status --porcelain=v1 -z` (S0/S1 snapshots:
 * dev-sync snapshots the working tree before the pipeline mutates anything (S0)
 * and again at commit time (S1); S1 \ S0 is the pipeline's own output — the only
 * generated files that may join the commit without explicit task staging).
 *
 * parseCachedNameStatus reads `git diff --cached --name-status -z` (step 6.5
 * index-removed set for staged deletions and staged rename sources).
 *
 * The `-z` formats never C-quote paths (unlike human porcelain), so paths with
 * spaces or UTF-8 arrive verbatim, NUL-separated. Rename/copy records carry an
 * extra NUL-delimited field (the original path) which each parser must treat
 * per its format — porcelain v1 lists the TARGET first (`R  to\0from`), cached
 * name-status lists the SOURCE first (`R100\0from\0to`). Treating the extra
 * field as its own record would resurrect deleted paths into the set.
 */

/**
 * Parse `git status --porcelain=v1 -z -uall` output into a set of paths.
 * Returns paths only (XY status prefixes dropped); untracked files are
 * enumerated individually because callers pass `-uall`.
 */
export function parseStatusPorcelain(out: string): Set<string> {
    const paths = new Set<string>();
    const records = out.split('\0').filter(Boolean);
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        // Each record is "XY <path>" (two status letters + one space). Anything
        // shorter cannot carry a path — skip rather than throw on stray input.
        if (record.length < 4) continue;
        paths.add(record.slice(3));
        // Rename/copy records embed the original path as the next NUL field.
        const x = record[0];
        const y = record[1];
        if (x === 'R' || x === 'C' || y === 'R' || y === 'C') i++;
    }
    return paths;
}

/**
 * Parse `git diff --cached --name-status -z` output into the set of paths the
 * INDEX records as removed relative to HEAD: every `D` (deleted) path, plus the
 * SOURCE path of every `R<score>` staged rename (a staged rename removes its
 * source from the index; its target stays). For these paths no `git add` is
 * needed — the index already holds the desired state — and a plain pathspec
 * `git add` would fatal ("pathspec did not match any files") because the path
 * exists in neither the worktree nor the index.
 *
 * -z record shape (probed, git 2.x): `<STATUS>\0<path>[\0<extra>]\0`, STATUS a
 * bare token (`D`, `A`, `M`, `R100`, `C75`, ...). For rename/copy records the
 * SOURCE path comes FIRST, then the target — the opposite field order of the
 * porcelain v1 format parseStatusPorcelain handles. Copy records (`C`) do NOT
 * remove their source, so only rename sources are collected.
 */
export function parseCachedNameStatus(out: string): Set<string> {
    const removed = new Set<string>();
    const records = out.split('\0');
    for (let i = 0; i < records.length; i++) {
        const status = records[i];
        if (!status) continue;
        const first = records[++i];
        if (first === undefined) break; // truncated trailing record — ignore
        if (status === 'D') {
            removed.add(first);
        } else if (status[0] === 'R' || status[0] === 'C') {
            const second = records[++i];
            if (second === undefined) break; // truncated rename record — ignore
            if (status[0] === 'R') removed.add(first); // source, not target
        }
        // A / M / T / U and unknown statuses remove nothing.
    }
    return removed;
}
