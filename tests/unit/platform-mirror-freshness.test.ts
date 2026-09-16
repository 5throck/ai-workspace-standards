/**
 * Tests for lib/platform-mirror-freshness.ts (T-20260916-008).
 *
 * Pure comparison logic only — all fixtures are scratch dirs under
 * os.tmpdir(). The REAL templates/ tree is never touched: the parallel unit
 * runner must not stage or scan templates/ fixtures (the T-001 lesson).
 */
import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectMirrorFreshnessDrift,
  extractSkillVersion,
  PLATFORM_MIRROR_DIRS,
} from '../../scripts/lib/platform-mirror-freshness.ts';

const scratchRoots: string[] = [];

function makeScratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-freshness-test-'));
  scratchRoots.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchRoots) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

function writeSkill(base: string, mirror: string, skill: string, version: string | null): void {
  const dir = join(base, mirror, skill);
  mkdirSync(dir, { recursive: true });
  const versionLine = version === null ? '' : `version: "${version}"\n`;
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skill}\n${versionLine}---\nbody\n`);
}

describe('extractSkillVersion', () => {
  it('parses quoted and bare versions', () => {
    expect(extractSkillVersion('---\nname: x\nversion: "1.5.0"\n---\n')).toBe('1.5.0');
    expect(extractSkillVersion('---\nversion: 2.3.4\n---\n')).toBe('2.3.4');
  });
  it('returns null when absent or mid-line', () => {
    expect(extractSkillVersion('---\nname: x\n---\n')).toBeNull();
    expect(extractSkillVersion('see version: 1.2.3 in docs\n')).toBeNull();
  });
});

describe('collectMirrorFreshnessDrift', () => {
  it('reports drift when a shared skill version differs from the SSOT', () => {
    const root = makeScratch();
    const ssot = join(root, 'skills');
    const common = join(root, 'templates', 'common');
    writeSkill(ssot, '', 'upgrade-project', '1.5.0');
    writeSkill(common, '.claude/skills', 'upgrade-project', '1.4.1');
    const drift = collectMirrorFreshnessDrift({ ssotSkillsDir: ssot, commonDir: common });
    expect(drift).toEqual([
      { mirror: '.claude/skills', skill: 'upgrade-project', ssotVersion: '1.5.0', mirrorVersion: '1.4.1' },
    ]);
  });

  it('passes when all shared skills carry the SSOT version across all four mirrors', () => {
    const root = makeScratch();
    const ssot = join(root, 'skills');
    const common = join(root, 'templates', 'common');
    for (const skill of ['upgrade-project', 'sync']) {
      writeSkill(ssot, '', skill, '1.5.0');
      for (const mirror of PLATFORM_MIRROR_DIRS) writeSkill(common, mirror, skill, '1.5.0');
    }
    expect(collectMirrorFreshnessDrift({ ssotSkillsDir: ssot, commonDir: common })).toEqual([]);
  });

  it('skips L1-only skills (no SSOT counterpart) and versionless skills', () => {
    const root = makeScratch();
    const ssot = join(root, 'skills');
    const common = join(root, 'templates', 'common');
    writeSkill(common, '.claude/skills', 'decision-record', '1.0.0'); // L1-only asset
    writeSkill(ssot, '', 'no-version', null); // no version line
    writeSkill(common, '.gemini/skills', 'no-version', null);
    expect(collectMirrorFreshnessDrift({ ssotSkillsDir: ssot, commonDir: common })).toEqual([]);
  });

  it('tolerates a missing mirror dir and a missing SSOT dir', () => {
    const root = makeScratch();
    const common = join(root, 'templates', 'common');
    writeSkill(common, '.codex/skills', 'anything', '1.0.0'); // no skills/ SSOT at all
    expect(collectMirrorFreshnessDrift({ ssotSkillsDir: join(root, 'skills'), commonDir: common })).toEqual([]);
    expect(
      collectMirrorFreshnessDrift({ ssotSkillsDir: join(root, 'skills'), commonDir: join(root, 'nope') }),
    ).toEqual([]);
  });
});
