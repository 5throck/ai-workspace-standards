/**
 * Regression test — platform-parity P1 bug 5 (governance-l1 boundary transforms).
 *
 * Spec: docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md (D5, D8 bug 5)
 *
 * Contract under test: propagate-to-templates.ts --governance-l1 must replace
 * the L0-only "Workspace & Template Boundary Policy" with the project-applicable
 * "Project Boundary Policy" in ALL THREE platform docs:
 *   - CLAUDE.md: already worked (marker-pair branch) — pinned byte-identical.
 *   - GEMINI.md: the branch regex expected the pre-restructure orphan-END shape
 *     and silently stopped matching after the L0 marker-pair restructure.
 *   - CODEX.md: had NO branch at all (section lives inside the single
 *     COMMON-CODEX zone, matched heading-to-next-heading).
 * Plus the D5 fatal guard: if the workspace boundary heading survives any of
 * the three outputs, the transform must die() — never ship it silently.
 *
 * @version 1.0.0
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test, expect } from 'bun:test';
// propagate-to-templates.ts is import-safe: its run path is behind import.meta.main.
import { applyGovernanceTransforms } from '../../scripts/propagate-to-templates.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const l0 = (name: string): string => readFileSync(join(workspaceRoot, name), 'utf-8');
const l1 = (name: string): string => readFileSync(join(workspaceRoot, 'templates', 'common', name), 'utf-8');

const WORKSPACE_HEADING = 'Workspace & Template Boundary Policy';
const PROJECT_HEADING = 'Project Boundary Policy';

describe('governance-l1 pm-gateway-workflow.md retirement transforms (B-PGW)', () => {
  // Spec: docs/designs/2026-10-28-l0-only-governance-doc-cleanup-design.md §5.2
  // (DEC-20261028-05). The L1 delivery of docs/governance/agents/pm-gateway-workflow.md
  // is retired; T1-T6 retarget every pointer in the five GOVERNANCE_L1_FILES
  // renditions to delivered targets, and the post-transform guard dies() when any
  // pm-gateway-workflow.md FILE link survives (anchor-style references stay valid).

  const OLD_AGENTS_MANDATE =
    'policy summaries live in [`docs/governance/agents/pm-gateway-workflow.md`](docs/governance/agents/pm-gateway-workflow.md) — **Read it before dispatching specialists';
  const OLD_POINTER_TABLE =
    '> > PM Gateway phase protocol & ADR policy summaries → [`docs/governance/agents/pm-gateway-workflow.md`](docs/governance/agents/pm-gateway-workflow.md) ·';

  test('T1-T3 (AGENTS.md): mandate, permission-denial anchor, and roster pointer retarget to agents/pm.md', () => {
    const out = applyGovernanceTransforms(l0('AGENTS.md'), 'AGENTS.md');
    // T1 — the "Read it before" mandate becomes the L0-only statement + pm.md pointer.
    expect(out).toContain(
      'The detailed phase protocol, permission-denial procedure, and ADR-0078/0079/0080 policy summaries are workspace-root-only (L0) and are not delivered to projects; the core MUST policy in §3.1–§3.7 above plus [`agents/pm.md`](agents/pm.md) carry the project-applicable rules — **read them before dispatching specialists.**'
    );
    expect(out).not.toContain(OLD_AGENTS_MANDATE);
    // T2 — Permission Denial Protocol anchor retarget (anchor verified at pm.md).
    expect(out).toContain('[Permission Denial Protocol](agents/pm.md#permission-denial-protocol)');
    expect(out).not.toContain('docs/governance/agents/pm-gateway-workflow.md#38-permission-denial-protocol');
    // T3 — roster-detail pointer retarget.
    expect(out).toContain(
      '*Role boundaries: [`agents/pm.md`](agents/pm.md); dispatch-communication templates and specialist-roster detail are workspace-root-only (L0).*'
    );
    // No pm-gateway-workflow.md FILE link survives anywhere in the rendition.
    expect(out).not.toContain('pm-gateway-workflow.md');
  });

  test('T4/T5 (CLAUDE.md): pointer-table line → AGENTS.md §3 anchor, §3.1.3 detail → delivered hook', () => {
    const out = applyGovernanceTransforms(l0('CLAUDE.md'), 'CLAUDE.md');
    expect(out).toContain('> > PM Gateway phase protocol & ADR policy summaries → [`AGENTS.md` §3](AGENTS.md#3-pm-gateway-workflow) ·');
    expect(out).not.toContain(OLD_POINTER_TABLE);
    expect(out).toContain('`scripts/hooks/pm-dispatch-gate.ts`');
    expect(out).not.toContain('`docs/governance/agents/pm-gateway-workflow.md` §3.1.3');
    expect(out).not.toContain('pm-gateway-workflow.md');
    // The T4 anchor idiom is anchor-style — the guard must NOT flag it (the call
    // above returning is the assertion; pinned explicitly here).
    expect(out).toContain('AGENTS.md#3-pm-gateway-workflow');
  });

  test('T4/T5 (GEMINI.md): same shared replaces land in the GEMINI rendition', () => {
    const out = applyGovernanceTransforms(l0('GEMINI.md'), 'GEMINI.md');
    expect(out).toContain('> > PM Gateway phase protocol & ADR policy summaries → [`AGENTS.md` §3](AGENTS.md#3-pm-gateway-workflow) ·');
    expect(out).not.toContain(OLD_POINTER_TABLE);
    expect(out).toContain('`scripts/hooks/pm-dispatch-gate.ts`');
    expect(out).not.toContain('`docs/governance/agents/pm-gateway-workflow.md` §3.1.3');
    expect(out).not.toContain('pm-gateway-workflow.md');
  });

  test('T6 (HERMES.md): bootstrap protocol pointer retargets to AGENTS.md §3 and §5', () => {
    const out = applyGovernanceTransforms(l0('HERMES.md'), 'HERMES.md');
    expect(out).toContain('Full phase protocol and mandatory criteria: `AGENTS.md` §3 and §5.');
    expect(out).not.toContain('Full phase protocol: [`docs/governance/agents/pm-gateway-workflow.md`](docs/governance/agents/pm-gateway-workflow.md); mandatory criteria and plan format: `AGENTS.md` §5.');
    expect(out).not.toContain('pm-gateway-workflow.md');
  });

  test('CODEX.md (E8): zero pm-gateway-workflow.md references — no transform needed, guard clean', () => {
    const l0Codex = l0('CODEX.md');
    expect(l0Codex).not.toContain('pm-gateway-workflow');
    const out = applyGovernanceTransforms(l0Codex, 'CODEX.md');
    expect(out).not.toContain('pm-gateway-workflow');
  });

  test('fatal guard: an unmatched pm-gateway-workflow.md file link dies() instead of regenerating a dangling pointer', () => {
    // A pointer sentence the T1-T6 literals do not match (the B-7 regex-rot
    // class): the guard must fail loudly, never ship the stale file link.
    const doctored = l0('HERMES.md') + '\nSee docs/governance/agents/pm-gateway-workflow.md for details.\n';

    const originalExit = process.exit;
    let exitCode: number | undefined;
    (process as unknown as { exit: (code?: number) => never }).exit = ((code?: number) => {
      exitCode = code;
      throw new Error('__process_exit_sentinel__');
    }) as never;
    try {
      expect(() => applyGovernanceTransforms(doctored, 'HERMES.md'))
        .toThrow('__process_exit_sentinel__');
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });
});

describe('governance-l1 boundary transforms (P1 bug 5)', () => {
  test('GEMINI.md: workspace policy replaced in-place, marker pair intact, numbering preserved', () => {
    const out = applyGovernanceTransforms(l0('GEMINI.md'), 'GEMINI.md');
    expect(out).toContain(PROJECT_HEADING);
    expect(out).not.toContain(WORKSPACE_HEADING);
    // Numbering preserved via the captured heading number (### 6. on L0 today).
    expect(out).toMatch(/### 6\. Project Boundary Policy/);
    // Marker pair survives intact (the pre-restructure regex destroyed this shape).
    const starts = (out.match(/<!-- COMMON-GEMINI:START -->/g) ?? []).length;
    const ends = (out.match(/<!-- COMMON-GEMINI:END -->/g) ?? []).length;
    expect(starts).toBeGreaterThan(0);
    expect(starts).toBe(ends);
    // Project-applicable two-bullet semantics, same as the CLAUDE branch.
    expect(out).toContain('- **Strict Scope**: Work only within the current project directory.');
    expect(out).toContain('(docs/context.md#lifecycle-management)');
  });

  test('CODEX.md: workspace policy replaced in-place, next heading and numbering preserved', () => {
    const out = applyGovernanceTransforms(l0('CODEX.md'), 'CODEX.md');
    expect(out).toContain(PROJECT_HEADING);
    expect(out).not.toContain(WORKSPACE_HEADING);
    // Section numbering preserved (### 7. on L0 today) …
    expect(out).toMatch(/### 7\. Project Boundary Policy/);
    // …and the following section survives unharmed (heading-to-next-heading match).
    expect(out).toContain('### 8. Custom Command Error Recovery');
    // The Phase-A rewrite used to leave a doubled pointer in this section; the
    // literal replacement removes that artifact (design D5 note).
    expect(out).not.toContain('[docs/context.md](docs/context.md) and [docs/context.md](docs/context.md)');
    expect(out).toContain('- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.');
  });

  test('CLAUDE.md transform output stays identical to the shipped L1 copy (AC5 byte-preservation, date-normalized)', () => {
    // publishGovernanceL1 skips the write when transformed === existing
    // ("already in sync") — so this equality is exactly the AC5 guarantee that
    // --governance-l1 --apply leaves templates/common/CLAUDE.md byte-identical.
    // The `Last Updated: <date>` footer stamps the propagation day, so a run on
    // any later day would fail a raw byte-compare (T-20260916-013 class) —
    // normalize the stamp line on both sides; everything else stays byte-exact.
    const stripStamp = (t: string) => t.replace(/\*Last Updated: \d{4}-\d{2}-\d{2}[^]*/, '*Last Updated: <date>*');
    expect(stripStamp(applyGovernanceTransforms(l0('CLAUDE.md'), 'CLAUDE.md')))
      .toBe(stripStamp(l1('CLAUDE.md')));
  });

  test('fatal guard: a surviving workspace heading dies() instead of shipping silently', () => {
    // Doctored L0 shape the branch regexes cannot match (orphan END marker, no
    // START, no --- separator) — the exact silent-no-op failure mode bug 5
    // shipped with. The guard must turn it into a fatal error.
    const doctored = [
      '# GEMINI.md',
      '',
      '### 6. Workspace & Template Boundary Policy',
      '',
      '- **Strict CWD Isolation**: workspace-only rule that must never reach a scaffold.',
      '',
      '<!-- COMMON-GEMINI:END -->',
      '',
    ].join('\n');

    // die() calls process.exit — swap it for a throwing sentinel so the test
    // process survives and the exit code can be asserted.
    const originalExit = process.exit;
    let exitCode: number | undefined;
    (process as unknown as { exit: (code?: number) => never }).exit = ((code?: number) => {
      exitCode = code;
      throw new Error('__process_exit_sentinel__');
    }) as never;
    try {
      expect(() => applyGovernanceTransforms(doctored, 'GEMINI.md'))
        .toThrow('__process_exit_sentinel__');
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });
});
