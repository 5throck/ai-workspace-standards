// tests/unit/legacy-shell-exclusion.test.ts
// @version 1.0.0
// Unit tests for PHASE 2.6 legacy shell-script exclusion logic.
// Tests the filtering pattern used in l3-to-variant-pipeline.ts.

import { describe, expect, it } from 'bun:test';

const LEGACY_SCRIPT_EXTENSIONS = new Set(['.ps1', '.sh', '.bat', '.cmd', '.sed']);

function isLegacyScript(targetPath: string): boolean {
  const ext = targetPath.split('.').pop()?.toLowerCase() ?? '';
  return LEGACY_SCRIPT_EXTENSIONS.has(`.${ext}`);
}

interface MockReconciledFile {
  targetPath: string;
  classification?: 'new' | 'modified' | 'identical' | 'conflict';
}

function filterLegacyScripts(files: MockReconciledFile[]): {
  kept: MockReconciledFile[];
  excluded: MockReconciledFile[];
} {
  const excluded: MockReconciledFile[] = [];
  const kept = files.filter(f => {
    if (isLegacyScript(f.targetPath)) {
      excluded.push(f);
      return false;
    }
    return true;
  });
  return { kept, excluded };
}

describe('isLegacyScript', () => {
  it('identifies .ps1 files', () => {
    expect(isLegacyScript('scripts/setup.ps1')).toBe(true);
  });

  it('identifies .sh files', () => {
    expect(isLegacyScript('scripts/deploy.sh')).toBe(true);
  });

  it('identifies .bat files', () => {
    expect(isLegacyScript('scripts/run.bat')).toBe(true);
  });

  it('identifies .cmd files', () => {
    expect(isLegacyScript('scripts/upgrade.cmd')).toBe(true);
  });

  it('identifies .sed files', () => {
    expect(isLegacyScript('scripts/patch.sed')).toBe(true);
  });

  it('does NOT flag .ts files', () => {
    expect(isLegacyScript('scripts/audit.ts')).toBe(false);
  });

  it('does NOT flag non-script files', () => {
    expect(isLegacyScript('docs/README.md')).toBe(false);
    expect(isLegacyScript('agents/pm.md')).toBe(false);
  });

  it('is case-insensitive for extensions', () => {
    expect(isLegacyScript('scripts/SETUP.PS1')).toBe(true);
    expect(isLegacyScript('scripts/Deploy.Sh')).toBe(true);
  });
});

describe('filterLegacyScripts', () => {
  const manifest: MockReconciledFile[] = [
    { targetPath: 'scripts/audit.ts', classification: 'new' },
    { targetPath: 'scripts/setup.ps1', classification: 'new' },
    { targetPath: 'scripts/deploy.sh', classification: 'modified' },
    { targetPath: 'agents/pm.md', classification: 'new' },
    { targetPath: 'scripts/run.bat', classification: 'new' },
    { targetPath: 'docs/scope.md', classification: 'new' },
  ];

  it('removes all legacy script files', () => {
    const { kept, excluded } = filterLegacyScripts(manifest);
    expect(excluded).toHaveLength(3);
    expect(kept).toHaveLength(3);
  });

  it('excluded files are only legacy scripts', () => {
    const { excluded } = filterLegacyScripts(manifest);
    for (const f of excluded) {
      expect(isLegacyScript(f.targetPath)).toBe(true);
    }
  });

  it('kept files are never legacy scripts', () => {
    const { kept } = filterLegacyScripts(manifest);
    for (const f of kept) {
      expect(isLegacyScript(f.targetPath)).toBe(false);
    }
  });

  it('returns empty arrays for empty input', () => {
    const { kept, excluded } = filterLegacyScripts([]);
    expect(kept).toHaveLength(0);
    expect(excluded).toHaveLength(0);
  });
});

describe('Feature C: variant .ts script carrying logic', () => {
  function shouldCarryScript(targetPath: string, classification?: string): boolean {
    if (!targetPath.startsWith('scripts/')) return false;
    if (classification === 'new' && targetPath.endsWith('.ts')) return true;
    return false;
  }

  it('carries .ts files with classification new', () => {
    expect(shouldCarryScript('scripts/safety-audit.ts', 'new')).toBe(true);
  });

  it('rejects .ts files with classification modified', () => {
    expect(shouldCarryScript('scripts/safety-audit.ts', 'modified')).toBe(false);
  });

  it('rejects .ts files with no classification', () => {
    expect(shouldCarryScript('scripts/safety-audit.ts', undefined)).toBe(false);
  });

  it('rejects .md files even with classification new', () => {
    expect(shouldCarryScript('scripts/SCRIPTS.md', 'new')).toBe(false);
  });

  it('rejects non-script paths', () => {
    expect(shouldCarryScript('docs/readme.md', 'new')).toBe(false);
  });
});
