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
