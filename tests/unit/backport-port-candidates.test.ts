/**
 * Unit tests for the backport tooling of design
 * docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md:
 *
 * D5 — backport-diff v1.1.0: the five instruction files join the context
 * surface (surfaceFor), and every row gains the region-aware
 * `ownership` + `verdict` columns. The §5.1 matrix as refined per review
 * dispatch: NO_ACTION (in-sync) · REDELIVER (I1/agents-R1 template-vocabulary
 * deltas — the wave owns them) · PORT_CANDIDATE (project-authored deltas in
 * promotable ownership: project-asset surfaces, agents-R3 bodies, authored I3
 * free-form) · ADJUDICATE (I2, non-authored I3, ADAPTED I1 spans — the D2
 * census gates those replaces).
 *
 * D6 — upgrade-project --dry-run --port-candidates: the would-revert
 * inventory (engine e2e): JSON shape {schemaVersion, project, generatedAt,
 * templateVersion, sections: {conflict_bound, tombstone_candidates,
 * stub_composed_mismatches, adapted_span_candidates}, summary}; markdown
 * section rendering; apply-mode refusal; empty sections for a converged
 * project.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';
import {
  surfaceFor,
  projectAuthoredDelta,
  ownershipFor,
  verdictFor,
} from '../../scripts/backport-diff.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

// ═════════════════════════════════════════════════════════════════════════════
// D5 — surface widening
// ═════════════════════════════════════════════════════════════════════════════

describe('surfaceFor (D5 — the five instruction files join the context surface)', () => {
  test('AGENTS/GEMINI/CODEX/HERMES .md join CLAUDE.md on the context surface', () => {
    for (const rel of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md']) {
      expect(surfaceFor(rel)).toBe('context');
    }
  });

  test('the rest of the 5-surface mapping is unchanged (backward compatibility)', () => {
    expect(surfaceFor('skills/x/SKILL.md')).toBe('skills');
    expect(surfaceFor('.codex/skills/x/SKILL.md')).toBe('skills');
    expect(surfaceFor('scripts/helpers/x.ts')).toBe('helpers');
    expect(surfaceFor('scripts/x.ts')).toBe('scripts');
    expect(surfaceFor('agents/pm.md')).toBe('agents');
    expect(surfaceFor('docs/context.md')).toBe('context');
    expect(surfaceFor('docs/co-news.context.md')).toBe('context');
    expect(surfaceFor('docs/designs/x.md')).toBe('other');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D5 — verdict matrix (design §5.1 as refined)
// ═════════════════════════════════════════════════════════════════════════════

describe('verdictFor (D5 §5.1 matrix — the four pinned fixture classes)', () => {
  test('in-sync → NO_ACTION regardless of ownership', () => {
    for (const ownership of ['I3', 'I1', 'project-asset', 'agents-R3', 'I2:VARIANT-AGENTS']) {
      expect(verdictFor('in-sync', ownership, true)).toBe('NO_ACTION');
      expect(verdictFor('in-sync', ownership, false)).toBe('NO_ACTION');
    }
  });

  test('project-authored I3 span, project-ahead → PORT_CANDIDATE (the D4 backlog feed)', () => {
    expect(verdictFor('project-ahead', 'I3', true)).toBe('PORT_CANDIDATE');
    expect(verdictFor('project-only', 'I3', true)).toBe('PORT_CANDIDATE');
  });

  test('managed-zone template-ahead (template vocabulary, not authored) → REDELIVER (the wave owns it)', () => {
    expect(verdictFor('template-ahead', 'I1', false)).toBe('REDELIVER');
    expect(verdictFor('project-ahead', 'I1:COMMON-AGENTS', false)).toBe('REDELIVER');
  });

  test('adapted I1 span (project-authored content inside the zone) → ADJUDICATE (the D2 census gates it)', () => {
    expect(verdictFor('project-ahead', 'I1', true)).toBe('ADJUDICATE');
    expect(verdictFor('both-changed', 'I1:COMMON-AGENTS', true)).toBe('ADJUDICATE');
    expect(verdictFor('project-ahead', 'agents-R1', true)).toBe('ADJUDICATE');
    expect(verdictFor('template-ahead', 'agents-R1', false)).toBe('REDELIVER');
  });

  test('I2 project-state divergence and the else-bucket → ADJUDICATE (port-or-keep)', () => {
    expect(verdictFor('project-ahead', 'I2:VARIANT-AGENTS', true)).toBe('ADJUDICATE');
    expect(verdictFor('project-ahead', 'I3', false)).toBe('ADJUDICATE');
    expect(verdictFor('both-changed', 'project-asset', false)).toBe('ADJUDICATE');
    expect(verdictFor('template-ahead', 'agents-R3', false)).toBe('ADJUDICATE');
  });

  test('project-asset and agents-R3 promotable directions → PORT_CANDIDATE', () => {
    expect(verdictFor('project-ahead', 'project-asset', true)).toBe('PORT_CANDIDATE');
    expect(verdictFor('project-only', 'project-asset', false)).toBe('PORT_CANDIDATE');
    expect(verdictFor('project-ahead', 'agents-R3', true)).toBe('PORT_CANDIDATE');
  });
});

describe('projectAuthoredDelta + ownershipFor (D5 derivation)', () => {
  const counterpart = [
    '# AGENTS.md',
    '',
    '<!-- COMMON-AGENTS:START -->',
    'Language Policy zone content',
    '<!-- COMMON-AGENTS:END -->',
    '',
    '## §1 Heading',
    '',
    'template echo line',
  ].join('\n');

  test('a free-form project-authored line is I3-owned', () => {
    const head = `${counterpart}\nproject-authored dispatch row\n`;
    expect(ownershipFor('AGENTS.md', head, counterpart, null)).toBe('I3');
    const authored = projectAuthoredDelta(head, counterpart, null);
    expect(authored).toEqual(['project-authored dispatch row']);
  });

  test('authored content inside a managed zone carries the I1 region name (adapted I1 span)', () => {
    const head = [
      '# AGENTS.md',
      '',
      '<!-- COMMON-AGENTS:START -->',
      'project rewrote the zone interior',
      '<!-- COMMON-AGENTS:END -->',
      '',
      '## §1 Heading',
      '',
      'template echo line',
    ].join('\n');
    expect(ownershipFor('AGENTS.md', head, counterpart, null)).toBe('I1:COMMON-AGENTS');
    expect(verdictFor('project-ahead', ownershipFor('AGENTS.md', head, counterpart, null), true)).toBe('ADJUDICATE');
  });

  test('template-vocabulary drift (stale lines the base carried) is NOT authored', () => {
    const base = '# AGENTS.md\n\nold template wording\n## §1 Heading\n\ntemplate echo line\n';
    const head = '# AGENTS.md\n\n## §1 Heading\n\ntemplate echo line\n';
    // head vs counterpart delta = 'old template wording' — but the delivered
    // base carried it: stale template vocabulary, not project authorship.
    expect(projectAuthoredDelta(head, counterpart, base)).toEqual([]);
    expect(ownershipFor('AGENTS.md', head, counterpart, base)).toBe('I3');
  });

  test('agents/ frontmatter authored additions own agents-R1; body authored lines own agents-R3', () => {
    const agentTpl = '---\nname: pm\ntier: medium\n---\n\n## Role\n\nbody line\n';
    const headFm = '---\nname: pm\ntier: medium\ncustom-key: project-added\n---\n\n## Role\n\nbody line\n';
    expect(ownershipFor('agents/pm.md', headFm, agentTpl, null)).toBe('agents-R1');
    const headBody = `${agentTpl}project-authored body line\n`;
    expect(ownershipFor('agents/pm.md', headBody, agentTpl, null)).toBe('agents-R3');
  });

  test('non-instruction, non-agents surfaces are project-asset', () => {
    expect(ownershipFor('skills/x/SKILL.md', 'a\n', 'b\n', null)).toBe('project-asset');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D6 — --port-candidates engine e2e
// ═════════════════════════════════════════════════════════════════════════════

const agentsTemplate = readFileSync(
  existsSync(join(workspaceRoot, 'templates', VARIANT, 'AGENTS.md'))
    ? join(workspaceRoot, 'templates', VARIANT, 'AGENTS.md')
    : join(workspaceRoot, 'templates', 'common', 'AGENTS.md'),
  'utf8',
);

/** Adapted AGENTS.md + a duplicated COMMON-AGENTS block: the count-mismatch
 *  reconcile is census-blocked (CONFLICT ERROR) and the free-form edits land
 *  as EVOLVED_REGION rows — both sections of the D6 inventory. */
function adaptedWithMismatch(): string {
  const lines = agentsTemplate.split('\n');
  const s = lines.indexOf('<!-- COMMON-AGENTS:START -->');
  const e = lines.indexOf('<!-- COMMON-AGENTS:END -->');
  expect(s).toBeGreaterThanOrEqual(0);
  expect(e).toBeGreaterThan(s);
  return [
    ...lines.slice(0, e + 1),
    'project-authored prose between the duplicated blocks — port-candidates evidence',
    ...lines.slice(e + 1),
    ...lines.slice(s, e + 1),
    '',
    '## §9.2 Project Dispatch Table (project-authored)',
    '',
    '| task | agent |',
  ].join('\n');
}

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-port-candidates-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'config', 'user.email', 'test@example.com'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'config', 'user.name', 'Test'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(
    join(tmp, '.claude', 'template-version.txt'),
    `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
  );
  return tmp;
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string; stdout: string } {
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  // stdout and stderr stay SEPARATE: the port-candidates mode prints one
  // stderr notice before suppressing, so JSON consumers parse `stdout` only.
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}`, stdout: result.stdout ?? '' };
}

describe('D6 — --port-candidates (dry-run-only would-revert inventory)', () => {
  test('apply mode REFUSES the flag (Q3 — dry-run-only, never a silent no-op)', () => {
    const tmp = makeTempProject();
    try {
      const { status, out } = runUpgrade(tmp, ['--port-candidates']);
      expect(status).toBe(1);
      expect(out).toContain('dry-run-only report mode');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('JSON: co-design-shaped divergence lists conflict-bound + adapted-span candidates; exit 0', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, 'AGENTS.md'), adaptedWithMismatch());
      spawnSync('git', ['-C', tmp, 'add', '-A'], { stdio: ['ignore', 'pipe', 'pipe'] });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: adapted AGENTS.md'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const { status, stdout } = runUpgrade(tmp, ['--dry-run', '--port-candidates', '--json']);
      expect(status).toBe(0);
      const doc = JSON.parse(stdout) as {
        schemaVersion: number;
        project: string;
        sections: Record<string, Array<{ path: string; surface: string; trigger: string; disposition: string }>>;
        summary: Record<string, number>;
      };
      expect(doc.schemaVersion).toBe(1);
      expect(Object.keys(doc.sections).sort()).toEqual([
        'adapted_span_candidates',
        'conflict_bound',
        'stub_composed_mismatches',
        'tombstone_candidates',
      ]);
      // The census-blocked reconcile surfaces as conflict-bound…
      expect(doc.sections.conflict_bound.some((i) => i.path === 'AGENTS.md')).toBe(true);
      expect(doc.sections.conflict_bound.every((i) => i.disposition.length > 0)).toBe(true);
      // …and the free-form edits as adapted-span candidates (§4-mapping shape).
      expect(doc.sections.adapted_span_candidates.some((i) => i.path === 'AGENTS.md')).toBe(true);
      // Every item carries the §5.2 shape.
      for (const section of Object.values(doc.sections)) {
        for (const item of section) {
          expect(Object.keys(item).sort()).toEqual(['disposition', 'path', 'surface', 'trigger']);
        }
      }
      expect(doc.summary.errorCount).toBeGreaterThan(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('markdown renders the four section tables (operator view)', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, 'AGENTS.md'), adaptedWithMismatch());
      spawnSync('git', ['-C', tmp, 'add', '-A'], { stdio: ['ignore', 'pipe', 'pipe'] });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: adapted AGENTS.md'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const { status, out } = runUpgrade(tmp, ['--dry-run', '--port-candidates']);
      expect(status).toBe(0);
      expect(out).toContain('port-candidates — would-revert inventory');
      expect(out).toContain('## Conflict-bound');
      expect(out).toContain('## Tombstone candidates');
      expect(out).toContain('## Stub-composed mismatches');
      expect(out).toContain('## Adapted-span candidates');
      expect(out).toContain('nothing gates');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('a converged project yields EMPTY sections (no would-revert entries)', () => {
    const tmp = makeTempProject();
    try {
      // Template-faithful project: the first run delivers everything as NEW
      // (no conflict, no tombstone, no stub drift, no census divergence).
      writeFileSync(join(tmp, 'AGENTS.md'), agentsTemplate);
      spawnSync('git', ['-C', tmp, 'add', '-A'], { stdio: ['ignore', 'pipe', 'pipe'] });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: template-faithful'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const { status, stdout } = runUpgrade(tmp, ['--dry-run', '--port-candidates', '--json']);
      expect(status).toBe(0);
      const doc = JSON.parse(stdout) as { sections: Record<string, unknown[]>; summary: Record<string, number> };
      expect(doc.sections.conflict_bound).toEqual([]);
      expect(doc.sections.tombstone_candidates).toEqual([]);
      expect(doc.sections.stub_composed_mismatches).toEqual([]);
      expect(doc.sections.adapted_span_candidates).toEqual([]);
      expect(doc.summary.conflictBound).toBe(0);
      expect(doc.summary.adaptedSpanCandidates).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
