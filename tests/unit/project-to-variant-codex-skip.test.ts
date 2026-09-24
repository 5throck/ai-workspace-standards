/**
 * Regression test — platform-parity P1 bug 1 (shouldSkip misses .codex/skills).
 *
 * Spec: docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md (D1, D8 bug 1)
 *
 * Contract under test: project-to-variant.ts's shouldSkip must exclude
 * country-scoped skills from ALL FIVE skill bases (PLATFORM_SKILL_BASES —
 * skills/ SSOT + the four platform mirrors). Pre-fix only four roots were
 * covered and a scoped skill living in a source project's .codex/skills/
 * counted Variant-unique — it leaked into the promoted variant template.
 *
 * Fixture note: shouldSkip reads the scoped-skill registry from the REAL
 * workspace docs/workspace-schema.json (country_scoped_assets.skills), so the
 * fixture uses a registered name (k-dart) instead of a synthetic one.
 *
 * @version 1.0.0
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const promoteScript = join(workspaceRoot, 'scripts', 'project-to-variant.ts');
// Fresh target slot: must match ^co-[a-z][a-z0-9-]{1,30}$ and NOT exist under
// templates/ (the overlay guard refuses pre-existing targets).
const TARGET = 'co-zzregresscodexskip';

function makeTempSource(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'p2v-codex-skip-'));
  // One country-scoped skill (registered in docs/workspace-schema.json) whose
  // ONLY copy lives in the source project's .codex mirror.
  mkdirSync(join(tmp, '.codex', 'skills', 'k-dart'), { recursive: true });
  writeFileSync(
    join(tmp, '.codex', 'skills', 'k-dart', 'SKILL.md'),
    '---\nname: k-dart\ndescription: KR disclosure-scoped skill (fixture copy)\n---\n\n# k-dart fixture\n'
  );
  return tmp;
}

describe('project-to-variant.ts shouldSkip — .codex/skills scoped-skill exclusion (P1 bug 1)', () => {
  test('a scoped skill under .codex/skills/ is Skipped, not Variant-unique (dry-run)', () => {
    const tmp = makeTempSource();
    try {
      const result = spawnSync(
        'bun',
        [promoteScript, '--source', tmp, '--target', TARGET, '--dry-run'],
        { encoding: 'utf-8', timeout: 180000 }
      );
      if (result.status !== 0) {
        console.error('--- dry-run spawn failed ---');
        console.error('status:', result.status, 'signal:', result.signal, 'error:', result.error);
        console.error('stderr:', (result.stderr ?? '').slice(0, 3000));
        console.error('stdout:', (result.stdout ?? '').slice(0, 3000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';

      // The fixture's single file is the k-dart copy — it must land in the
      // Skipped bucket (count 1) and NOT be counted or listed Variant-unique.
      expect(out).toContain('Skipped         : 1');
      expect(out).toContain('Variant-unique  : 0');
      expect(out).not.toContain('[DRY] .codex/skills/k-dart/SKILL.md');

      // Dry-run must not have created the target slot.
      const targetDir = join(workspaceRoot, 'templates', TARGET);
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});
