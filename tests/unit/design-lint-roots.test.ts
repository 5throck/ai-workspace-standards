// U-20261026-006: design-lint scan-root resolution (helpers/design-lint-roots.ts)
// consumed by audit.ts's checkDesignLint — a delivered schema whose scanRoots name
// workspace-root template paths (templates/co-design/playground/src) must not turn
// the variant's declared verification gate into a silent skip.
import { describe, expect, test } from 'bun:test';
import { CONVENTIONAL_DESIGN_LINT_ROOTS, resolveDesignLintRoots } from '../../scripts/helpers/design-lint-roots.ts';

function fixture(dirs: string[]): (p: string) => boolean {
  const set = new Set(dirs);
  return (p: string) => set.has(p);
}

describe('resolveDesignLintRoots (U-20261026-006)', () => {
  test('configured roots that exist win — no fallback', () => {
    const exists = fixture(['./playground/src', 'templates/co-design/playground/src']);
    const result = resolveDesignLintRoots(['templates/co-design/playground/src'], exists);
    expect(result).toEqual({
      status: 'scan',
      roots: ['templates/co-design/playground/src'],
      source: 'configured',
    });
  });

  test('workspace-root case: configured root exists, conventional root absent', () => {
    const exists = fixture(['templates/co-design/playground/src']);
    const result = resolveDesignLintRoots(['templates/co-design/playground/src'], exists);
    expect(result.status).toBe('scan');
    expect(result.source).toBe('configured');
  });

  test('THE INCIDENT: configured root is a workspace path, project-local playground exists — conventional fallback fires', () => {
    const exists = fixture(['./playground/src']);
    const result = resolveDesignLintRoots(['templates/co-design/playground/src'], exists);
    expect(result).toEqual({
      status: 'scan',
      roots: ['./playground/src'],
      source: 'conventional-fallback',
    });
  });

  test('fallback picks only the conventional roots that exist (src only)', () => {
    const exists = fixture(['./src']);
    const result = resolveDesignLintRoots([], exists);
    expect(result).toEqual({ status: 'scan', roots: ['./src'], source: 'conventional-fallback' });
  });

  test('skip names BOTH the configured roots and the conventional candidates', () => {
    const result = resolveDesignLintRoots(['templates/co-design/playground/src'], fixture([]));
    expect(result.status).toBe('skip');
    if (result.status !== 'skip') return;
    expect(result.message).toContain('templates/co-design/playground/src');
    for (const conv of CONVENTIONAL_DESIGN_LINT_ROOTS) {
      expect(result.message).toContain(conv);
    }
  });

  test('empty config with nothing on disk also skips explicitly', () => {
    const result = resolveDesignLintRoots([], fixture([]));
    expect(result.status).toBe('skip');
  });

  test('configured roots are filtered by existence, not taken wholesale', () => {
    const exists = fixture(['./playground/src', './src']);
    const result = resolveDesignLintRoots(['./missing/ui', './playground/src'], exists);
    expect(result).toEqual({
      status: 'scan',
      roots: ['./playground/src'],
      source: 'configured',
    });
  });
});
