// U-20261026-006: design-lint scan-root resolution (helpers/design-lint-roots.ts)
// consumed by audit.ts's checkDesignLint — a delivered schema whose scanRoots name
// workspace-root template paths (templates/co-design/playground/src) must not turn
// the variant's declared verification gate into a silent skip.
// U-20261028-014: validateDesignLintOverride pins the variant.json designLint
// block shape the per-variant override mechanism consumes.
import { describe, expect, test } from 'bun:test';
import { CONVENTIONAL_DESIGN_LINT_ROOTS, resolveDesignLintRoots, validateDesignLintOverride } from '../../scripts/helpers/design-lint-roots.ts';

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

describe('validateDesignLintOverride (U-20261028-014)', () => {
  test('minimal valid block: enabled only', () => {
    expect(validateDesignLintOverride({ enabled: false })).toEqual({
      ok: true,
      config: { enabled: false },
    });
  });

  test('full valid block carries scanRoots and allowlist verbatim', () => {
    expect(
      validateDesignLintOverride({ enabled: true, scanRoots: ['ui/src'], allowlist: ['#123456'] }),
    ).toEqual({
      ok: true,
      config: { enabled: true, scanRoots: ['ui/src'], allowlist: ['#123456'] },
    });
  });

  test('missing enabled is a named error (no partial-merge ambiguity)', () => {
    const result = validateDesignLintOverride({ scanRoots: ['./src'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('designLint.enabled');
  });

  test('non-boolean enabled is a named error', () => {
    const result = validateDesignLintOverride({ enabled: 'yes' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('"yes"');
  });

  test('wrong-typed scanRoots/allowlist are named errors', () => {
    for (const key of ['scanRoots', 'allowlist']) {
      const result = validateDesignLintOverride({ enabled: true, [key]: 'not-an-array' });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error).toContain(`designLint.${key}`);
    }
    const nonStrings = validateDesignLintOverride({ enabled: true, scanRoots: ['./ok', 42] });
    expect(nonStrings.ok).toBe(false);
  });

  test('non-object blocks are named errors', () => {
    for (const raw of [null, 'enabled', 42, ['enabled']]) {
      const result = validateDesignLintOverride(raw);
      expect(result.ok).toBe(false);
    }
  });

  test('unknown keys are tolerated (forward-compatible)', () => {
    const result = validateDesignLintOverride({ enabled: true, futureKey: { a: 1 } });
    expect(result.ok).toBe(true);
  });
});
