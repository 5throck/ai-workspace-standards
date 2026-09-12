// @version 1.0.0
/**
 * git-status.ts
 *
 * Shared NUL-delimited `git status --porcelain=v1 -z` parser for dev-sync's
 * scoped staging (design: docs/designs/2026-09-12-dev-sync-scoped-staging-design.md).
 * dev-sync snapshots the working tree before the pipeline mutates anything (S0)
 * and again at commit time (S1); S1 \ S0 is the pipeline's own output — the only
 * generated files that may join the commit without explicit task staging.
 *
 * The `-z` format never C-quotes paths (unlike human porcelain), so paths with
 * spaces or UTF-8 arrive verbatim, NUL-separated. Rename/copy records carry a
 * second NUL-delimited field (the original path) which this parser must skip —
 * treating it as its own record would resurrect deleted paths into the set.
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
