/**
 * Unit + e2e tests for scripts/design-gate-coverage.ts (T-20261028-001, spec
 * docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 * D8): the windowed Design-Gate coverage check. Covers the acceptance row —
 * a window with covered tickets yields an empty uncovered set; a
 * template-touching commit lacking any ticket id is flagged unattributed; a
 * ticket no registered spec names stays flagged uncovered — plus the Q4
 * registry-join semantics (prose mention counts; the registry is the SSOT; a
 * full ticket id is required — the "T-...-009/-010" slash shorthand covers
 * only the first id) and the review-baseline battery #9 verdict classifier.
 *
 * Pure suites run against the module exports; the e2e suites spawn the CLI
 * over pinned historical windows of this repository's git history (the
 * 2026-10-28 FULL review's F-1 window) — immutable once merged.
 *
 * @version 1.1.0
 *
 * v1.1.0 (2026-10-28, DEC-20261028-04 retro-backfill): the F-1 window pin
 *           "genuinely uncovered F-1 tickets stay flagged (no
 *           retro-registration)" was updated per its own maintenance note —
 *           T-20261027-010 and U-20261027-005 are retro-covered by
 *           2026-10-27-validator-hardening-retro-design; the ids the retro
 *           scopes out (U-20261026-009, U-20261027-002) stay pinned flagged.
 */
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  extractTicketIds,
  joinCoverage,
  touchesTemplateSurface,
} from '../../scripts/design-gate-coverage.ts';
import { designGateCoverageVerdict } from '../../scripts/review-baseline.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const coverageScript = join(workspaceRoot, 'scripts', 'design-gate-coverage.ts');

function runCoverage(args: string[]): { status: number; out: string } {
  const result = spawnSync('bun', [coverageScript, ...args], {
    encoding: 'utf-8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workspaceRoot,
  });
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

describe('extractTicketIds', () => {
  test('extracts T- and U- ids from subjects, bodies, and paths', () => {
    const text = 'fix: stuff (T-20261027-005, U-20261026-005)\nsee tickets/governance/T-20261027-010.yaml';
    expect(extractTicketIds(text).sort()).toEqual(['T-20261027-005', 'T-20261027-010', 'U-20261026-005']);
  });

  test('ignores short ticket shorthands and near-miss patterns', () => {
    expect(extractTicketIds('close T-001, T-013 and DEC-20261028-02 + ADR-0074')).toEqual([]);
    expect(extractTicketIds('X-20261027-005 and T-2026-005 are not ticket ids')).toEqual([]);
  });

  test('deduplicates repeated ids', () => {
    expect(extractTicketIds('T-20261027-005 again T-20261027-005')).toEqual(['T-20261027-005']);
  });
});

describe('touchesTemplateSurface (design D8 path set)', () => {
  test('template/code surfaces match', () => {
    expect(touchesTemplateSurface(['templates/common/agents/x.md'])).toBe(true);
    expect(touchesTemplateSurface(['scripts/foo.ts'])).toBe(true);
    expect(touchesTemplateSurface(['.agents/skills/x/SKILL.md'])).toBe(true);
    expect(touchesTemplateSurface(['docs/governance/agents/workflows.md'])).toBe(true);
    expect(touchesTemplateSurface(['docs/standards/x.md'])).toBe(true);
    expect(touchesTemplateSurface(['agents/pm.md'])).toBe(true);
  });

  test('root instruction files match', () => {
    expect(touchesTemplateSurface(['AGENTS.md'])).toBe(true);
    expect(touchesTemplateSurface(['CLAUDE.md'])).toBe(true);
    expect(touchesTemplateSurface(['GEMINI.md', 'CODEX.md', 'HERMES.md'])).toBe(true);
  });

  test('non-surface paths never match — including project-tree copies of instruction files', () => {
    expect(touchesTemplateSurface(['docs/designs/x-design.md'])).toBe(false);
    expect(touchesTemplateSurface(['docs/reports/x.md'])).toBe(false);
    expect(touchesTemplateSurface(['docs/specs/registry.json'])).toBe(false);
    expect(touchesTemplateSurface(['README.md', 'CHANGELOG.md'])).toBe(false);
    expect(touchesTemplateSurface(['Projects/co-design/AGENTS.md'])).toBe(false);
    expect(touchesTemplateSurface(['services/x/Dockerfile'])).toBe(false);
  });
});

describe('joinCoverage (Q4 registry-join semantics)', () => {
  const specDocs = new Map([
    ['2026-10-27-sync-overwrite-policy-design', {
      status: 'implemented',
      file: 'docs/designs/2026-10-27-sync-overwrite-policy-design.md',
      text: '# design\n\n... covers T-20261027-005 in prose only (no structured field) ...\n',
    }],
  ]);
  // The registry-vs-stray-doc SSOT distinction (a design doc NOT listed in
  // docs/specs/registry.json must not count) is enforced by
  // loadRegisteredDocTexts, which only reads registry.json entries — exercised
  // end-to-end by the F-1 window suites below.

  test('a ticket named by a registered spec doc is covered (prose mention counts)', () => {
    const rows = joinCoverage(['T-20261027-005'], specDocs);
    expect(rows).toHaveLength(1);
    expect(rows[0].covered).toBe(true);
    expect(rows[0].specs.map((s) => s.id)).toEqual(['2026-10-27-sync-overwrite-policy-design']);
  });

  test('a ticket no registered doc names is uncovered', () => {
    const rows = joinCoverage(['T-20300101-001'], specDocs);
    expect(rows[0].covered).toBe(false);
    expect(rows[0].specs).toEqual([]);
  });

  test('a registered doc naming multiple tickets covers each; slash shorthand covers only the full id', () => {
    const docs = new Map([
      ['s1', { status: 'approved', file: 'd.md', text: 'T-20261027-009/-010 and U-20261027-004 have no design-doc mention' }],
    ]);
    const rows = joinCoverage(['T-20261027-009', 'T-20261027-010', 'U-20261027-004'], docs);
    const byId = new Map(rows.map((r) => [r.id, r]));
    // "T-20261027-009/-010" contains the full first id (join matches it) but
    // the truncated "-010" tail never matches the full-id pattern.
    expect(byId.get('T-20261027-009')!.covered).toBe(true);
    expect(byId.get('T-20261027-010')!.covered).toBe(false);
    expect(byId.get('U-20261027-004')!.covered).toBe(true);
  });

  test('output is sorted by ticket id', () => {
    const rows = joinCoverage(['U-20261026-005', 'T-20261027-005'], specDocs);
    expect(rows.map((r) => r.id)).toEqual(['T-20261027-005', 'U-20261026-005']);
  });
});

describe('designGateCoverageVerdict (review-baseline battery #9 classifier)', () => {
  test('a fully-covered window is green', () => {
    const v = designGateCoverageVerdict({
      tickets: [{ id: 'T-1', covered: true }],
      uncovered: [],
      unattributedCommits: [],
      touchingCommits: 3,
      window: { since: 'w-start', until: 'HEAD' },
    });
    expect(v.warn).toBe(false);
    expect(v.note).toContain('fully covered');
  });

  test('uncovered tickets and unattributed commits warn (report-only, nothing auto-closes)', () => {
    const v = designGateCoverageVerdict({
      tickets: [{ id: 'T-1', covered: false }],
      uncovered: ['T-1'],
      unattributedCommits: [{ sha: 'abc1234', subject: 'no ticket here' }],
      touchingCommits: 2,
      window: { since: 'w-start' },
    });
    expect(v.warn).toBe(true);
    expect(v.note).toContain('2 uncovered row(s)');
    expect(v.note).toContain('nothing auto-closes');
  });

  test('an unparseable payload warns', () => {
    expect(designGateCoverageVerdict(undefined).warn).toBe(true);
    expect(designGateCoverageVerdict({}).warn).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E2E over this repository's pinned git history
// ═════════════════════════════════════════════════════════════════════════════

/** The 2026-10-28 FULL review's F-1 window (docs/reports/2026-10-28-project-
 *  review-daily.md header). Immutable history — the assertions below pin the
 *  mechanical output that PR (T-20261028-001) reconciles F-1 against; a later
 *  wave that retro-covers one of the uncovered ids must update its pin. */
const F1_SINCE = '2026-10-27T06:23:30+09:00';
const F1_UNTIL = '2026-10-28T02:02:00+09:00';

describe('design-gate-coverage e2e — the F-1 window (T-20261028-001 acceptance)', () => {
  const report = JSON.parse(
    runCoverage(['--json', '--since', F1_SINCE, '--until', F1_UNTIL]).out,
  ) as {
    touchingCommits: number;
    uncovered: string[];
    unattributedCommits: Array<{ sha: string }>;
    tickets: Array<{ id: string; covered: boolean; specs: Array<{ id: string }> }>;
    commits: Array<{ sha: string; touching: boolean; tickets: string[] }>;
  };
  const byId = new Map(report.tickets.map((t) => [t.id, t]));

  test('reproduces (a superset of) the F-1 template-touching commit set', () => {
    // F-1 counted 8 ad hoc; the mechanical pass is strictly more sensitive
    // (every scripts/, templates/, .agents/ commit in the window).
    expect(report.touchingCommits).toBeGreaterThanOrEqual(8);
  });

  test('already-registered F-1 tickets resolve as covered by their registered specs', () => {
    // T-20261027-005: the sync-overwrite-policy design names it in prose.
    expect(byId.get('T-20261027-005')!.covered).toBe(true);
    expect(byId.get('T-20261027-005')!.specs.map((s) => s.id))
      .toContain('2026-10-27-sync-overwrite-policy-design');
    // U-20261026-005: covered by two (or more) registered designs.
    expect(byId.get('U-20261026-005')!.covered).toBe(true);
    expect(byId.get('U-20261026-005')!.specs.length).toBeGreaterThanOrEqual(2);
  });

  test('retro-covered F-1 ids resolve covered; genuinely uncovered ids stay flagged', () => {
    // T-20261027-010 and U-20261027-005 were retro-covered by the
    // 2026-10-27-validator-hardening-retro-design registration (the F-1
    // retro-backfill adjudication, DEC-20261028-04). This pin was updated per
    // the maintenance note in the F-1 window comment above ("a later wave
    // that retro-covers one of the uncovered ids must update its pin") — the
    // original "no retro-registration" assertion was the pre-retro state.
    const retroCovered = (id: string) => {
      const row = byId.get(id)!;
      expect(row.covered).toBe(true);
      expect(row.specs.map((s) => s.id)).toContain('2026-10-27-validator-hardening-retro-design');
    };
    retroCovered('T-20261027-010');
    retroCovered('U-20261027-005');
    // T-20261029-002 batch registration (2026-10-29-retro-records-registration-
    // design): U-20261026-009 and U-20261027-002 were "genuinely uncovered" pins
    // here until the records-hygiene batch retro-registered them (both landed in
    // PR #1634, commit ec3921e74). Pin updated per the maintenance note in the
    // F-1 window comment above ("a later wave that retro-covers one of the
    // uncovered ids must update its pin").
    const batchCovered = (id: string) => {
      const row = byId.get(id)!;
      expect(row.covered).toBe(true);
      expect(row.specs.map((s) => s.id)).toContain('2026-10-29-retro-records-registration-design');
    };
    batchCovered('U-20261026-009');
    batchCovered('U-20261027-002');
    // After both retro registrations, every ticketed id in the F-1 window
    // resolves covered — the window's uncovered set is empty (the only
    // remaining finding is the unattributed commit f466b2cd, pinned by the
    // next test; report-only, nothing auto-closes).
    expect(report.uncovered).toEqual([]);
  });

  test('a template-touching commit citing no ticket id is flagged unattributed', () => {
    // f466b2cd — project-resync v1.7.0 landing, no ticket id in subject/body.
    // The report canonicalizes to 8-char short SHAs: git's auto-abbrev length
    // is environment-dependent (CI printed 9 chars where local printed 8), so
    // the pin is the canonical 8-char form, not whatever %h printed locally.
    expect(report.unattributedCommits.map((c) => c.sha)).toContain('f466b2cd');
    // Every reported sha is exactly 8 chars — the canonical form holds for the
    // whole table, not just the pinned row.
    for (const c of report.unattributedCommits) expect(c.sha).toMatch(/^[0-9a-f]{8}$/);
    for (const c of report.commits) expect(c.sha).toMatch(/^[0-9a-f]{8}$/);
  });

  test('the CLI always exits 0 — report-only, nothing auto-closes (design D8)', () => {
    expect(runCoverage(['--since', F1_SINCE, '--until', F1_UNTIL]).status).toBe(0);
  });
});

describe('design-gate-coverage e2e — a fully covered window yields an empty uncovered set', () => {
  test('the claude-s2 heading-collision window (T-20261027-008) is fully covered', () => {
    // Window isolating 45ba94dc3 (fix: claude-s2 heading collision, 10:20:20
    // +0900) — the only non-merge commit between 10:18 and 10:22; its ticket
    // is named by the registered 2026-10-27-claude-s2-heading-collision-design.
    const { status, out } = runCoverage([
      '--json',
      '--since', '2026-10-27T10:18:00+09:00',
      '--until', '2026-10-27T10:22:00+09:00',
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(out) as {
      touchingCommits: number;
      uncovered: string[];
      unattributedCommits: unknown[];
      tickets: Array<{ id: string; covered: boolean }>;
    };
    expect(report.touchingCommits).toBe(1);
    expect(report.tickets.map((t) => t.id)).toEqual(['T-20261027-008']);
    expect(report.tickets.every((t) => t.covered)).toBe(true);
    expect(report.uncovered).toEqual([]);
    expect(report.unattributedCommits).toEqual([]);
  }, 120_000);
});

describe('design-gate-coverage e2e — the 2026-10-28 ticket family joins correctly (id-family pin)', () => {
// Regression pin for the F-1 reconciliation review note: T-20261028-002 and
// T-20261028-010 are DIFFERENT tickets from the F-1 rows T-20261027-002 /
// T-20261027-010 they resemble. The 2026-10-28 family was created after the
// F-1 window closed (tickets filed 02:21 KST, window ends 02:02) and each IS
// named by a registered implemented design — the join must resolve them
// covered. (The 2026-10-27 rows themselves: T-20261027-002/-010 were
// retro-covered by 2026-10-27-validator-hardening-retro-design per
// DEC-20261028-04; the unattributed window ids stay flagged.)
  test('T-20261028-002 and T-20261028-010 resolve covered by their registered specs', () => {
    const { status, out } = runCoverage(['--json', '--since', '2026-10-28T02:02:01+09:00']);
    expect(status).toBe(0);
    const report = JSON.parse(out) as {
      tickets: Array<{ id: string; covered: boolean; specs: Array<{ id: string; status: string }> }>;
    };
    const byId = new Map(report.tickets.map((t) => [t.id, t]));
    expect(byId.get('T-20261028-002')!.covered).toBe(true);
    expect(byId.get('T-20261028-002')!.specs.map((s) => s.id))
      .toContain('2026-10-28-ticket-runner-mechanical-batch-design');
    expect(byId.get('T-20261028-010')!.covered).toBe(true);
    expect(byId.get('T-20261028-010')!.specs.map((s) => s.id))
      .toContain('2026-10-28-stub-frontmatter-backfill-design');
  }, 120_000);
});
