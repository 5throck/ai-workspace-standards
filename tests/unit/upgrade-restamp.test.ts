/**
 * Unit tests for helpers/upgrade-versions.ts bumpFrontmatterLastUpdated
 * (U-20261026-009) and the upgrade-policy lifecyclelessText tolerance that
 * pairs with it: the post-delivery re-stamp advances only the TOP-LEVEL
 * frontmatter `last_updated`, and the agents/ drift compare must ignore
 * bump-only date differences so the re-stamp never manufactures DRIFT on the
 * next upgrade (same tolerance agent-lifecycle-audit's isMetadataOnlyChange
 * implements).
 *
 * v1.1.0 (2026-10-29, spec docs/designs/2026-10-29-delivery-bookkeeping-engine-
 *          design.md, DEC-20261029-01 — PR1): bumpNestedLifecycleLastUpdated
 *          (A1) — the change-date re-stamp primitive for the nested
 *          `lifecycle:` block (mirrors bumpFrontmatterLastUpdated with
 *          inverted scope: nested key only, no injection, CRLF-safe,
 *          idempotent; the top-level key / last_reviewed / created / phase /
 *          governance are never touched); scaffoldChangelogEntry (A3) — the
 *          pure half of the opt-in --changelog-entry flag (insert at the top
 *          of the first [Unreleased] section, create the section when absent,
 *          idempotent per template version); engine re-stamp integration —
 *          version-gated delivery produces both stamps, and a delivered write
 *          invisible to git status (the honesty guard's clean-tree class) is
 *          re-stamped NEITHER at the top level NOR in the lifecycle block.
 *
 * @version 1.1.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';
import { bumpFrontmatterLastUpdated, bumpNestedLifecycleLastUpdated, scaffoldChangelogEntry } from '../../scripts/helpers/upgrade-versions.ts';
import { baselineKeyFor, lifecyclelessText } from '../../scripts/lib/upgrade-policy.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

const AGENT_MD = `---
name: Auditor
last_updated: 2026-09-01
tier: medium
lifecycle:
  phase: production
  created: 2026-05-29
  last_updated: 2026-08-15
  governance: docs/lifecycle/agents/auditor.md
---

## Role

Body text.
`;

describe('bumpFrontmatterLastUpdated (U-20261026-009)', () => {
  test('bumps a stale top-level date to the delivery date', () => {
    const res = bumpFrontmatterLastUpdated(AGENT_MD, '2026-10-27');
    expect(res.bumped).toBe(true);
    expect(res.text).toContain('last_updated: 2026-10-27');
    // The lifecycle-block date must stay untouched (no overreach).
    expect(res.text).toContain('  last_updated: 2026-08-15');
  });

  test('is idempotent when the date already equals the delivery date', () => {
    const once = bumpFrontmatterLastUpdated(AGENT_MD, '2026-10-27').text;
    const twice = bumpFrontmatterLastUpdated(once, '2026-10-27');
    expect(twice.bumped).toBe(false);
    expect(twice.text).toBe(once);
  });

  test('returns unchanged when there is no top-level last_updated key', () => {
    const noKey = '---\nname: X\nversion: 1.0.0\n---\n\nBody.\n';
    const res = bumpFrontmatterLastUpdated(noKey, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(noKey);
  });

  test('returns unchanged without a frontmatter block', () => {
    const plain = '# Just a heading\n\nNo frontmatter.\n';
    const res = bumpFrontmatterLastUpdated(plain, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(plain);
  });

  test('never touches a nested lifecycle-block date (no top-level key present)', () => {
    const onlyLifecycle = '---\nname: Y\nlifecycle:\n  last_updated: 2026-08-15\n---\n\nBody.\n';
    const res = bumpFrontmatterLastUpdated(onlyLifecycle, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(onlyLifecycle);
  });

  test('rejects a malformed date argument', () => {
    const res = bumpFrontmatterLastUpdated(AGENT_MD, 'not-a-date');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(AGENT_MD);
  });
});

describe('bumpNestedLifecycleLastUpdated (2026-10-29-delivery-bookkeeping-engine A1)', () => {
  test('advances only the nested lifecycle last_updated to the delivery date', () => {
    const res = bumpNestedLifecycleLastUpdated(AGENT_MD, '2026-10-29');
    expect(res.bumped).toBe(true);
    expect(res.text).toContain('  last_updated: 2026-10-29');
    // Inverted scope: the top-level key is NEVER touched by this primitive.
    expect(res.text).toContain('last_updated: 2026-09-01\n');
  });

  test('preserves every other lifecycle key and last_reviewed verbatim', () => {
    const withReviewed = AGENT_MD.replace('tier: medium\n', 'tier: medium\nlast_reviewed: 2026-07-31\n');
    const res = bumpNestedLifecycleLastUpdated(withReviewed, '2026-10-29');
    expect(res.bumped).toBe(true);
    expect(res.text).toContain('last_reviewed: 2026-07-31');
    expect(res.text).toContain('  phase: production');
    expect(res.text).toContain('  created: 2026-05-29');
    expect(res.text).toContain('  governance: docs/lifecycle/agents/auditor.md');
  });

  test('no-op when the lifecycle block is absent (never injects a block)', () => {
    const noBlock = '---\nname: X\nlast_updated: 2026-09-01\n---\n\nBody.\n';
    const res = bumpNestedLifecycleLastUpdated(noBlock, '2026-10-29');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(noBlock);
  });

  test('no-op when the block exists but has no last_updated key (never injects a key)', () => {
    const noKey = '---\nname: X\nlifecycle:\n  phase: production\n  created: 2026-05-29\n---\n\nBody.\n';
    const res = bumpNestedLifecycleLastUpdated(noKey, '2026-10-29');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(noKey);
  });

  test('no-op without a frontmatter block', () => {
    const plain = '# Just a heading\n\nNo frontmatter.\n';
    expect(bumpNestedLifecycleLastUpdated(plain, '2026-10-29')).toEqual({ text: plain, bumped: false });
  });

  test('is idempotent when the nested date already equals the delivery date', () => {
    const once = bumpNestedLifecycleLastUpdated(AGENT_MD, '2026-10-29').text;
    const twice = bumpNestedLifecycleLastUpdated(once, '2026-10-29');
    expect(twice.bumped).toBe(false);
    expect(twice.text).toBe(once);
  });

  test('preserves CRLF line endings', () => {
    const crlf = AGENT_MD.replace(/\n/g, '\r\n');
    const res = bumpNestedLifecycleLastUpdated(crlf, '2026-10-29');
    expect(res.bumped).toBe(true);
    expect(res.text).toContain('  last_updated: 2026-10-29\r\n');
    expect(res.text).toContain('last_updated: 2026-09-01\r\n');
    expect(res.text.split('\r\n').length).toBe(crlf.split('\r\n').length);
  });

  test('rejects a malformed date argument', () => {
    const res = bumpNestedLifecycleLastUpdated(AGENT_MD, '2026/10/29');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(AGENT_MD);
  });

  test('the two primitives compose: both stamps move in one pass over disjoint keys', () => {
    const top = bumpFrontmatterLastUpdated(AGENT_MD, '2026-10-29');
    const both = bumpNestedLifecycleLastUpdated(top.text, '2026-10-29');
    expect(both.bumped).toBe(true);
    expect(both.text).toContain('last_updated: 2026-10-29\n');
    expect(both.text).toContain('  last_updated: 2026-10-29');
  });
});

describe('scaffoldChangelogEntry (2026-10-29-delivery-bookkeeping-engine A3)', () => {
  const DATE = '2026-10-29';
  const VER = '0.24.0';
  const entry = (n: number, date = DATE, ver = VER): string =>
    `- **[${date}]**: chore(upgrade): template sync v${ver} (${n} file(s) delivered; engine-scaffolded — edit or merge before commit; see templates/CHANGELOG.md v${ver})`;

  test('inserts the entry at the top of the first [Unreleased] section', () => {
    const changelog = `# Changelog\n\n## [Unreleased]\n\n- existing curated bullet\n\n## [1.0.0] - 2026-10-01\n\n- released\n`;
    const res = scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: VER, deliveredCount: 42 });
    expect(res.changed).toBe(true);
    const lines = res.text.split('\n');
    const idx = lines.findIndex((l) => l === '## [Unreleased]');
    expect(lines[idx + 1]).toBe(entry(42));
    // The existing bullet stays below; historical sections untouched.
    expect(lines[idx + 3]).toBe('- existing curated bullet');
    expect(res.text).toContain('## [1.0.0] - 2026-10-01');
  });

  test('creates the [Unreleased] section after the title when absent', () => {
    const changelog = `# Changelog\n\n## [1.0.0] - 2026-10-01\n\n- released\n`;
    const res = scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: VER, deliveredCount: 3 });
    expect(res.changed).toBe(true);
    const lines = res.text.split('\n');
    const idx = lines.findIndex((l) => l === '## [Unreleased]');
    expect(idx).toBeGreaterThan(0);
    expect(lines[idx + 2]).toBe(entry(3));
    expect(res.text).toContain('## [1.0.0] - 2026-10-01');
  });

  test('is idempotent on a repeated template version (changed=false, text unchanged)', () => {
    const changelog = `# Changelog\n\n## [Unreleased]\n\n${entry(7)}\n- curated\n`;
    const res = scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: VER, deliveredCount: 9 });
    expect(res.changed).toBe(false);
    expect(res.text).toBe(changelog);
  });

  test('a DIFFERENT template version still scaffolds (per-version idempotency)', () => {
    const changelog = `# Changelog\n\n## [Unreleased]\n\n${entry(7)}\n`;
    const res = scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: '0.25.0', deliveredCount: 2 });
    expect(res.changed).toBe(true);
    expect(res.text).toContain('template sync v0.25.0');
    expect(res.text).toContain('template sync v0.24.0');
  });

  test('preserves CRLF line endings', () => {
    const changelog = '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n- curated\r\n';
    const res = scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: VER, deliveredCount: 1 });
    expect(res.changed).toBe(true);
    expect(res.text).toContain(`\r\n${entry(1)}\r\n`);
  });

  test('rejects a malformed date or empty template version', () => {
    const changelog = '# Changelog\n';
    expect(scaffoldChangelogEntry(changelog, { date: 'nope', templateVersion: VER, deliveredCount: 1 }).changed).toBe(false);
    expect(scaffoldChangelogEntry(changelog, { date: DATE, templateVersion: '', deliveredCount: 1 }).changed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Engine re-stamp integration (A1): version-gated delivery produces BOTH
// stamps (top-level + nested lifecycle); a delivered write that git status
// cannot see — the honesty guard's "tree stays clean" class (T-20261028-002
// deliveredRels ∩ git-dirty, inherited by A1) — produces NEITHER.
// ═════════════════════════════════════════════════════════════════════════════

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const AGENT_REL = 'agents/i18n-specialist.md';
// D9: the deliverable for the extends-stub i18n-specialist is the COMPOSED
// bytes (stub frontmatter over the L1 target) — the same fixture shape the
// decision-log suite uses.
const composedDeliverable = composeResolvedAgentContent(
  join(workspaceRoot, 'templates', VARIANT, 'agents', 'i18n-specialist.md'),
  join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md'),
  VARIANT,
).content;
const composedVersion = composedDeliverable.match(/^version:[ \t]*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
const today = new Date().toISOString().slice(0, 10);

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-restamp-'));
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

function commitAll(tmp: string, message: string): void {
  spawnSync('git', ['-C', tmp, 'add', '-A'], { stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', message], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

/** Seed the v2 manifest claiming `rel` was delivered with `baselineContent`
 *  at template 0.0.0 (same fixture shape as the decision-log suite). */
function seedPriorDelivery(tmp: string, rel: string, baselineContent: string): void {
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { schemaVersion: 2, timestamp: 'test', project: 'fixture', templateVersion: '0.0.0', templateSha: '', baseSha: '', files: [rel], baselines: {}, decisions: [] };
  manifest.schemaVersion = 2;
  manifest.baselines = manifest.baselines ?? {};
  manifest.baselines[rel] = { hash: baselineKeyFor(rel, baselineContent), templateVersion: '0.0.0' };
  if (!manifest.files.includes(rel)) manifest.files.push(rel);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

describe('upgrade-project.ts engine re-stamp (A1 integration)', () => {
  test('version-gated delivery advances BOTH the top-level and the nested lifecycle last_updated', () => {
    const tmp = makeTempProject();
    try {
      // Project copy at an older version with a project-owned lifecycle block
      // (the co-abap staleness shape: nested date frozen pre-delivery). The
      // baseline matches the copy, so the version-gt arm delivers cleanly.
      const stale = `---\nname: i18n-specialist\nversion: "1.0.0"\nlast_updated: 2026-09-01\nlifecycle:\n  phase: production\n  created: 2026-05-29\n  last_updated: 2026-08-15\n  governance: docs/lifecycle/agents/i18n-specialist.md\n---\n\nStale fixture body the delivery replaced.\n`;
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, AGENT_REL), stale);
      seedPriorDelivery(tmp, AGENT_REL, stale);
      commitAll(tmp, 'chore: stale agent fixture with a frozen lifecycle date');
      expect(composedVersion.length).toBeGreaterThan(0); // the version gate must be armed
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const after = readFileSync(join(tmp, AGENT_REL), 'utf8');
      // The composed delivery preserved the project lifecycle block
      // (preserveLifecycleFrontmatter) and the re-stamp advanced BOTH dates.
      expect(after.match(new RegExp(`^last_updated: ${today}$`, 'm'))).toBeTruthy();
      expect(after.match(new RegExp(`^  last_updated: ${today}$`, 'm'))).toBeTruthy();
      // The engine NEVER stamps a review date (DEC-20261029-01 condition 1):
      // the delivered last_reviewed line equals the template's own, verbatim.
      const tplReviewed = composedDeliverable.match(/^last_reviewed:.*$/m)?.[0] ?? '';
      expect(tplReviewed).toBeTruthy();
      expect(after).toContain(tplReviewed);
      // The delivery happened (version advanced from the 1.0.0 fixture).
      expect(after).not.toContain('Stale fixture body');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('a delivered write invisible to git status is re-stamped NEITHER top-level NOR nested (honesty guard)', () => {
    const tmp = makeTempProject();
    try {
      // The guard is the deliveredRels ∩ git-status intersection (T-20261028-002,
      // inherited by A1): a write that leaves the tree clean is never re-stamped.
      // Deterministic fixture for that class: the delivered path is gitignored,
      // so the delivery changes the bytes on disk while git status reports
      // nothing for it.
      const stale = `---\nname: i18n-specialist\nversion: "1.0.0"\nlast_updated: 2026-09-01\nlifecycle:\n  phase: production\n  last_updated: 2026-08-15\n---\n\nStale fixture body the template replaced.\n`;
      writeFileSync(join(tmp, '.gitignore'), `${AGENT_REL}\n`);
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, AGENT_REL), stale);
      seedPriorDelivery(tmp, AGENT_REL, stale);
      commitAll(tmp, 'chore: gitignored stale agent fixture');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      // The delivery itself DID happen (version-gt over a baseline-clean copy).
      expect(readFileSync(join(tmp, AGENT_REL), 'utf8')).not.toContain('Stale fixture body');
      // …but the re-stamp produced NEITHER stamp: no line carries the delivery
      // date (the top-level stays the stub's authoring date, the nested stays
      // the project's frozen date), and no re-stamp line names the path.
      const after = readFileSync(join(tmp, AGENT_REL), 'utf8');
      expect(after).not.toContain(`last_updated: ${today}`);
      expect(after.match(/^  last_updated: 2026-08-15$/m)).toBeTruthy();
      expect(out).not.toContain(`Re-stamped last_updated → ${today}: ${AGENT_REL}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);
});
