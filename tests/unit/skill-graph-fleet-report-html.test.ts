/**
 * Tests for scripts/skill-graph-fleet-report.ts v2.5.0 (design
 * docs/designs/2026-11-23-skill-graph-history-report-design.md §5.2-§5.5)
 * — the auto-emitted HTML history dashboard:
 * buildHistoryModel (projection class counts, NEW/VANISHED pairwise replay,
 * gap derivation, transientAbsent annotation, date ordering),
 * scanSkillGraphTickets (folded `>-` / literal `|` / plain / quoted titles,
 * runnerFiled prefix, archive inclusion + live-wins dedupe, filename-derived
 * id, malformed-file skip), escapeHtml (entity + hostile-name coverage),
 * renderHistoryPage (CSP meta, zero external refs, data-block `</script`
 * purity, XSS fixture inert, determinism pin), parseArgs (--html/--no-html).
 * All fixtures are mkdtempSync workspaces — no real tickets/ or memory/
 * dependency.
 */

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildHistoryModel,
  deriveGaps,
  escapeHtml,
  extractTicketScalars,
  parseArgs,
  renderHistoryPage,
  scanSkillGraphTickets,
} from '../../scripts/skill-graph-fleet-report.ts';

/** Structural subset of the script's (unexported) Snapshot shape. */
interface FixtureSnapshot {
  date: string;
  projects: Record<string, { nodes: number; edges: number; skills: number }>;
  fleetPresence: Record<string, number>;
  missingFromProjects: Record<string, string[]>;
  jaccard: Record<string, number>;
  convergence?: {
    threshold: number;
    converged: string[];
    convergenceWithDivergence: Array<{ capability: string; hashes: Record<string, string[]> }>;
    hashUnknown: string[];
  };
}

function snap(date: string, opts?: Partial<FixtureSnapshot>): FixtureSnapshot {
  return {
    date,
    projects: { 'co-a': { nodes: 10, edges: 20, skills: 8 }, 'co-b': { nodes: 12, edges: 24, skills: 9 } },
    fleetPresence: { 'skill:x': 2, 'skill:y': 1 },
    missingFromProjects: { 'co-a': ['skill:z'], 'co-b': [] },
    jaccard: { 'co-a': 0.1, 'co-b': 0.2 },
    ...opts,
  };
}

const FLEET = {
  count: 3,
  members: ['co-a', 'co-b', 'co-c'],
  transientAbsent: ['co-c'],
};

describe('buildHistoryModel (projection §5.2)', () => {
  test('date ordering: out-of-order input yields an ascending series', () => {
    const model = buildHistoryModel(
      [snap('2026-01-10'), snap('2026-01-01'), snap('2026-01-05')],
      FLEET,
    );
    expect(model.series.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-05', '2026-01-10']);
    expect(model.latest.date).toBe('2026-01-10');
  });

  test('class counts are extracted from the latest snapshot convergence', () => {
    const model = buildHistoryModel(
      [
        snap('2026-01-01', {
          convergence: {
            threshold: 3,
            converged: ['skill:a', 'skill:b'],
            convergenceWithDivergence: [{ capability: 'skill:c', hashes: { h1: ['co-a'], h2: ['co-b'] } }],
            hashUnknown: ['skill:d'],
          },
        }),
      ],
      FLEET,
    );
    expect(model.series[0]?.classes).toEqual({ converged: 2, divergent: 1, unknown: 1 });
    expect(model.latest.convergence.converged).toEqual(['skill:a', 'skill:b']);
    expect(model.latest.convergence.convergenceWithDivergence[0]?.capability).toBe('skill:c');
    expect(model.latest.convergence.hashUnknown).toEqual(['skill:d']);
  });

  test('NEW/VANISHED pairwise replay across a 3-snapshot sequence', () => {
    const s1 = snap('2026-01-01', { fleetPresence: { 'skill:a': 2, 'skill:b': 1 } });
    const s2 = snap('2026-01-02', { fleetPresence: { 'skill:a': 2, 'skill:b': 1, 'skill:c': 2 } });
    const s3 = snap('2026-01-03', { fleetPresence: { 'skill:a': 2, 'skill:c': 2 } });
    const model = buildHistoryModel([s1, s2, s3], FLEET);
    expect(model.series[0]?.newSkills).toEqual([]);
    expect(model.series[0]?.vanishedSkills).toEqual([]);
    expect(model.series[1]?.newSkills).toEqual(['skill:c']);
    expect(model.series[1]?.vanishedSkills).toEqual([]);
    expect(model.series[2]?.newSkills).toEqual([]);
    expect(model.series[2]?.vanishedSkills).toEqual(['skill:b']);
  });

  test('gap derivation comes from the series, never hardcoded', () => {
    const model = buildHistoryModel(
      [snap('2026-01-01'), snap('2026-01-04'), snap('2026-01-06')],
      FLEET,
    );
    expect(model.gaps).toEqual([
      { from: '2026-01-02', to: '2026-01-03', days: 2 },
      { from: '2026-01-05', to: '2026-01-05', days: 1 },
    ]);
    expect(deriveGaps(['2026-02-01', '2026-02-02'])).toEqual([]); // adjacent days → no gap
  });

  test('transientAbsent annotates a member absent from the latest snapshot whose checkout is a pr/* branch', () => {
    const model = buildHistoryModel(
      // latest snapshot covers only co-a; co-c is transient-absent, co-b is a plain absentee
      [snap('2026-01-01', { projects: { 'co-a': { nodes: 1, edges: 2, skills: 3 } } })],
      FLEET,
    );
    const byName = Object.fromEntries(model.fleet.members.map((m) => [m.name, m.transientAbsent]));
    expect(byName).toEqual({ 'co-a': false, 'co-b': false, 'co-c': true });
    expect(model.fleet.count).toBe(3);
  });
});

describe('escapeHtml (XSS safety §5.2)', () => {
  test('entity coverage: & < > " \' all escaped', () => {
    expect(escapeHtml('a&b<c>d"e\'f')).toBe('a&amp;b&lt;c&gt;d&quot;e&#39;f');
  });

  test('hostile capability name renders inert (no raw payload survives)', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });
});

describe('scanSkillGraphTickets (ticket scan §5.3)', () => {
  function ticketStore(files: Record<string, string>): { live: string; archive: string; root: string } {
    const root = mkdtempSync(join(tmpdir(), 'sgfr-tickets-'));
    const live = join(root, 'live');
    const archive = join(live, 'archive');
    mkdirSync(archive, { recursive: true });
    for (const [name, content] of Object.entries(files)) writeFileSync(join(live, name), content);
    return { root, live, archive };
  }

  const FOLDED_TICKET = [
    'schemaVersion: 1',
    'id: T-20261123-005',
    'kind: manual',
    'title: >-',
    '  skill-graph: 22 capabilities diverged across fleet (19 drift / 3',
    '  fork-or-patch-classified) — delivery lag, not intent: route the 19 drift',
    '  capabilities to nightly redelivery and verify convergence at next snapshot',
    'priority: normal',
    'status: backlog',
  ].join('\n');

  test('folded >- title extracts across lines, full text, no indent residue; runnerFiled on the skill-graph: prefix', () => {
    const store = ticketStore({ 'T-20261123-005.yaml': FOLDED_TICKET });
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('T-20261123-005');
      expect(rows[0]?.title).toBe(
        'skill-graph: 22 capabilities diverged across fleet (19 drift / 3 fork-or-patch-classified) — delivery lag, not intent: route the 19 drift capabilities to nightly redelivery and verify convergence at next snapshot',
      );
      expect(rows[0]?.title.startsWith(' ')).toBe(false);
      expect(rows[0]?.runnerFiled).toBe(true);
      expect(rows[0]?.status).toBe('backlog');
      expect(rows[0]?.priority).toBe('normal');
      expect(rows[0]?.source).toBe('live');
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('literal | and quoted scalar titles extract; plain title matches case-insensitively', () => {
    const literal = ['id: T-20990101-001', 'title: |', '  skill-graph drift report', 'status: done', 'priority: low'].join('\n');
    const quoted = ["id: T-20990101-002", 'title: "Skill-Graph reconciliation notes"', 'status: done', 'priority: high'].join('\n');
    const store = ticketStore({ 'T-20990101-001.yaml': literal, 'T-20990101-002.yaml': quoted });
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      expect(rows.map((r) => r.id)).toEqual(['T-20990101-002', 'T-20990101-001']); // id descending
      expect(rows.find((r) => r.id === 'T-20990101-001')?.title).toBe('skill-graph drift report');
      expect(rows.find((r) => r.id === 'T-20990101-002')?.title).toBe('Skill-Graph reconciliation notes');
      expect(rows.find((r) => r.id === 'T-20990101-002')?.runnerFiled).toBe(false); // not the skill-graph: prefix
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('archive inclusion; live wins when the same id exists in both stores', () => {
    const liveFolded = FOLDED_TICKET.replace('id: T-20261123-005', 'id: T-20990101-003');
    const store = ticketStore({ 'T-20990101-003.yaml': liveFolded });
    writeFileSync(join(store.archive, 'T-20990101-003.yaml'), liveFolded.replace('status: backlog', 'status: done'));
    writeFileSync(join(store.archive, 'T-20990101-004.yaml'), 'id: T-20990101-004\ntitle: skill-graph archived only\nstatus: done\npriority: low\n');
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      const dup = rows.find((r) => r.id === 'T-20990101-003');
      expect(dup?.source).toBe('live');
      expect(dup?.status).toBe('backlog'); // the live copy's status
      expect(rows.find((r) => r.id === 'T-20990101-004')?.source).toBe('archive');
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('id falls back to the filename when the reader finds no id: field', () => {
    const store = ticketStore({ 'T-20990101-005.yaml': 'title: skill-graph filename-id fallback\nstatus: done\npriority: low\n' });
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('T-20990101-005');
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('flow-style single-line archived ticket (keys never start a line) is tolerated via filename id, not warned as malformed', () => {
    const flow =
      '{schemaVersion: 1,id: U-20261028-008,kind: manual,title: Upstream request from co-abap,priority: normal,status: done,attempts: 0,history: [{at: 2026-10-28T00:00:00Z,from: null,to: done}],error: null}';
    const store = ticketStore({});
    writeFileSync(join(store.archive, 'U-20261028-008.yaml'), flow);
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      // included with the filename id, then filtered out by the title match (no skill-graph mention)
      expect(rows.find((r) => r.id === 'U-20261028-008')).toBeUndefined();
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('non-matching title excluded; genuinely malformed file (no id anywhere, no title) skipped', () => {
    const store = ticketStore({
      'T-20990101-006.yaml': 'id: T-20990101-006\ntitle: unrelated delivery chore\nstatus: done\npriority: low\n',
      'not-a-ticket.yaml': 'description: just some notes\n',
    });
    try {
      const rows = scanSkillGraphTickets(store.live, store.archive);
      expect(rows.find((r) => r.id === 'T-20990101-006')).toBeUndefined();
      expect(rows.find((r) => r.id === 'not-a-ticket')).toBeUndefined();
    } finally {
      rmSync(store.root, { recursive: true, force: true });
    }
  });

  test('absent ticket directories → empty list, no error', () => {
    const root = mkdtempSync(join(tmpdir(), 'sgfr-absent-'));
    try {
      expect(scanSkillGraphTickets(join(root, 'nope'), join(root, 'nope', 'archive'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('extractTicketScalars skips nested structures (history:/upstream: blocks never leak their inner keys)', () => {
    const scalars = extractTicketScalars(FOLDED_TICKET + '\nhistory:\n  - at: x\n    from: null\n    to: review\n', ['id', 'title', 'status', 'priority']);
    expect(Object.keys(scalars).sort()).toEqual(['id', 'priority', 'status', 'title']);
  });
});

describe('renderHistoryPage (page shell §5.2)', () => {
  function pageFrom(fixtures: FixtureSnapshot[]): string {
    return renderHistoryPage(buildHistoryModel(fixtures, FLEET));
  }

  test('carries the CSP meta with script-src and zero external http(s) references', () => {
    const page = pageFrom([snap('2026-01-01')]);
    expect(page).toContain("default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    expect(page).not.toContain('http://');
    expect(page).not.toContain('https://');
  });

  test('JSON data block purity: no literal </script sequence inside the block', () => {
    const page = pageFrom([snap('2026-01-01')]);
    const start = page.indexOf('<script id="report-data"');
    expect(start).toBeGreaterThanOrEqual(0);
    const close = page.indexOf('</script>', start);
    const block = page.slice(start, close);
    expect(block).not.toContain('</script');
  });

  test('XSS fixture: a skill named <img src=x onerror=…> renders inert (escaped in the data block)', () => {
    const hostile = snap('2026-01-01', {
      fleetPresence: { '<img src=x onerror=alert(1)>': 2 },
      missingFromProjects: { 'co-a': ['<img src=x onerror=alert(1)>'] },
    });
    const page = pageFrom([hostile]);
    expect(page).not.toContain('<img');
    // the < of the payload is \u003c-escaped in the data block (a bare > in JSON text is inert)
    expect(page).toContain('\\u003cimg src=x onerror=alert(1)>');
  });

  test('a <script> payload as a capability name never appears raw in the document', () => {
    const hostile = snap('2026-01-01', { fleetPresence: { '<script>alert(1)</script>': 2 } });
    const page = pageFrom([hostile]);
    expect(page).not.toContain('<script>alert(1)');
    expect(page).not.toContain('alert(1)</script>'); // no premature closer injected by data
  });

  test('determinism: two renders of identical inputs are byte-identical (no wall-clock markers)', () => {
    const fixtures = [snap('2026-01-01'), snap('2026-01-02')];
    const a = pageFrom(fixtures);
    const b = pageFrom(fixtures);
    expect(a === b).toBe(true);
  });

  test('projection content lands in the data block: class counts, gaps and fleet coverage of the fixtures', () => {
    const page = pageFrom([snap('2026-01-01'), snap('2026-01-04')]);
    expect(page).toContain('"gaps":[{"from":"2026-01-02","to":"2026-01-03","days":2}');
    expect(page).toContain('"count":3');
    expect(page).toContain('"transientAbsent":true');
  });
});

describe('parseArgs (--html / --no-html surface §5.1)', () => {
  test('defaults: htmlPath null, noHtml false — emission ON by default', () => {
    const args = parseArgs([]);
    expect(args.htmlPath).toBeNull();
    expect(args.noHtml).toBe(false);
    expect(args.json).toBe(false);
    expect(args.snapshotDir).toBe(join('memory', 'skill-graph-metrics'));
  });

  test('--html <path> overrides the output path; --no-html sets the skip flag', () => {
    expect(parseArgs(['--html', '/tmp/x/page.html']).htmlPath).toBe('/tmp/x/page.html');
    expect(parseArgs(['--no-html']).noHtml).toBe(true);
  });

  test('--no-html wins over --html (both flags set; main() checks noHtml first)', () => {
    const args = parseArgs(['--html', '/tmp/x/page.html', '--no-html']);
    expect(args.htmlPath).toBe('/tmp/x/page.html');
    expect(args.noHtml).toBe(true);
  });

  test('v2.4.0 flags keep parsing; unknown arguments stay ignored', () => {
    const args = parseArgs(['--json', '--snapshot-dir', '/tmp/snaps', '--future-flag']);
    expect(args.json).toBe(true);
    expect(args.snapshotDir).toBe('/tmp/snaps');
    expect(args.help).toBe(false);
  });
});
