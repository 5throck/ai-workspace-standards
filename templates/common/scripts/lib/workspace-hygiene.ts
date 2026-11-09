// @version 1.0.0
// v1.0.0 (2026-11-08, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
//          §5.1): fixture-root hygiene classifier. An untracked WHOLE directory at the
//          repo root (`git status --porcelain` row `?? <top>/` — porcelain collapses an
//          entirely-untracked directory to one trailing-slash entry) whose name is one of
//          the repo's known top-level directories can only be test-fixture residue: a
//          suite whose mkdtemp root was relative instead of absolute recreated
//          `Projects/`/`tests/`/… inside the checkout — the class behind the 2026-11-04
//          `rm -rf Projects` incident (memory/2026-11-04.md:159, T-20261104-003/-004).
//          PR #1855 made the fixtures absolute; this module makes it ENFORCED.
//
// One derivation, two callers (the scripts/lib/fleet.ts discipline):
//   scripts/check-workspace-hygiene.ts (standalone, --json) and
//   scripts/dev-sync.ts step 6.4 (blocking gate before the S1 staging snapshot).
// Both run `git status --porcelain` themselves and feed the text here — this module
// never touches git or the filesystem, so the unit suite pins it on plain fixture
// strings. Untracked FILE entries inside tracked directories and tracked-but-modified
// rows are ordinary task work and must NOT classify as residue (design §5.1).
//
// Known top-level directories: the design's exact list. `memory/` and `tickets/` are
// deliberately absent — their whole-dir-untracked rows are not test-artifact patterns
// the design gate covers (gitignored runtime state lives under .pipeline-state/).

/** Porcelain rows `?? <dir>/` with `<dir>` in this list classify as fixture residue. */
export const KNOWN_TOP_LEVEL_DIRS: ReadonlySet<string> = new Set([
  'Projects',
  'services',
  'templates',
  'tests',
  'docs',
  'scripts',
  'agents',
  'skills',
]);

/**
 * Classify `git status --porcelain` (non `-z`, newline-separated, run from the repo
 * root) and return the residue offenders — deduped, sorted, as the porcelain path
 * (e.g. `Projects/`). Everything else is normal work:
 *   - ` M`/`M `/`A `… tracked-file states — never residue;
 *   - `?? <top>/file.ts` / `?? <top>/sub/` — an untracked FILE or nested dir inside a
 *     tracked top-level dir is ordinary new work, left to dev-sync's scoped-staging
 *     residual classification (design §5.1);
 *   - `?? <unknown-top>/` — a whole-untracked dir outside the known list is not
 *     covered by this gate (the caller may still notice it).
 */
export function classifyWorkspaceHygieneResidue(porcelain: string): string[] {
  const offenders = new Set<string>();
  for (const rawLine of porcelain.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('??')) continue;
    // Porcelain v1: two-char status, single space, then the path. Paths containing
    // special characters are C-quoted ("…") — strip the surrounding quotes so the
    // comparison below sees the literal path. (Non-ASCII stays escaped; those paths
    // can never equal a known top-level dir name, so no unescaping is needed.)
    let path = line.slice(3).trim();
    if (path.startsWith('"') && path.endsWith('"') && path.length >= 2) {
      path = path.slice(1, -1);
    }
    if (!path.endsWith('/')) continue; // a whole-untracked DIRECTORY always carries the trailing slash
    const top = path.slice(0, -1);
    if (top.includes('/')) continue; // nested inside a tracked dir — ordinary work
    if (KNOWN_TOP_LEVEL_DIRS.has(top)) offenders.add(path);
  }
  return [...offenders].sort();
}

/**
 * Actionable multi-line report for a non-empty offender list — shared by both
 * callers so the operator guidance cannot drift between the standalone script and
 * the dev-sync gate. Cites the binding design section.
 */
export function formatHygieneResidueReport(offenders: string[]): string[] {
  return [
    `Untracked whole-directory residue at the repo root (${offenders.join(', ')}):`,
    'an untracked WHOLE top-level directory can only be test-fixture residue,',
    'not work (work shows up as untracked FILES inside tracked directories).',
    'This is the class behind the 2026-11-04 `rm -rf Projects` incident',
    '(memory/2026-11-04.md:159, T-20261104-003). Remove the directory ONLY after',
    'confirming it is not real work — fixtures must use absolute mkdtemp roots:',
    '  rm -rf <each offending dir>   # after inspection',
    'Spec: docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §5.1',
  ];
}
