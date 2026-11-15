/**
 * Integration test for upgrade-project.ts's TEMPLATE TREE SYNC pass
 * (2026-09-11-upgrade-policy-coverage-design.md): template files with no dedicated claiming
 * pass must now reach existing projects — the variant docs tree, .github/, platform
 * settings.json (JSON-merged), root stragglers — while project-owned files stay untouched.
 *
 * v1.1.0 (2026-09-24, scaffold identity overview — spec
 *         2026-09-24-scaffold-identity-overview-design.md §13): new IDENTITY SEED
 *         describe block — AC5a regression for upgrade-project's dedicated
 *         docs/project.md add-if-missing seed step (verdict style, TODO fallback
 *         survival, dry-run parity, AC4 never-overwrite).
 *
 * v1.2.0 (2026-09-24, platform-parity P1 bugs 3+4 — spec
 *         docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D3/D4/D8):
 *         new CODEX OVERWRITE GUARDS describe block — the VARIANT ASSET DIRS pass
 *         must skip the variant's top-level .codex/ (project .codex/** is
 *         ADD_IF_MISSING per upgrade-policy), and a divergent project CODEX.md
 *         must get no TEMPLATE TREE SYNC overwrite verdict (MERGE_MANAGED claim).
 *
 * v1.3.0 (2026-09-25, T-20260924-010/-011 — spec
 *         2026-09-25-codex-merge-claim-routing-design.md D4 rows 2+4): two new
 *         describe blocks. CODEX MERGE — an apply-mode upgrade merges a stale
 *         COMMON-CODEX zone into a customized project CODEX.md (byte-identical
 *         prose outside the zone, no overwrite verdict from any non-MERGE pass).
 *         VARIANT ASSET DIRS CLAIM ROUTING — a committed project edit under
 *         procedures/<owned-entry>/ is never overwritten by the asset-dir pass
 *         (the dedicated PROCEDURES pass owns the entry); a missing entry is
 *         still seeded NEW.
 *
 * v1.4.0 (2026-09-25, registry & platform-policy completeness batch — spec
 *         docs/designs/2026-09-25-registry-policy-completeness-design.md R4.5):
 *         new MCP JSON MERGE describe block — a project `.agents/mcp.json`
 *        carrying a project-only MCP server survives an apply-mode upgrade:
 *        both servers end up in the merged file, the preserved list names the
 *        project-only entry, and the template server arrives (design D6).
 *
 * @version 1.7.0
 * v1.7.0 (2026-11-15, engine-run + git-spawn consolidation — spec
 *         docs/designs/2026-11-15-windows-ci-test-speedup-design.md item 1):
 *         23 engine spawns → 18 and per-seed git spawns 5 → 2, with every
 *         expect() preserved verbatim (only fixture constants/variables
 *         re-pointed). (a) One git-seeded baseline project (init + config×2 +
 *         add + commit) built once at module scope; `freshFromBaseline()`
 *         cpSync-copies it per test so seeding costs one `add -A` + `commit`
 *         instead of a full repo-init + config×2 + add + commit. No-HEAD
 *         fixtures (dry-run NEW, identity AC5a-b/c/e — the dirty-tree guard
 *         and stash semantics depend on the absent HEAD) keep the original
 *         makeTempProject path. (b) Four dry-run scenes that asserted
 *         non-overlapping negative/positive lines (codex overwrite guards,
 *         codex MERGE dry parity, identity AC5a-d never-seed, .codex/
 *         config.toml silence) share ONE dry run on a combined project —
 *         every toContain/not.toContain line is per-path and disjoint. (c)
 *         The CODEX MERGE apply run and the .agents/mcp.json merge run share
 *         one apply project (disjoint paths). (d) The identity seed apply run
 *         is shared by AC5a-b and AC5a-c's first run (identical fixture).
 * v1.6.0 (2026-11-12, upgrade-policy v1.43.0): `.mcp.json` left TRAIL_RETIRED_SEEDS (trail 0.29
 *          stores its `trail mcp` server there). Migrated-shape test now asserts `.mcp.json` IS seeded
 *          (no retired-surface SEED_SKIP for it); new test: a `.trail/` project with an existing
 *          `.mcp.json` is JSON-merged, preserving a project-local extra server.
 * v1.5.1 (2026-11-01, spec 2026-10-31-graft-trail-migration-design R2.5 addendum):
 *          MCP JSON MERGE seed key graft → trail (template .mcp.json seed flipped to
 *          trail-era entries; merge mechanism under test unchanged).
 *
 * v1.5.0 (2026-10-31, design docs/designs/2026-10-31-graft-trail-migration-design.md
 *         R2.4/R5, U-20261031-009): TRAIL MIGRATION TOLERANCE describe block — the
 *         design's two acceptance fixtures. Migrated shape (`.trail/` marker +
 *         trail-rewritten settings): `.mcp.json` is NOT re-seeded (SEED_SKIP
 *         retired-surface in `.claude/last-upgrade-delivery.json`) and the
 *         template's graft-era hook entries are not merged (the hook-entry path
 *         guard, GUARD verdict line). Unmigrated shape (helper present): `.mcp.json`
 *         seeds and graft-era hooks merge exactly as before.
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

const SHARED_DIRS: string[] = [];
afterAll(() => {
  for (const d of SHARED_DIRS) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

// ── Shared git-seeded baseline (v1.7.0, design 2026-11-15 item 1) ────────────
// One committed baseline project (init + config×2 + add + commit) built ONCE;
// `freshFromBaseline()` cpSync-copies it per test, so seeding costs a single
// `add -A` + `commit` (2 git spawns) instead of a full 5-spawn init. The
// copy carries a real .git with one commit — the same HEAD-present semantics
// the old per-test seeds produced.
const BASELINE_DIR = mkdtempSync(join(tmpdir(), 'upgrade-tree-sync-baseline-'));
SHARED_DIRS.push(BASELINE_DIR);
spawnSync('git', ['init', '-q'], { cwd: BASELINE_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
git(BASELINE_DIR, 'config', 'user.email', 'test@example.com');
git(BASELINE_DIR, 'config', 'user.name', 'Test');
mkdirSync(join(BASELINE_DIR, '.claude'), { recursive: true });
writeFileSync(
  join(BASELINE_DIR, '.claude', 'template-version.txt'),
  `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
);
git(BASELINE_DIR, 'add', '-A');
git(BASELINE_DIR, 'commit', '-q', '-m', 'chore: baseline');

function freshFromBaseline(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tree-sync-'));
  cpSync(BASELINE_DIR, tmp, { recursive: true });
  return tmp;
}

/** The original no-HEAD fixture — kept ONLY for the tests whose assertions
 *  pin the absent-HEAD semantics (the dirty-tree guard skips the pre-upgrade
 *  rollback snapshot without a HEAD; an uncommitted identity seed must
 *  survive the run, and the identity-seed apply fixture relies on the same). */
function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tree-sync-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(
    join(tmp, '.claude', 'template-version.txt'),
    `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
  );
  return tmp;
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000 }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

// ── Shared engine runs (v1.7.0) ───────────────────────────────────────────────
// Three consolidated runs serving multiple tests; every consuming test keeps
// its own expect() lines verbatim, re-pointed at the shared result. Scenes on
// a shared project are path-disjoint so per-path output lines never collide.

const codexTemplatePathShared = join(workspaceRoot, 'templates', 'common', 'CODEX.md');
const CODEX_ZONE_RE = /<!-- COMMON-CODEX:START -->[\s\S]*?<!-- COMMON-CODEX:END -->/;
const CODEX_PROSE_SENTINEL = 'Project-owned intro line that must survive every upgrade.';

/** CODEX.md seeded from the live common template: stale zone interior + one
 *  project-owned prose line before the zone (the CODEX MERGE fixture shape). */
function seededProjectCodex(): string {
  const tpl = readFileSync(codexTemplatePathShared, 'utf8');
  const tplZone = tpl.match(CODEX_ZONE_RE)![0];
  const staleZone = tplZone.replace('Skill Resolution Priority', 'Skill Resolution Priority (STALE COPY)');
  expect(staleZone).not.toBe(tplZone);
  return tpl
    .replace(CODEX_ZONE_RE, () => staleZone)
    .replace('<!-- COMMON-CODEX:START -->', () => `${CODEX_PROSE_SENTINEL}\n\n<!-- COMMON-CODEX:START -->`);
}

/** ONE dry run carrying four path-disjoint scenes (v1.7.0):
 *  - .codex/prompts/security-check.md: project-owned divergent codex asset
 *    (overwrite guards — no VARIANT ASSET DIRS verdict),
 *  - CODEX.md: stale-zone + prose (codex MERGE dry parity — MERGE verdict,
 *    no overwrite verdict),
 *  - docs/project.md: user-edited (identity AC5a-d — no seed verdict),
 *  - .codex/config.toml: project copy (silent ADD_IF_MISSING — no verdict).
 *  Every consuming assertion is a toContain / not.toContain on a per-path
 *  line, so the combined output satisfies all four tests unchanged. */
let codexDryRun: { tmp: string; result: { status: number; out: string }; userProjectMd: string } | null = null;
function useCodexDryRun() {
  if (!codexDryRun) {
    const tmp = freshFromBaseline();
    mkdirSync(join(tmp, '.codex', 'prompts'), { recursive: true });
    writeFileSync(join(tmp, '.codex', 'prompts', 'security-check.md'),
      '# project-owned security prompt — local customization\n');
    const seededCodex = seededProjectCodex();
    writeFileSync(join(tmp, 'CODEX.md'), seededCodex);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    const userProjectMd = '# user-edited — Project Overview\n\n- **Description**: Our real description.\n- **Type**: api\n';
    writeFileSync(join(tmp, 'docs', 'project.md'), userProjectMd);
    mkdirSync(join(tmp, '.codex'), { recursive: true });
    writeFileSync(join(tmp, '.codex', 'config.toml'), '[features]\ncodex_hooks = true\n');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-q', '-m', 'chore: shared dry-run scenes (codex asset, CODEX.md, project.md, config.toml)');
    codexDryRun = { tmp, result: runUpgrade(tmp, ['--dry-run']), userProjectMd };
    SHARED_DIRS.push(tmp);
  }
  return codexDryRun;
}

/** ONE apply run carrying two path-disjoint scenes (v1.7.0): the CODEX MERGE
 *  fixture (stale zone refreshed by the MERGE pass) and the .agents/mcp.json
 *  project-only MCP server (JSON MERGE pass). Disjoint files, so the merged
 *  bytes and verdict lines of each scene are independent. */
let codexApplyRun: { tmp: string; result: { status: number; out: string }; seededCodex: string } | null = null;
function useCodexApplyRun() {
  if (!codexApplyRun) {
    const tmp = freshFromBaseline();
    const seededCodex = seededProjectCodex();
    writeFileSync(join(tmp, 'CODEX.md'), seededCodex);
    mkdirSync(join(tmp, '.agents'), { recursive: true });
    writeFileSync(join(tmp, '.agents', 'mcp.json'), JSON.stringify({
      mcpServers: {
        'project-only-server': {
          command: 'uvx',
          args: ['project-mcp', 'serve'],
        },
      },
    }, null, 2) + '\n');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-q', '-m', 'chore: shared apply scenes (CODEX.md, .agents/mcp.json)');
    codexApplyRun = { tmp, result: runUpgrade(tmp), seededCodex };
    SHARED_DIRS.push(tmp);
  }
  return codexApplyRun;
}

/** ONE apply run on a bare, no-HEAD project (v1.7.0): shared by identity
 *  AC5a-b (seed content assertions) and AC5a-c's first run (its second run
 *  continues on the same directory). */
let identityApplyRun: { tmp: string; result: { status: number; out: string }; seeded: string } | null = null;
function useIdentityApplyRun() {
  if (!identityApplyRun) {
    const tmp = makeTempProject();
    const result = runUpgrade(tmp);
    const seeded = readFileSync(join(tmp, 'docs', 'project.md'), 'utf8');
    identityApplyRun = { tmp, result, seeded };
    SHARED_DIRS.push(tmp);
  }
  return identityApplyRun;
}

describe('upgrade-project.ts TEMPLATE TREE SYNC', () => {
  test('dry-run reports NEW for uncovered docs and .github files and writes nothing', () => {
    // v1.7.0: baseline copy (committed, clean tree) — same NEW verdicts, no
    // per-test repo-init/config spawns.
    const tmp = freshFromBaseline();
    try {
      const result = runUpgrade(tmp, ['--dry-run']);

      expect(result.status).toBe(0);
      const out = result.out;
      expect(out).toContain('TEMPLATE TREE SYNC');
      expect(out).toContain('NEW    docs/user-guide.md');
      expect(out).toContain('NEW    .github/CODEOWNERS');
      expect(out).toContain('NEW    .editorconfig');
      // Dry-run must not have written anything.
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(false);
      expect(existsSync(join(tmp, '.github'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('apply run delivers uncovered files, preserves project-owned files, JSON-merges settings', () => {
    const tmp = freshFromBaseline();
    try {
      // Pre-seed project-owned state (files upgrade must never clobber)
      mkdirSync(join(tmp, 'docs', 'designs'), { recursive: true });
      writeFileSync(join(tmp, 'docs', 'README.md'), '# Custom project docs index\n');
      writeFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), '# Project-local design note\n');
      // Pre-seed platform settings with a project-only permission grant
      writeFileSync(join(tmp, '.claude', 'settings.json'), JSON.stringify({
        permissions: { allow: ['Bash(my-project-tool *)'] },
        projectFlag: true,
      }, null, 2) + '\n');

      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: pre-upgrade');

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      const out = result.out;
      expect(out).toContain('Tree-sync delivered');

      // Delivered: previously-uncovered template files now reach the project
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(true);
      expect(existsSync(join(tmp, 'docs', 'handoff-spec.md'))).toBe(true);
      expect(existsSync(join(tmp, '.github', 'CODEOWNERS'))).toBe(true);
      expect(existsSync(join(tmp, '.editorconfig'))).toBe(true);

      // Preserved: project-owned files untouched
      expect(readFileSync(join(tmp, 'docs', 'README.md'), 'utf8')).toBe('# Custom project docs index\n');
      expect(readFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), 'utf8')).toBe('# Project-local design note\n');

      // JSON-merged: template settings keys arrived, project-only entries survived.
      // co-develop ships its own .claude/settings.json (variant-first scaffold parity):
      // its allow entries are ['WebSearch(*)', 'WebFetch(*)'].
      const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
      expect(settings.projectFlag).toBe(true);
      expect(settings.permissions.allow).toContain('Bash(my-project-tool *)');
      expect(settings.permissions.allow).toContain('WebSearch(*)');
      expect(out).toContain('MERGE  .claude/settings.json');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});

// ============================================================================
// docs/context.md project-only preservation (T-20260912-001, upgrade-project v1.25.0)
// ============================================================================
describe('upgrade-project.ts docs/context.md CONTEXT PRESERVE gate', () => {
  const contextTemplatePath = join(workspaceRoot, 'templates', 'common', 'docs', 'context.md');
  const FOOTER_RE = /\n---\n\n\*context\.md version:[^*\n]*\*\s*$/;

  function seedProjectContext(tmp: string, content: string): void {
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'context.md'), content);
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-q', '-m', 'chore: seed context');
  }

  function templateWithOlderFooter(): string {
    // Project scaffolded one MINOR version behind the live template footer —
    // the version delta is what drives the SYNC branch's inline-version
    // comparison. Derived dynamically so template footer bumps (2.6 → 2.7 → …)
    // don't silently break the fixture (they did: the hardcoded 2.6→2.5 pair
    // stopped matching after the 2026-09-13 footer 2.7 bump).
    const tpl = readFileSync(contextTemplatePath, 'utf8');
    const m = tpl.match(/\*context\.md version: (\d+)\.(\d+)/);
    if (!m) throw new Error('cannot parse templates/common/docs/context.md version footer');
    const behind = `${m[1]}.${Number(m[2]) - 1}`;
    return tpl.replace(/\*context\.md version: \d+\.\d+/, `*context.md version: ${behind}`);
  }

  test('a. project-only section → PRESERVE (dry-run and apply), template NOT applied', () => {
    const tmp = freshFromBaseline();
    try {
      const tpl = templateWithOlderFooter();
      const footerMatch = tpl.match(FOOTER_RE);
      expect(footerMatch).not.toBeNull();
      const body = tpl.slice(0, footerMatch!.index);
      const footer = tpl.slice(footerMatch!.index);
      const seededContent = body + '\n\n## Project Only Section\nproject-specific content that must survive the upgrade\n' + footer;
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, 'docs', 'context.md'), seededContent);
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: seed context');

      // Dry-run must produce the identical PRESERVE verdict.
      const dry = runUpgrade(tmp, ['--dry-run']);
      expect(dry.status).toBe(0);
      expect(dry.out).toContain('CONTEXT PRESERVE docs/context.md');
      expect(dry.out).toContain('project-only: project only section');
      expect(dry.out).toContain('preserved — re-run with --force-context-sync');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(seededContent);

      // Apply run: file preserved byte-for-byte, template content NOT applied.
      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      expect(result.out).toContain('CONTEXT PRESERVE docs/context.md');
      expect(result.out).toContain('project-only: project only section');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(seededContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('b. --force-context-sync applies the template and logs the discarded sections', () => {
    const tmp = freshFromBaseline();
    try {
      const tpl = templateWithOlderFooter();
      const footerMatch = tpl.match(FOOTER_RE)!;
      const seededContent = tpl.slice(0, footerMatch.index)
        + '\n\n## Project Only Section\nproject-specific content that must survive the upgrade\n'
        + tpl.slice(footerMatch.index);
      seedProjectContext(tmp, seededContent);

      const result = runUpgrade(tmp, ['--force-context-sync']);
      expect(result.status).toBe(0);
      expect(result.out).toContain('FORCED OVERWRITE docs/context.md');
      expect(result.out).toContain('1 project-only section(s) discarded');

      // Template version applied: project-only section gone, footer back at template text.
      const applied = readFileSync(join(tmp, 'docs', 'context.md'), 'utf8');
      expect(applied).not.toContain('## Project Only Section');
      // Footer version asserted against the LIVE template (not a hardcoded
      // literal — the 2.6 pin broke on the 2026-09-13 footer 2.7 bump).
      const liveVersion = readFileSync(contextTemplatePath, 'utf8').match(/\*context\.md version: [^*\n]+\*/);
      expect(liveVersion).not.toBeNull();
      expect(applied).toContain(liveVersion![0]);
      // T-20260930-025: the copy renders the scaffold placeholder map — compare
      // against the RENDERED template ([Project Name] -> project dir basename,
      // <variant-name> -> variant), not the raw template bytes.
      const renderedTemplate = readFileSync(contextTemplatePath, 'utf8')
        .replace(/\[Project Name\]/g, require('node:path').basename(tmp))
        .replace(/<variant-name>/g, VARIANT)
        .replace(/`([^`]*)<variant>([^`]*)`/g, `\`$1${VARIANT}$2\``);
      expect(applied).toBe(renderedTemplate);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('c. no project-only content (drift inside shared sections) → UPDATE fires unchanged', () => {
    const tmp = freshFromBaseline();
    try {
      // Same shared headings as the template; only inline wording inside a shared
      // section drifted + footer is one version behind.
      const seededContent = templateWithOlderFooter().replace(
        '#### Schema Governance',
        '#### Schema Governance (local note)',
      );
      expect(seededContent).not.toBe(readFileSync(contextTemplatePath, 'utf8'));
      seedProjectContext(tmp, seededContent);

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      expect(result.out).not.toContain('CONTEXT PRESERVE');
      expect(result.out).toMatch(/UPDATE docs\/context\.md/);

      // The template version was applied (current pre-preservation behavior preserved),
      // with the scaffold placeholder map rendered (T-20260930-025).
      const renderedTpl = readFileSync(contextTemplatePath, 'utf8')
        .replace(/\[Project Name\]/g, require('node:path').basename(tmp))
        .replace(/<variant-name>/g, VARIANT)
        .replace(/`([^`]*)<variant>([^`]*)`/g, `\`$1${VARIANT}$2\``);
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(renderedTpl);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('d. project copy with no version footer → PRESERVE (wholeFileOwned)', () => {
    const tmp = freshFromBaseline();
    try {
      const tpl = readFileSync(contextTemplatePath, 'utf8');
      const footerMatch = tpl.match(FOOTER_RE)!;
      const noFooter = tpl.slice(0, footerMatch.index).trimEnd() + '\n';
      seedProjectContext(tmp, noFooter);

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      expect(result.out).toContain('CONTEXT PRESERVE docs/context.md');
      expect(result.out).toContain('(entire file — no version footer; treated as project-owned)');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(noFooter);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);
});

// ── IDENTITY SEED (AC5a regression — spec 2026-09-24-scaffold-identity-overview-design §13) ──
// The TEMPLATE TREE SYNC walk enumerates template-side files only, so docs/project.md can
// never be delivered by the upgrade-policy ADD_IF_MISSING claim (no template-side
// counterpart; docs/project.template.md stays TEMPLATE_ONLY). §13 added a dedicated
// add-if-missing seed step after that pass. These tests pin the seed contract: verdict
// style, TODO(project-overview) fallback survival (audit-WARN-visible per R4), dry-run
// write parity, and the AC4 never-overwrite guarantee.
describe('upgrade-project.ts IDENTITY SEED (docs/project.md, §13.2)', () => {
  test('AC5a-a: absent docs/project.md → dry-run prints the seed verdict, writes nothing', () => {
    const tmp = freshFromBaseline();
    try {
      const result = runUpgrade(tmp, ['--dry-run']);
      expect(result.status).toBe(0);
      expect(result.out).toContain('NEW    docs/project.md  (identity seed — add-if-missing)');
      expect(existsSync(join(tmp, 'docs', 'project.md'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('AC5a-b: apply run seeds docs/project.md with the TODO(project-overview) fallback intact', () => {
    // v1.7.0: rides the shared identity-seed apply run (identical bare, no-HEAD
    // fixture); AC5a-c's first run is this same run.
    const { result, seeded } = useIdentityApplyRun();
    expect(result.status).toBe(0);
    expect(result.out).toContain('NEW    docs/project.md  (identity seed — add-if-missing)');
    // applySubstitutions rendered the project name from basename(projectDir)…
    expect(seeded).not.toContain('[Project Name]');
    // …while the non-token TODO(project-overview) fallback lines survived untouched
    // (an undescribed seeded project lands in the audit-WARN-visible state R4 intends).
    expect(seeded).toContain('TODO(project-overview): [One-sentence description');
    expect(seeded).toContain('TODO(project-overview): [TBD]');
  }, 300000);

  test('AC5a-c: second run seeds nothing — no verdict, file byte-unchanged', () => {
    // v1.7.0: run 1 is the shared identity-seed apply run; only this test's
    // SECOND run remains a dedicated spawn.
    const { tmp, result: first, seeded } = useIdentityApplyRun();
    expect(first.status).toBe(0);
    expect(readFileSync(join(tmp, 'docs', 'project.md'), 'utf8')).toBe(seeded);

    const second = runUpgrade(tmp);
    expect(second.status).toBe(0);
    expect(second.out).not.toContain('(identity seed');
    expect(readFileSync(join(tmp, 'docs', 'project.md'), 'utf8')).toBe(seeded);
  }, 600000);

  test('AC5a-d: pre-existing user-edited docs/project.md is never written (AC4)', () => {
    // v1.7.0: rides the shared codex dry-run (its docs/project.md scene is
    // exactly this user-edited, committed fixture).
    const { tmp, result } = useCodexDryRun();
    const dest = join(tmp, 'docs', 'project.md');
    expect(result.status).toBe(0);
    expect(result.out).not.toContain('(identity seed');
    expect(readFileSync(dest, 'utf8')).toContain('Our real description.');
  }, 300000);
});

describe('upgrade-project.ts IDENTITY SEED — dirty-tree corner (§13.2 guard)', () => {
  test('AC5a-e: present-but-uncommitted docs/project.md is never seeded (dirty-tree guard)', () => {
    const tmp = makeTempProject();
    try {
      const dest = join(tmp, 'docs', 'project.md');
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      // Present but deliberately NOT committed (no HEAD in this fixture, so the
      // pre-upgrade rollback snapshot is skipped and the file stays on disk):
      // preUpgradeDirty carries the path, and isLocallyModified must keep the
      // seed off — AC4 holds for dirty trees, not just committed ones.
      writeFileSync(dest, '# user-edited uncommitted — Project Overview\n\n- **Description**: Uncommitted identity.\n- **Type**: web\n');
      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      expect(result.out).not.toContain('(identity seed');
      expect(readFileSync(dest, 'utf8')).toContain('Uncommitted identity.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

// ============================================================================
// CODEX OVERWRITE GUARDS (P1 bugs 3+4 — spec 2026-09-24-platform-parity-p1-bugfixes-design.md D3/D4/D8)
// The VARIANT ASSET DIRS pass must never treat the variant's top-level .codex/
// as a generic asset dir (project .codex/** is ADD_IF_MISSING, ADR-0076 D4), and
// a divergent project CODEX.md must get no TEMPLATE TREE SYNC overwrite verdict
// (CODEX.md joins MERGE_MANAGED_FILES — the MERGE pass owns delivery).
// ============================================================================
describe('upgrade-project.ts CODEX OVERWRITE GUARDS (P1 bugs 3+4)', () => {
  test('divergent project .codex file and CODEX.md get no overwrite verdicts (dry-run exits 0)', () => {
    // v1.7.0: rides the shared codex dry-run — its .codex/prompts/
    // security-check.md scene is this project-owned divergent asset and its
    // CODEX.md scene is a divergent project copy (stale-zone + prose form of
    // the same "project-divergent CODEX.md" state), so both negative verdicts
    // assert against one committed dry run.
    const { result } = useCodexDryRun();
    // Integration guard (D8): the full run must exit 0 — the skip-set change
    // must not disturb neighboring passes.
    expect(result.status).toBe(0);
    const out = result.out;

    // Bug 3: no VARIANT ASSET DIRS verdict for the project-owned .codex file.
    expect(out).not.toContain('UPDATE .codex/prompts/security-check.md');
    expect(out).not.toContain('COPIED: .codex/prompts/security-check.md');

    // Bug 4 (integration assert): no TEMPLATE TREE SYNC overwrite verdict for
    // the divergent project CODEX.md. (The MERGE pass still prints its own
    // "MERGE: CODEX.md" line — that is the owning pass, not an overwrite.)
    expect(out).not.toContain('UPDATE CODEX.md');
    expect(out).not.toContain('COPIED: CODEX.md');
  }, 300000);
});

// ============================================================================
// CODEX MERGE (T-20260924-010 — spec 2026-09-25-codex-merge-claim-routing-design.md D4 row 2)
// With the COMMON-CODEX pattern in MANAGED_PATTERNS, the MERGE pass delivers the
// template zone into project CODEX.md copies: stale zone refreshed from the
// template, prose outside the zone preserved byte-for-byte, no overwrite verdict
// from any pass other than MERGE.
// ============================================================================
describe('upgrade-project.ts CODEX MERGE (COMMON-CODEX zone — T-20260924-010)', () => {
  const codexTemplatePath = join(workspaceRoot, 'templates', 'common', 'CODEX.md');
  const ZONE_RE = CODEX_ZONE_RE;
  const PROSE_SENTINEL = CODEX_PROSE_SENTINEL;

  test('apply run merges the stale COMMON-CODEX zone; customized prose survives byte-identical', () => {
    // v1.7.0: rides the shared codex apply run (this file's CODEX.md scene is
    // exactly this fixture; the run also carries the path-disjoint
    // .agents/mcp.json merge scene — see the MCP JSON MERGE describe).
    const { tmp, result, seededCodex: seeded } = useCodexApplyRun();
    expect(result.status).toBe(0);
    const out = result.out;
    // The MERGE pass owns the file and delivered the zone union.
    expect(out).toContain('MERGE: CODEX.md');
    expect(out).toContain('MERGED COMMON-CODEX block in: CODEX.md');

    const applied = readFileSync(join(tmp, 'CODEX.md'), 'utf8');
    const tplZone = readFileSync(codexTemplatePath, 'utf8').match(ZONE_RE)![0];
    const projZone = seeded.match(ZONE_RE)![0];
    // Zone refreshed to the template's bytes…
    expect(applied.match(ZONE_RE)![0]).toBe(tplZone);
    expect(applied).not.toContain('(STALE COPY)');
    // …and the result is EXACTLY the seeded file with only the zone span
    // replaced — outside-zone prose byte-identical.
    expect(applied).toBe(seeded.replace(projZone, () => tplZone));
    expect(applied).toContain(PROSE_SENTINEL);
  }, 300000);

  test('no overwrite verdict for CODEX.md from any pass other than MERGE (holds pre- and post-fix)', () => {
    // v1.7.0: rides the shared codex dry-run (its CODEX.md scene is this
    // stale-zone committed fixture).
    const { result } = useCodexDryRun();
    expect(result.status).toBe(0);
    const out = result.out;
    expect(out).toContain('MERGE: CODEX.md');
    expect(out).not.toContain('UPDATE CODEX.md');
    expect(out).not.toContain('COPIED: CODEX.md');
  }, 300000);
});

// ============================================================================
// VARIANT ASSET DIRS CLAIM ROUTING (T-20260924-011 — spec 2026-09-25-codex-merge-claim-routing-design.md D4 row 4)
// The asset-dir pass must deliver only files whose resolveClaim pass is the
// VARIANT ASSET DIRS pass. procedures/** claims ADD_IF_MISSING on the dedicated
// PROCEDURES pass — a committed project edit under an owned procedure entry is
// never overwritten by the asset pass; a missing entry is still seeded NEW.
// ============================================================================
describe('upgrade-project.ts VARIANT ASSET DIRS claim routing (T-20260924-011)', () => {
  test('modified committed procedure file under an owned entry survives the upgrade', () => {
    const tmp = freshFromBaseline();
    try {
      // Seed procedures/ from the variant template, then:
      //  - architecture-design/schema.yaml: locally modified + committed (clean tree)
      //  - technical-planning/: left untouched (hash-equal)
      //  - security-release-retrospective/: deleted → the PROCEDURES pass must
      //    still seed it NEW (its add-if-missing contract).
      const tplProc = join(workspaceRoot, 'templates', VARIANT, 'procedures');
      mkdirSync(join(tmp, 'procedures'), { recursive: true });
      for (const entry of ['architecture-design', 'technical-planning', 'security-release-retrospective', '_output-types.yaml']) {
        const src = join(tplProc, entry);
        expect(existsSync(src)).toBe(true);
        cpSync(src, join(tmp, 'procedures', entry), { recursive: true });
      }
      const modifiedRel = join('procedures', 'architecture-design', 'schema.yaml');
      const modifiedContent = readFileSync(join(tmp, modifiedRel), 'utf8')
        + '\n# project-local workflow edit that must survive the upgrade\n';
      writeFileSync(join(tmp, modifiedRel), modifiedContent);
      rmSync(join(tmp, 'procedures', 'security-release-retrospective'), { recursive: true, force: true });
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: seeded procedures');

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      const out = result.out;

      // No asset-dir verdict for any procedures/ path — the modified file is
      // neither UPDATEd nor CONFLICT-reported nor COPIED by this pass.
      expect(out).not.toContain('UPDATE procedures/');
      expect(out).not.toContain('CONFLICT procedures/');
      expect(out).not.toContain('COPIED: procedures/');

      // The dedicated PROCEDURES pass reports the owned entries preserved…
      expect(out).toContain('OK     procedures/architecture-design/  (project-owned — preserved)');
      expect(out).toContain('OK     procedures/technical-planning/  (project-owned — preserved)');
      // …and still seeds the missing entry NEW.
      expect(out).toContain('NEW    procedures/security-release-retrospective/');
      expect(existsSync(join(tmp, 'procedures', 'security-release-retrospective'))).toBe(true);

      // Bytes: the committed project edit survived; the untouched entry is
      // hash-equal to the template (unchanged).
      expect(readFileSync(join(tmp, modifiedRel), 'utf8')).toBe(modifiedContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('positive control: a divergent unmodified generic-asset file still gets UPDATE + template content (co-design decisions/)', () => {
    // D4 row 5: proves the claim filter did not neuter the pass — files whose
    // claim pass IS the VARIANT ASSET DIRS pass keep the hash-sync semantics.
    const CONTROL_VARIANT = 'co-design';
    const tmp = freshFromBaseline();
    try {
      // Seed decisions/gates.yaml from the co-design template, diverge it
      // project-side, commit (clean tree → UPDATE, not CONFLICT).
      const rel = join('decisions', 'gates.yaml');
      const tplContent = readFileSync(join(workspaceRoot, 'templates', CONTROL_VARIANT, rel), 'utf8');
      mkdirSync(join(tmp, 'decisions'), { recursive: true });
      writeFileSync(join(tmp, rel), tplContent + '\n# project-side divergence that the pass must overwrite back\n');
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: diverged decisions file');

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', CONTROL_VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('UPDATE decisions/gates.yaml');
      expect(out).toContain('COPIED: decisions/gates.yaml');
      // Template content restored (the divergence was overwritten back).
      expect(readFileSync(join(tmp, rel), 'utf8')).toBe(tplContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

// ============================================================================
// MCP JSON MERGE (.agents/mcp.json — spec 2026-09-25-registry-policy-completeness-design.md R4.5)
// `.agents/mcp.json` joined JSON_MERGE_FILES in upgrade-policy v1.16.0 (design
// D6): a project-registered MCP server must survive upgrades (the former
// blanket `.agents` SYNC claim would have overwritten it), and the template
// seed's server must still arrive.
// ============================================================================
describe('upgrade-project.ts MCP JSON MERGE (.agents/mcp.json, registry completeness R4.5)', () => {
  test('apply-mode upgrade merges both MCP servers and logs the preserved project-only entry', () => {
    // v1.7.0: rides the shared codex apply run — its .agents/mcp.json scene is
    // exactly this project-only server registration (path-disjoint from the
    // CODEX.md merge scene on the same run).
    const { tmp, result } = useCodexApplyRun();
    expect(result.status).toBe(0);
    const out = result.out;

    // The merge verdict names the file and the preserved project-only entry.
    expect(out).toContain('MERGE  .agents/mcp.json');
    expect(out).toContain('preserved project-only: mcpServers.project-only-server');

    // Merged bytes: the project-only server survived AND the template seed's
    // graft server arrived.
    const merged = JSON.parse(readFileSync(join(tmp, '.agents', 'mcp.json'), 'utf8'));
    expect(merged.mcpServers['project-only-server']).toEqual({
      command: 'uvx',
      args: ['project-mcp', 'serve'],
    });
    expect(merged.mcpServers['trail']).toBeDefined();

    // No overwrite verdict from any pass for the file.
    expect(out).not.toContain('UPDATE .agents/mcp.json');
    expect(out).not.toContain('COPIED: .agents/mcp.json');
  }, 300000);

  test('dry-run: .codex/config.toml never appears with a verdict; a present project copy is silent', () => {
    // v1.7.0: rides the shared codex dry-run (its .codex/config.toml scene is
    // exactly this present project copy).
    const { tmp, result } = useCodexDryRun();
    expect(result.status).toBe(0);
    const out = result.out;
    // ADD_IF_MISSING on an existing file is a silent seed-only skip — no
    // config.toml verdict line of any kind in the run output.
    expect(out).not.toContain('config.toml');
    // …and the customized project bytes are untouched (dry-run writes nothing).
    expect(readFileSync(join(tmp, '.codex', 'config.toml'), 'utf8')).toBe('[features]\ncodex_hooks = true\n');
  }, 300000);
});

// ============================================================================
// TRAIL MIGRATION TOLERANCE (design docs/designs/2026-10-31-graft-trail-migration-
// design.md R2.4, U-20261031-009, upgrade-project v1.87.0): the two upgrade-pass
// conflict points `trail init` creates on a migrated project.
//   (a) JSON_MERGE hook-entry guard — template hook entries whose command
//       references a path absent from the project are not merged.
//   (b) Retired-seed guard — with `.trail/` present, graft-era seeds
//       (.mcp.json / graft helpers) are SEED_SKIP (retired-surface), never
//       re-seeded. Without the marker, behavior is unchanged.
// ============================================================================
describe('upgrade-project.ts TRAIL MIGRATION TOLERANCE', () => {
  /** Trail-rewritten settings shape (observed co-develop post-migration). */
  function writeTrailSettings(tmp: string): void {
    writeFileSync(join(tmp, '.claude', 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(my-project-tool *)'] },
      hooks: {
        SessionStart: [{
          matcher: '',
          hooks: [{ type: 'command', command: 'node .trail/hook.cjs' }],
        }],
      },
    }, null, 2) + '\n');
  }

  function readDecisionLog(tmp: string): Array<{ path: string; verdict: string; detail: string }> {
    const manifest = JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
    return manifest.decisions ?? [];
  }

  test('migrated shape (.trail/ present): graft helpers not re-seeded, .mcp.json seeded; no graft hook re-add', () => {
    const tmp = freshFromBaseline();
    try {
      mkdirSync(join(tmp, '.trail'), { recursive: true }); // the migration marker
      writeTrailSettings(tmp);
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: trail-migrated project');

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      const out = result.out;

      // (b) .mcp.json left the retired list (upgrade-policy v1.43.0): absent + .trail/ → seeded.
      expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
      const mcp = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
      expect(mcp.mcpServers.trail).toEqual({ command: 'trail', args: ['mcp'] });
      const decisions = readDecisionLog(tmp);
      expect(decisions.find((d) => d.path === '.mcp.json' && d.verdict === 'SEED_SKIP')).toBeUndefined();
      // The graft helpers stay retired.
      expect(existsSync(join(tmp, '.claude', 'helpers', 'graft-hooks.cjs'))).toBe(false);

      // (a) Hook-entry guard: the trail-rewritten hooks survive; the template's
      // graft-era hook entries (referencing the deleted helper) are not merged.
      const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
      expect(JSON.stringify(settings.hooks)).toContain('.trail/hook.cjs');
      expect(JSON.stringify(settings.hooks)).not.toContain('graft-hooks.cjs');
      expect(out).toContain('GUARD  .claude/settings.json');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('.trail/ project WITH an existing .mcp.json: merged (not overwritten), project-local server preserved', () => {
    const tmp = freshFromBaseline();
    try {
      mkdirSync(join(tmp, '.trail'), { recursive: true });
      writeTrailSettings(tmp);
      writeFileSync(join(tmp, '.mcp.json'), JSON.stringify({
        mcpServers: { 'my-local': { command: 'node', args: ['local.js'] } },
      }, null, 2) + '\n');
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: trail project with local mcp');

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      const mcp = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
      expect(mcp.mcpServers['my-local']).toEqual({ command: 'node', args: ['local.js'] });
      expect(mcp.mcpServers.trail).toEqual({ command: 'trail', args: ['mcp'] });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('unmigrated shape (no .trail/, helper present): .mcp.json is seeded and template no longer re-adds graft hooks', () => {
    const tmp = freshFromBaseline();
    try {
      // Pre-migration graft-era state: the helper shelf is present (no .trail/).
      mkdirSync(join(tmp, '.claude', 'helpers'), { recursive: true });
      writeFileSync(join(tmp, '.claude', 'helpers', 'graft-hooks.cjs'), '/* graft-era helper */\n');
      writeFileSync(join(tmp, '.claude', 'settings.json'), JSON.stringify({
        permissions: { allow: ['Bash(my-project-tool *)'] },
      }, null, 2) + '\n');
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'chore: pre-migration project');

      const result = runUpgrade(tmp);
      expect(result.status).toBe(0);
      const out = result.out;

      // .mcp.json seeded exactly as before the trail migration policy existed.
      expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
      expect(out).not.toContain('retired-surface');
      const decisions = readDecisionLog(tmp);
      expect(decisions.find((d) => d.path === '.mcp.json' && d.verdict === 'SEED_SKIP' && d.detail.includes('retired-surface'))).toBeUndefined();

      // The co-develop template carries no graft hook entries (U-20261113-011), so
      // none are merged even though the helper exists; the project-only permission
      // grant survives the union.
      const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
      expect(JSON.stringify(settings.hooks)).not.toContain('graft-hooks.cjs');
      expect(settings.permissions.allow).toContain('Bash(my-project-tool *)');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
