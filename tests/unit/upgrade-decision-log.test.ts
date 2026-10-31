/**
 * Engine integration tests for the sync-overwrite-policy delivery-decision
 * engine (T-20261027-004, spec docs/designs/2026-10-27-sync-overwrite-policy-
 * design.md): provenance baselines (D1), the disposition matrix (D2), the
 * unified decision log (D3), the --disposition flag, the non-zero exit on
 * ERROR dispositions, tombstones (U-20261028-001), the v1.4.0
 * delivery-bookkeeping rows, and --changelog-entry (A3). The pure-helper
 * suites live in tests/unit/upgrade-policy-decisions.test.ts (v2.0.0 split).
 *
 * v2.0.0 (2026-10-31, T-20261030-002 — spec
 *         docs/designs/2026-10-31-test-budget-split-design.md, stage 1 of 2):
 *         test-budget split PR 1 — budget HELD at 600 s (stage 2 lowers it to
 *         300 s only after one green win32 CI run shows the file total
 *         ≤ ~150 s). Three levers per the design:
 *         (1) the two pure-helper describes moved verbatim to
 *         tests/unit/upgrade-policy-decisions.test.ts v1.0.0 — engine growth
 *         can no longer drag them into the budgeted file's blast radius;
 *         (2) the nine engine describes dedupe onto a module-scoped per-shape
 *         fixture cache (`useShape`): the FIRST test with a given seeded
 *         project shape runs the engine once; other members assert their own
 *         rows/bytes against the shared run (read-only riders). 33 runUpgrade
 *         call sites → 17 engine spawns. The design's classification rule
 *         keeps own runs for the multi-step lifecycles (tombstone → clear →
 *         re-deliver; conflict → land → re-derive; scaffold → idempotent
 *         re-run) and the --dry-run refusal paths; pm.md and
 *         agents/i18n-specialist are the only co-develop stub paths, so
 *         same-path scenario states that need different bodies stay separate
 *         runs (the escalation matrix spreads its per-path states across
 *         architect/designer, which share the generic version-gt and
 *         equal-version arms). The --changelog-entry describe moved ahead of
 *         the stub suites so their wave-2 riders execute after the run they
 *         assert against (changelogWave2 accessor guards the order);
 *         (3) the v1.4.0 regression additions fold into their owning scenario
 *         runs — the T-20261028-014 tombstoned-baseline rider (T21) joins the
 *         honored-tombstone run, and every assertion text stays verbatim
 *         (only fixture paths/seed bytes moved). Fixture reuse preserves the
 *         documented spawn hygiene: fresh temp dir per shape, stdin pinned
 *         closed, pipes consumed (PR #1677 Windows handle fix).
 *
 * v1.1.0 (2026-10-28, U-20261028-001 — spec
 *         docs/designs/2026-10-28-delivery-tombstone-ownership-design.md):
 *         delivery tombstones (D1–D3) — absent+baseline TOMBSTONED (ERROR)
 *         skip + non-zero exit, --tombstone recording (entry persisted with
 *         reason, honored immediately), TOMBSTONED_SKIP (INFO) carry-through,
 *         the carry-forward rule minus delivered paths, --clear-tombstone →
 *         next run delivers as NEW with the entry gone, adopt-template cannot
 *         override a tombstone (D3b), --dry-run refusal of the tombstone
 *         flags, and the agents/ version-gt CONFLICT escalation + NO_BASELINE
 *         migration-window detail (D4).
 *
 * v1.2.0 (2026-10-28, T-20261028-010 — spec
 *         docs/designs/2026-10-28-stub-frontmatter-backfill-design.md): stub
 *         frontmatter scalar backfill — the STUB_FM_BACKFILL (INFO)
 *         severity-contract row and engine cases (temp project stub
 *         agents/pm.md without the scalars gets them backfilled from the
 *         template counterpart with the manifest row; a stub already carrying
 *         the fields is untouched with no row). The pure-helper cases moved to
 *         tests/unit/upgrade-policy-decisions.test.ts in v2.0.0.
 *
 * v1.3.0 (2026-10-28, T-20261028-013 — spec
 *         docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 *         D9): the stub-composed compare changes what "today's deliverable"
 *         means for the extends-stub i18n-specialist fixture — the agents/ pass
 *         now composes the stub over its L1 target (composeResolvedAgentContent)
 *         instead of comparing the bare target bytes, and the version gate reads
 *         the COMPOSED frontmatter (the stub version ladder).
 *
 * v1.4.0 (2026-10-29, spec docs/designs/2026-10-29-delivery-bookkeeping-engine-
 *         design.md, DEC-20261029-01 — PR1): (B1) the TOMBSTONE_CLEARED (INFO)
 *         retraction row — the existing clear → next-run-NEW regression gains
 *         row assertions, a glob-exactness engine case (non-matching tombstone
 *         + baseline entries survive the grant), and the pure tombstoneGuard
 *         no-fire pin (now in the pure-helper suite); (B2) the tombstones
 *         carry-forward prunes template-departed entries while
 *         template-present tombstones still survive; (D1) STUB_VERSION_DIVERGENCE
 *         (INFO) — a stub pinned at an older version than its template
 *         counterpart reports the divergence, an equal-version stub reports
 *         nothing.
 *
 * Engine suites spawn scripts/upgrade-project.ts against a temp project and
 * the real workspace templates (the established upgrade-tree-sync pattern).
 *
 * @version 2.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import {
  baselineKeyFor,
  manifestHasUnresolvedErrors,
  type DecisionBaseline,
} from '../../scripts/lib/upgrade-policy.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const PHASE_DEFS_REL = 'docs/phase-definitions.md';
// resolveTemplate semantics: the variant copy wins over common (co-develop ships its own).
const phaseDefsTemplate = existsSync(join(workspaceRoot, 'templates', VARIANT, PHASE_DEFS_REL))
  ? readFileSync(join(workspaceRoot, 'templates', VARIANT, PHASE_DEFS_REL), 'utf8')
  : readFileSync(join(workspaceRoot, 'templates', 'common', PHASE_DEFS_REL), 'utf8');

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-decision-log-'));
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
  // Windows handle hygiene (PR #1677 CI, run 40603661108): the engine spawns
  // its own bun grandchildren (skill-graph / VERSION_MANIFEST / snapshot /
  // provenance regenerations). Pin the child's stdin closed ('ignore') so no
  // git or bun subprocess can ever block on an inherited stdin handle, and
  // keep stdout/stderr as fully consumed pipes. spawnSync reaps the direct
  // child before returning; the engine's own grandchildren exit before it.
  // The file-level CI wall is handled by the test-runner per-file budget
  // override (scripts/test-runner.ts; the v2.0.0 fixture cache is what keeps
  // the spawn count at 17 — see the T-20261030-002 split design).
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

interface DeliveryManifest {
  schemaVersion: number;
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  tombstones?: Record<string, { hash: string; templateVersion: string; recordedAt: string; reason: string }>;
  decisions: Array<{ path: string; policy: string; pass: string; verdict: string; severity: string; baseline?: DecisionBaseline; detail: string }>;
}

function readManifest(tmp: string): DeliveryManifest {
  return JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
}

// ═════════════════════════════════════════════════════════════════════════════
// Engine integration (temp project × real templates)
// ═════════════════════════════════════════════════════════════════════════════

/** Seed a v2 manifest claiming `rel` was delivered with `baselineContent` at
 *  template 0.0.0 — the hand-crafted prior-delivery state the escalation
 *  fixtures classify against. */
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

/** The L1 file whose co-design deletion is the U-001 resurrection vector —
 *  delivered by the TEMPLATE TREE SYNC SYNC-absent branch. */
const WORKFLOWS_REL = 'docs/governance/agents/workflows.md';
const workflowsTemplate = readFileSync(join(workspaceRoot, 'templates', 'common', WORKFLOWS_REL), 'utf8');
const OLD_WORKFLOWS = `${workflowsTemplate.trimEnd()}\n<!-- prior delivery fixture -->\n`;

/** Seed a recorded tombstone for `rel` on top of its prior delivery baseline. */
function seedPriorTombstone(tmp: string, rel: string, baselineContent: string, reason = 'fixture: project ruled the file dead'): void {
  seedPriorDelivery(tmp, rel, baselineContent);
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.tombstones = manifest.tombstones ?? {};
  manifest.tombstones[rel] = {
    hash: manifest.baselines[rel].hash,
    templateVersion: '0.0.0',
    recordedAt: '2026-10-28',
    reason,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

// ── Escalation fixtures (shared by the per-shape seeds below) ────────────────
const OLD_DELIVERED = '# phase definitions — old delivered revision\n\nstale body the template no longer ships\n';
const OLD_PHASE_DEFS = OLD_DELIVERED;
const EVOLVED_PHASE_DEFS = '# phase definitions — project evolved\n\ncommitted project-side customization\n';
const commonAgentTpl = readFileSync(join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md'), 'utf8');
// D9 (T-20261028-013): for the extends-stub i18n-specialist, "today's
// deliverable" is the stub-composed bytes — the stub frontmatter (co-develop
// carries `phases: [5]`, version 1.1.0) merged over the L1 target — exactly
// what the scaffold wrote. The bare target bytes above are the pre-D9 shape.
const composedDeliverable = composeResolvedAgentContent(
  join(workspaceRoot, 'templates', VARIANT, 'agents', 'i18n-specialist.md'),
  join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md'),
  VARIANT,
).content;
// The post-delivery re-stamp (v1.74.0 top-level; v1.84.0 nested lifecycle
// block, A1) advances BOTH frontmatter `last_updated` stamps — the stub
// frontmatter carries a top-level one and the L1 target's lifecycle block
// carries the nested one. The engine stamps new Date().toISOString().slice(0, 10).
const deliveryDate = new Date().toISOString().slice(0, 10);
const restamped = (content: string): string =>
  content
    .replace(/^last_updated:.*$/m, `last_updated: ${deliveryDate}`)
    .replace(/^([ \t]+last_updated:).*$/m, `$1 ${deliveryDate}`);
// renderAgentTokens ([Project Name] → the project directory name) — the
// delivery expectation for the plain-agent fixtures (architect/designer carry
// the token; the i18n composed fixture does not).
const renderProjectTokens = (content: string, tmp: string): string =>
  content.replace(/\[Project Name\]/g, basename(tmp));

// D2 dedicated equal-version row (v2.0.0 fixture split): the equal-version and
// version-gt CONFLICT arms are generic per-rel, so the matrix spreads its
// per-path states across distinct agent files instead of paying one engine run
// per state on the same path. i18n-specialist stays the composed-stub fixture;
// architect (a plain co-develop agent) carries the equal-version and
// NO_BASELINE states; designer carries the stale-copy version-gt state. The
// co-develop templates carry no render tokens, so raw template bytes are the
// delivery expectation for both.
const architectTpl = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'agents', 'architect.md'), 'utf8');
const EVOLVED_ARCHITECT = architectTpl.replace(
  /^(---\r?\n[\s\S]*?\r?\n---)\r?\n[\s\S]*$/,
  '$1\n\n# Architect — project-evolved body\n\nCommitted project-side divergence the template never shipped.\n',
);
const ARCHITECT_SCAFFOLD_BASELINE = '---\nname: architect\nversion: "1.0.0"\n---\nold scaffold body\n';

const designerTpl = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'agents', 'designer.md'), 'utf8');
const STALE_DESIGNER = designerTpl.replace(/^(version:\s*"?[\d.]+"?)$/m, 'version: "1.0.0"');

// D4 fixture: the version-gt evolved body at an OLDER frontmatter version —
// the version-gt arm fires, and with the baseline equal to today's deliverable
// the OLD matrix row was EVOLVED (WARN) + deliver — D4 reclassifies it to
// CONFLICT (ERROR) regardless of templateChanged.
const EVOLVED_LOWER = `---\nname: i18n-specialist\nversion: "0.0.1"\ndomain: _shared\ntier: medium\n---\n\n# i18n Specialist — project-evolved body\n\nCommitted project-side divergence the template never shipped.\n`;

// Stub fixtures (the MERGE_MANAGED pm.md STUB branch — the only co-develop
// path that dead-ends in the skip arm, hence the only backfill/divergence
// surface; each stub body state needs its own project).
const counterpartStub = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'agents', 'pm.md'), 'utf8');
const counterpartVersion = counterpartStub.match(/^version:[ \t]*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
const makeStub = (version: string): string => [
  '---',
  'extends: ../../../agents/pm.md',
  'name: pm',
  `variant: ${VARIANT}`,
  `version: "${version}"`,
  'last_updated: "2026-09-01"',
  'status: active',
  'tier: medium',
  '---',
  '',
  '<!-- WORKSPACE-MANAGED: PM agent body. Content outside this block is preserved during project upgrades. -->',
  '## Role',
  '',
  'Fixture stub body line that stays project-owned.',
  '',
].join('\n');
const stalePmStub = (): string => [
  '---',
  'extends: ../../../agents/pm.md',
  'name: pm',
  `variant: ${VARIANT}`,
  'status: active',
  '---',
  '',
  '<!-- WORKSPACE-MANAGED: PM agent body. Content outside this block is preserved during project upgrades. -->',
  '## Role',
  '',
  'Fixture stub body line that stays project-owned.',
  '',
].join('\n');

// ── Per-shape fixture cache (v2.0.0 dedupe — the test-budget split) ──────────
// The design's classification rule: a test keeps its OWN full run only when it
// exercises a multi-step lifecycle the shared fixtures cannot express or a
// --dry-run refusal path; otherwise its unique value is the rows/manifest it
// inspects, and it rides the shared run of its shape. Members are READ-ONLY
// against the shared project — every assertion stays verbatim.

interface ShapeResult { tmp: string; status: number; out: string; manifest: DeliveryManifest }

const shapeCache = new Map<string, ShapeResult>();
const dirCache = new Map<string, string>();

/** The governance-seed CHANGELOG bytes — one const so the default-OFF rider
 *  (T29) and the dry-run refusal rider (T30) pin the same seed the shape
 *  writes. */
const GOVERNANCE_CHANGELOG_SEED = '# Changelog\n\n## [Unreleased]\n\n- curated project entry\n';

const SHAPES: Record<string, { args: string[]; setup: (tmp: string) => void }> = {
  // Members: delivery baselines (D1) ×2, absent-baseline degrade, changelog
  // default-OFF, stale-stub backfill. Fresh project + LICENSE + CHANGELOG
  // seeds + an evolved-never-delivered doc + a stale pm.md stub — every
  // member asserts its own per-path rows against this one plain run (exit 0:
  // SEED_SKIP/EVOLVED-WARN-overwrite/backfill are all non-ERROR).
  'fresh-governance': {
    args: [],
    setup: (tmp: string): void => {
      writeFileSync(join(tmp, 'LICENSE'), 'custom project license\n');
      writeFileSync(join(tmp, 'CHANGELOG.md'), GOVERNANCE_CHANGELOG_SEED);
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, PHASE_DEFS_REL), EVOLVED_PHASE_DEFS);
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), stalePmStub());
      commitAll(tmp, 'chore: fresh governance seeds (license, changelog, evolved doc, stale stub)');
    },
  },
  // Members: phase-definitions CONFLICT default-skip, workflows TOMBSTONED
  // (ERROR) candidate, architect equal-version CONFLICT, i18n version-gt
  // CONFLICT. One plain run carries all four ERROR rows (exit 1) — the D2
  // matrix rows are per-path.
  'conflict-matrix': {
    args: [],
    setup: (tmp: string): void => {
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, PHASE_DEFS_REL), EVOLVED_PHASE_DEFS);
      seedPriorDelivery(tmp, PHASE_DEFS_REL, OLD_DELIVERED);
      // The tombstone candidate: prior delivery recorded, file absent, NO
      // tombstone entry yet (recording is the operator's grant).
      seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), EVOLVED_LOWER);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', composedDeliverable);
      writeFileSync(join(tmp, 'agents', 'architect.md'), EVOLVED_ARCHITECT);
      seedPriorDelivery(tmp, 'agents/architect.md', ARCHITECT_SCAFFOLD_BASELINE);
      commitAll(tmp, 'chore: conflict matrix seeds (docs, tombstone candidate, agents)');
    },
  },
  // Members: phase-definitions adopt grant, tombstoned-path adopt refusal
  // (D3b), D4 version-gt adopt grant. Same conflict seeds as above but the
  // tombstone ENTRY is pre-recorded (TOMBSTONED_SKIP INFO — that is what
  // keeps exit 0 under --disposition adopt-template).
  'conflict-matrix-adopt': {
    args: ['--disposition', 'adopt-template'],
    setup: (tmp: string): void => {
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, PHASE_DEFS_REL), EVOLVED_PHASE_DEFS);
      seedPriorDelivery(tmp, PHASE_DEFS_REL, OLD_DELIVERED);
      seedPriorTombstone(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), EVOLVED_LOWER);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', composedDeliverable);
      commitAll(tmp, 'chore: adopt-matrix seeds (recorded tombstone, agent version-gt)');
    },
  },
  // Members: i18n untouched-drift heal (DRIFT_RESTORED WARN), architect
  // NO_BASELINE equal-version restore (migration-window detail), designer
  // stale-copy version-gt ADOPT, baselines carry-forward (template-departed
  // prune + PRESERVE retention), pm.md pinned-stub divergence. One plain run,
  // exit 0 (heals/ADOPT are WARN/INFO; nothing conflicts).
  'agent-heal-matrix': {
    args: [],
    setup: (tmp: string): void => {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      // Delivered-then-untouched content: the baseline hash matches the
      // project bytes exactly, so the file is UNTOUCHED — the canonical heal
      // keeps today's behavior (deliver), now with a WARN decision.
      const untouchedDrift = `${composedDeliverable.trimEnd()}\n<!-- drift marker: untouched since delivery -->\n`;
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), untouchedDrift);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', untouchedDrift);
      // Same frontmatter version as the template, evolved body, NO prior
      // manifest — the NO_BASELINE migration degrade of the overwrite policy.
      writeFileSync(join(tmp, 'agents', 'architect.md'), EVOLVED_ARCHITECT);
      // Baseline-clean copy at an OLDER delivered version → version-gated
      // ADOPT with a replaced baseline.
      writeFileSync(join(tmp, 'agents', 'designer.md'), STALE_DESIGNER);
      seedPriorDelivery(tmp, 'agents/designer.md', STALE_DESIGNER);
      // MERGE_MANAGED stub pinned BELOW its counterpart — STUB_VERSION_DIVERGENCE.
      writeFileSync(join(tmp, 'agents', 'pm.md'), makeStub('0.9.0'));
      // Baselines carry-forward seeds.
      seedPriorDelivery(tmp, 'docs/retired-never-shipped.md', 'content of a file the template no longer ships\n');
      seedPriorDelivery(tmp, 'agents/README.md', 'prior readme delivery bytes\n');
      commitAll(tmp, 'chore: agent heal matrix seeds (drift, no-baseline, stale copy, pinned stub)');
    },
  },
  // Members: recorded-tombstone honored skip (TOMBSTONED_SKIP INFO) + the
  // T-20261028-014 rider (the honored path retains its baseline across the
  // manifest rewrite).
  'tombstone-recorded': {
    args: [],
    setup: (tmp: string): void => {
      seedPriorTombstone(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
      commitAll(tmp, 'chore: prior delivery recorded');
    },
  },
};

const DIR_SHAPES: Record<string, () => string> = {
  // Members: the dry-run report (TOMBSTONED (ERROR) candidate + persists
  // nothing), the --dry-run tombstone-flag refusal, and the --tombstone
  // grant. Dry runs persist nothing, so all three share one seeded project —
  // declaration order matters: the dry-run report first (byte-identity of the
  // SEEDED manifest), the refusal next, the mutating grant LAST.
  'tombstone-candidate': (): string => {
    const tmp = makeTempProject();
    seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
    commitAll(tmp, 'chore: prior delivery recorded');
    return tmp;
  },
};

function useShape(name: string): ShapeResult {
  let shape = shapeCache.get(name);
  if (!shape) {
    const def = SHAPES[name];
    const tmp = makeTempProject();
    def.setup(tmp);
    const { status, out } = runUpgrade(tmp, def.args);
    shape = { tmp, status, out, manifest: readManifest(tmp) };
    shapeCache.set(name, shape);
  }
  return shape;
}

function useDir(name: string): string {
  let tmp = dirCache.get(name);
  if (!tmp) {
    tmp = DIR_SHAPES[name]();
    dirCache.set(name, tmp);
  }
  return tmp;
}

// The changelog lifecycle's SECOND wave doubles as the stub no-op fixture:
// before run 2 the lifecycle seeds a complete pm.md stub (version == the
// counterpart → no backfill, no divergence), so the stub FM and
// STUB_VERSION_DIVERGENCE suites assert their no-op rows against the same
// run. The lifecycle describe runs BEFORE the stub describes (declaration
// order); the accessor makes that dependency loud instead of silent.
let changelogWave2: ShapeResult | null = null;
function useChangelogWave2(): ShapeResult {
  if (!changelogWave2) {
    throw new Error('changelog wave-2 fixture not initialized — the --changelog-entry lifecycle describe must be declared before the stub suites (v2.0.0 fixture-cache order)');
  }
  return changelogWave2;
}

afterAll(() => {
  for (const shape of shapeCache.values()) rmSync(shape.tmp, { recursive: true, force: true });
  for (const tmp of dirCache.values()) rmSync(tmp, { recursive: true, force: true });
});

describe('upgrade-project.ts delivery baselines (D1)', () => {
  test('apply run writes a v2 manifest with baselines for delivered files', () => {
    const { tmp, status, manifest } = useShape('fresh-governance');
    expect(status).toBe(0);
    expect(manifest.schemaVersion).toBe(2);
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.files.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.baselines).length).toBeGreaterThan(0);
    // Every baseline hash equals the content key of the bytes on disk.
    for (const [rel, entry] of Object.entries(manifest.baselines)) {
      expect(existsSync(join(tmp, rel))).toBe(true);
      expect(baselineKeyFor(rel, readFileSync(join(tmp, rel), 'utf8'))).toBe(entry.hash);
      expect(entry.templateVersion.length).toBeGreaterThan(0);
    }
    // Decisions recorded with the full schema.
    expect(manifest.decisions.length).toBeGreaterThan(0);
    for (const d of manifest.decisions) {
      expect(typeof d.path).toBe('string');
      expect(typeof d.policy).toBe('string');
      expect(typeof d.pass).toBe('string');
      expect(typeof d.verdict).toBe('string');
      expect(['INFO', 'WARN', 'ERROR']).toContain(d.severity);
      expect(typeof d.detail).toBe('string');
    }
  }, 180000);

  test('decision-log completeness: NEW / SEED_SKIP verdicts for a fresh project', () => {
    const { manifest } = useShape('fresh-governance');
    // Pre-existing LICENSE → the GOVERNANCE add-if-missing seed must be
    // recorded as SEED_SKIP rather than staying silent.
    const seedSkip = manifest.decisions.find((d) => d.verdict === 'SEED_SKIP' && d.path === 'LICENSE');
    expect(seedSkip).toBeDefined();
    expect(seedSkip!.pass).toBe('GOVERNANCE FILES');
    // Uncovered template docs reach a fresh project as NEW.
    expect(manifest.decisions.some((d) => d.verdict === 'NEW' && d.path === 'docs/user-guide.md')).toBe(true);
  }, 180000);
});

describe('upgrade-project.ts CONFLICT disposition (D2 — the U-005 vector)', () => {
  test('default disposition: ERROR skip preserves the project copy and exits non-zero', () => {
    const { tmp, status, out, manifest } = useShape('conflict-matrix');
    expect(status).toBe(1);
    // The project copy is preserved byte-for-byte — no silent overwrite.
    expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(EVOLVED_PHASE_DEFS);
    expect(out).toContain('CONFLICT DISPOSITION (SKIP)');
    expect(out).toContain('DELIVERY CONFLICTS');
    expect(out).toContain('adjudicated-port');
    // The decision log carries the ERROR entry.
    const conflict = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL && d.verdict === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('ERROR');
    // D3.1: the manifest now blocks dev-sync step 3.9 auto-E5.
    expect(manifestHasUnresolvedErrors(manifest)).toBe(true);
  }, 180000);

  test('--disposition adopt-template delivers, logs ADOPT, exits 0, and re-baselines', () => {
    const { tmp, status, out, manifest } = useShape('conflict-matrix-adopt');
    expect(status).toBe(0);
    // The template copy landed.
    expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
    expect(out).toContain('DISPOSITION (adopt-template): docs/phase-definitions.md');
    expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
    const adopt = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL && d.verdict === 'ADOPT');
    expect(adopt).toBeDefined();
    // Re-baselined: the recorded hash equals the delivered bytes on disk.
    expect(manifest.baselines[PHASE_DEFS_REL].hash).toBe(baselineKeyFor(PHASE_DEFS_REL, phaseDefsTemplate));
  }, 180000);

  test('absent baseline degrades to today\'s behavior (overwrite, exit 0, decision logged)', () => {
    // No prior manifest entry for the evolved doc — the first run after the
    // policy lands (the fresh-governance shape seeds exactly that state).
    const { tmp, status, manifest } = useShape('fresh-governance');
    expect(status).toBe(0);
    // Today's behavior: the whole-content overwrite proceeds.
    expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
    const decision = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL);
    expect(decision).toBeDefined();
    expect(decision!.severity).not.toBe('ERROR');
    // And the delivery seeded the baseline for the next run.
    expect(manifest.baselines[PHASE_DEFS_REL].hash).toBe(baselineKeyFor(PHASE_DEFS_REL, phaseDefsTemplate));
  }, 180000);
});

describe('upgrade-project.ts agents/ equal-version escalation (D2 dedicated row)', () => {
  // Project body evolved at the template's equal version: the equal-version
  // drift arm reclassifies PROJECT_EVOLVED to CONFLICT (ERROR) — the D2
  // dedicated row. v2.0.0 fixture split: the equal-version state rides the
  // conflict-matrix run on agents/architect.md (generic per-rel arm — the
  // composed-stub i18n path carries the version-gt state in the same run).
  test('PROJECT_EVOLVED at equal version → ERROR skip preserves the project body', () => {
    const { tmp, status, out, manifest } = useShape('conflict-matrix');
    expect(status).toBe(1);
    expect(readFileSync(join(tmp, 'agents', 'architect.md'), 'utf8')).toBe(EVOLVED_ARCHITECT);
    expect(out).toContain('CONFLICT DISPOSITION (SKIP): agents/architect.md');
    const conflict = manifest.decisions.find((d) => d.path === 'agents/architect.md' && d.verdict === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('ERROR');
  }, 180000);

  test('baseline-clean equal-version drift still heals to canonical (DRIFT_RESTORED, WARN)', () => {
    const { tmp, status, manifest } = useShape('agent-heal-matrix');
    expect(status).toBe(0);
    // The drift is a body line appended after the frontmatter (the template
    // carries no body headings, so the marker cannot corrupt the frontmatter).
    // D9: "canonical" for the extends-stub i18n-specialist is the COMPOSED
    // bytes (stub frontmatter over the L1 target), so the baseline and the
    // expected delivery both use composedDeliverable.
    expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(restamped(composedDeliverable));
    const restored = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'DRIFT_RESTORED');
    expect(restored).toBeDefined();
    expect(restored!.severity).toBe('WARN');
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Delivery tombstones (U-20261028-001 D1–D3, spec
// docs/designs/2026-10-28-delivery-tombstone-ownership-design.md)
// ═════════════════════════════════════════════════════════════════════════════

describe('upgrade-project.ts delivery tombstones (U-20261028-001 D1–D3)', () => {
  function makeTombstoneProject(withTombstone = false): string {
    // The project deleted a previously delivered file: the prior manifest
    // carries its baseline, the working tree does not carry the file. Any
    // tombstone seed MUST land before commitAll — the engine's pre-upgrade
    // stash reverts uncommitted tracked changes, so an uncommitted seed would
    // not be seen by the run.
    const tmp = makeTempProject();
    seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
    if (withTombstone) {
      const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.tombstones = manifest.tombstones ?? {};
      manifest.tombstones[WORKFLOWS_REL] = {
        hash: manifest.baselines[WORKFLOWS_REL].hash,
        templateVersion: '0.0.0',
        recordedAt: '2026-10-28',
        reason: 'fixture: project ruled the file dead',
      };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
    commitAll(tmp, 'chore: prior delivery recorded');
    return tmp;
  }

  test('dry-run reports the TOMBSTONED candidate (ERROR) and persists nothing', () => {
    // v2.0.0: shares the tombstone-candidate dir with the refusal and grant
    // riders — dry-run persists nothing, so the seeded manifest must be
    // byte-identical after this run (this test runs FIRST in the shape).
    const tmp = useDir('tombstone-candidate');
    const seeded = readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8');
    const { status, out } = runUpgrade(tmp, ['--dry-run']);
    expect(status).toBe(1);
    expect(out).toContain(`TOMBSTONE (SKIP): ${WORKFLOWS_REL}`);
    expect(out).toContain('severity ERROR');
    expect(out).toContain(`confirm with --tombstone ${WORKFLOWS_REL}`);
    // Dry-run persists nothing: the seeded manifest is byte-identical.
    expect(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8')).toBe(seeded);
    expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
  }, 180000);

  test('apply: TOMBSTONED (ERROR) skips the delivery and exits non-zero', () => {
    const { tmp, status, out, manifest } = useShape('conflict-matrix');
    expect(status).toBe(1);
    // The deleted copy stays deleted — no silent resurrection.
    expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
    expect(out).toContain('DELIVERY CONFLICTS');
    expect(out).toContain('Tombstoned paths — how to proceed');
    const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED');
    expect(decision).toBeDefined();
    expect(decision!.severity).toBe('ERROR');
    expect(decision!.baseline?.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
    // D3.1: the ERROR blocks dev-sync step 3.9 auto-E5.
    expect(manifestHasUnresolvedErrors(manifest)).toBe(true);
    // No tombstone entry exists yet — recording is the operator's grant.
    expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
  }, 180000);

  test('--tombstone records the entry (reason, hash, recordedAt) and honors it immediately', () => {
    // v2.0.0: the mutating grant runs LAST on the shared tombstone-candidate
    // dir (after both dry-run riders) — the grant writes the entry this run.
    const tmp = useDir('tombstone-candidate');
    const { status, out } = runUpgrade(tmp, [
      '--tombstone', WORKFLOWS_REL,
      '--tombstone-reason', 'co-design merged PR #59 / Ruling 3 — un-adapted L0 copy',
    ]);
    expect(status).toBe(0);
    expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
    expect(out).toContain('TOMBSTONE (recorded)');
    const manifest = readManifest(tmp);
    const entry = manifest.tombstones?.[WORKFLOWS_REL];
    expect(entry).toBeDefined();
    expect(entry!.reason).toContain('Ruling 3');
    expect(entry!.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
    expect(entry!.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry!.templateVersion.length).toBeGreaterThan(0);
    const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED_SKIP');
    expect(decision).toBeDefined();
    expect(decision!.severity).toBe('INFO');
    expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
  }, 180000);

  test('recorded tombstone → TOMBSTONED_SKIP (INFO), path stays absent, entry carried forward', () => {
    const { status, out, manifest } = useShape('tombstone-recorded');
    expect(status).toBe(0);
    expect(out).toContain('tombstoned deletion honored');
    const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED_SKIP');
    expect(decision).toBeDefined();
    expect(decision!.severity).toBe('INFO');
    expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
    expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
  }, 180000);

  test('--clear-tombstone drops the entry; the next run delivers the path as NEW', () => {
    // Multi-step lifecycle (tombstone → clear → re-deliver): keeps its own
    // two runs per the split design's classification rule.
    const tmp = makeTombstoneProject(true);
    try {
      // Run 1: the grant drops the entry, but the still-recorded tombstone
      // governs THIS run — the path is skipped (INFO), nothing delivered.
      const first = runUpgrade(tmp, ['--clear-tombstone', 'docs/governance/**']);
      expect(first.status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest1 = readManifest(tmp);
      expect(manifest1.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(Object.keys(manifest1.tombstones ?? {}).length).toBe(0);
      expect(manifest1.baselines[WORKFLOWS_REL]).toBeUndefined();
      // B1 (v1.84.0): the retraction is auditable — one TOMBSTONE_CLEARED
      // (INFO) row naming the grant glob and the dropped paths, recorded via
      // the shipped baseline-drop semantics (94a390945), which this run's
      // entry+baseline absences pin.
      const clearedRow = manifest1.decisions.find((d) => d.verdict === 'TOMBSTONE_CLEARED');
      expect(clearedRow).toBeDefined();
      expect(clearedRow!.severity).toBe('INFO');
      expect(clearedRow!.path).toBe('docs/governance/**');
      expect(clearedRow!.detail).toContain(WORKFLOWS_REL);
      expect(clearedRow!.detail).toContain('docs/governance/**');
      expect(manifestHasUnresolvedErrors(manifest1)).toBe(false);
      // Land run 1 before run 2 — the engine's pre-upgrade stash reverts an
      // uncommitted prior wave, so the second wave must start from a commit.
      // Run 1 delivered the template tree, which configured the project's git
      // hooks (core.hooksPath) — unset it so the test's landing commit is not
      // blocked by the /sync-gated pre-commit hook (hook wiring is not under
      // test here).
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (tombstone cleared, path still absent)');
      // Run 2: no tombstone, no baseline → the guard cannot fire; the path
      // delivers as a normal NEW and a fresh baseline is written.
      const second = runUpgrade(tmp);
      expect(second.status).toBe(0);
      expect(readFileSync(join(tmp, WORKFLOWS_REL), 'utf8')).toBe(workflowsTemplate);
      const manifest2 = readManifest(tmp);
      expect(manifest2.decisions.some((d) => d.path === WORKFLOWS_REL && d.verdict === 'NEW')).toBe(true);
      expect(manifest2.baselines[WORKFLOWS_REL].hash).toBe(baselineKeyFor(WORKFLOWS_REL, workflowsTemplate));
      expect(Object.keys(manifest2.tombstones ?? {}).length).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('--clear-tombstone drop scope is glob-exact: non-matching tombstone + baseline entries survive', () => {
    // B1 (ii): a grant names a glob; entries outside it must survive BOTH the
    // tombstone carry-forward and the baseline reset. The survivor is a
    // template-PRESENT path no delivery pass ever claims (agents/README.md is
    // PRESERVE'd by the agents pass), so no natural clear event can touch it —
    // the entry's fate is decided purely by the grant's glob scope.
    const README_REL = 'agents/README.md';
    const tmp = makeTombstoneProject(true);
    try {
      seedPriorTombstone(tmp, README_REL, 'retired readme body\n', 'fixture: awaiting adjudication');
      commitAll(tmp, 'chore: readme tombstone fixture');
      const { status } = runUpgrade(tmp, ['--clear-tombstone', 'docs/governance/**']);
      expect(status).toBe(0);
      // Matching path: both entries dropped + the TOMBSTONE_CLEARED row.
      expect(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8')).toContain('TOMBSTONE_CLEARED');
      const manifest = readManifest(tmp);
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(manifest.baselines[WORKFLOWS_REL]).toBeUndefined();
      const cleared = manifest.decisions.filter((d) => d.verdict === 'TOMBSTONE_CLEARED');
      expect(cleared.length).toBe(1);
      expect(cleared[0]!.path).toBe('docs/governance/**');
      expect(cleared[0]!.detail).toContain(WORKFLOWS_REL);
      // Non-matching path: tombstone AND baseline survive intact.
      expect(manifest.tombstones?.[README_REL]).toBeDefined();
      expect(manifest.tombstones![README_REL]!.reason).toContain('awaiting adjudication');
      expect(manifest.baselines[README_REL]).toBeDefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('--disposition adopt-template cannot deliver a tombstoned path (D3b)', () => {
    const { tmp, status, manifest } = useShape('conflict-matrix-adopt');
    expect(status).toBe(0);
    expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
    const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL);
    expect(decision!.verdict).toBe('TOMBSTONED_SKIP');
    expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
  }, 180000);

  test('carry-forward: tombstones = (prior ∪ newly recorded) − paths delivered this run − template-departed entries (B2 prune symmetry)', () => {
    // Three tombstone states in one run: (a) workflows.md carries a BASELINE
    // only — absent again → TOMBSTONED (ERROR), no entry written (recording
    // needs the grant); (b) phase-definitions carries a tombstone + its copy
    // at the delivered baseline — the run DELIVERS it (UNTOUCHED + template
    // changed → ADOPT) and the natural clear event drops the entry; (c) a
    // retired procedures entry no pass walks — TEMPLATE-DEPARTED, so the B2
    // prune symmetry (v1.84.0, mirroring the baselines carry-forward) removes
    // it: the guard is reachable only from template-walking passes, the entry
    // is provably inert, and (d) a template-PRESENT tombstone (agents/
    // README.md — PRESERVE'd by the agents pass) survives.
    // Seeds land BEFORE commitAll (the pre-upgrade stash reverts uncommitted
    // tracked changes).
    const GHOST_REL = 'procedures/ghost-entry';
    const KEEP_REL = 'agents/README.md';
    const tmp = makeTempProject();
    seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
    seedPriorDelivery(tmp, PHASE_DEFS_REL, OLD_PHASE_DEFS);
    seedPriorDelivery(tmp, GHOST_REL, 'retired procedure entry\n');
    seedPriorDelivery(tmp, KEEP_REL, 'retired readme body\n');
    const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
    const seeded = JSON.parse(readFileSync(manifestPath, 'utf8'));
    seeded.tombstones = {
      [PHASE_DEFS_REL]: { hash: seeded.baselines[PHASE_DEFS_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: superseded' },
      [GHOST_REL]: { hash: seeded.baselines[GHOST_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: retired entry' },
      [KEEP_REL]: { hash: seeded.baselines[KEEP_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: firing-capable (template present)' },
    };
    writeFileSync(manifestPath, JSON.stringify(seeded, null, 2) + '\n');
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, PHASE_DEFS_REL), OLD_PHASE_DEFS);
    commitAll(tmp, 'chore: phase-definitions at its delivered baseline');
    try {
      // workflows.md fires TOMBSTONED (ERROR) — deliveries stand (exit 1).
      const { status } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest = readManifest(tmp);
      // Template-present entry survives the carry-forward (no clear grant —
      // prune and clear are different mechanisms; the prune is silent).
      expect(manifest.tombstones?.[KEEP_REL]).toBeDefined();
      // Template-departed entry pruned (B2) — the v1.3.0 "carried forward
      // verbatim" expectation flipped by the prune symmetry.
      expect(manifest.tombstones?.[GHOST_REL]).toBeUndefined();
      expect(manifest.tombstones?.[PHASE_DEFS_REL]).toBeUndefined();
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(manifest.decisions.some((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED')).toBe(true);
      // No grants ran — no TOMBSTONE_CLEARED rows (the prune is not a grant).
      expect(manifest.decisions.some((d) => d.verdict === 'TOMBSTONE_CLEARED')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--tombstone / --clear-tombstone are refused under --dry-run (apply-mode only)', () => {
    const tmp = useDir('tombstone-candidate');
    const { status, out } = runUpgrade(tmp, ['--dry-run', '--tombstone', WORKFLOWS_REL]);
    expect(status).toBe(1);
    expect(out).toContain('apply-mode only');
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// agents/*.md project-ownership escalation (U-20261028-001 D4)
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts agents/ version-gt escalation + NO_BASELINE detail (D4)', () => {
  test('version-gt over an evolved body with templateChanged=false → CONFLICT (ERROR), body preserved', () => {
    const { tmp, status, out, manifest } = useShape('conflict-matrix');
    expect(status).toBe(1);
    expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(EVOLVED_LOWER);
    expect(out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
    const conflict = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('ERROR');
    expect(conflict!.detail).toContain('regardless of templateChanged');
  }, 180000);

  test('--disposition adopt-template still grants the D4-conflicted agents/ delivery', () => {
    const { tmp, status, out } = useShape('conflict-matrix-adopt');
    expect(status).toBe(0);
    expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(restamped(composedDeliverable));
    expect(out).toContain('DISPOSITION (adopt-template): agents/i18n-specialist.md');
  }, 180000);

  test('NO_BASELINE equal-version restore keeps WARN but names the migration window', () => {
    // v2.0.0 fixture split: the NO_BASELINE state rides the agent-heal-matrix
    // run on agents/architect.md (a plain co-develop agent — no render tokens,
    // so raw template bytes are the canonical restore expectation); the arm
    // and its detail are generic per-rel.
    const { tmp, status, manifest } = useShape('agent-heal-matrix');
    expect(status).toBe(0);
    // The canonical restore proceeds (WARN degrade) — and the decision detail
    // names the migration window.
    expect(readFileSync(join(tmp, 'agents', 'architect.md'), 'utf8')).toBe(restamped(renderProjectTokens(architectTpl, tmp)));
    const restored = manifest.decisions.find((d) => d.path === 'agents/architect.md' && d.verdict === 'DRIFT_RESTORED');
    expect(restored).toBeDefined();
    expect(restored!.severity).toBe('WARN');
    expect(restored!.detail).toContain('baseline absent — verify this restore against project intent');
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Baselines carry-forward (T-20261028-014 — U-20261028-001 D4 integration
// defect): the manifest writer rebuilt `baselines` from the delivered set
// alone, dropping the provenance of every non-delivered path; the next run
// classified those NO_BASELINE and the agents/ equal-version arm degraded the
// designed CONFLICT (ERROR) into the §8 WARN-deliver — proven end-to-end by
// the co-design 0.22.1 canary. Fix under test: baselines = (prior ∪ freshly
// delivered) − paths delivered this run, --clear-tombstone also resets
// matched baselines, template-departed entries pruned.
// ═════════════════════════════════════════════════════════════════════════════

describe('upgrade-project.ts baselines carry-forward (T-20261028-014)', () => {
  /** The co-design canary shape: template content + the project-canonical
   *  `phases: [4]` frontmatter addition at the template's equal version —
   *  lifecycleless-different from both the deliverable and any prior
   *  delivered baseline → PROJECT_EVOLVED → CONFLICT (ERROR) skip. */
  const canaryEvolved = commonAgentTpl.replace(
    /^(version:\s*"?[\d.]+"?)$/m,
    `$1\nphases: [4]`,
  );
  const CANARY_REL = 'agents/i18n-specialist.md';
  const DELIVERED_THEN = '---\nname: i18n-specialist\nversion: "1.0.0"\n---\nold delivered body the project later evolved past\n';

  test('conflict-skipped path retains its baseline — rerun re-derives CONFLICT (ERROR), not NO_BASELINE WARN-deliver', () => {
    // Multi-step lifecycle (conflict → land → re-derive): keeps its own two
    // runs per the split design's classification rule.
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, CANARY_REL), canaryEvolved);
      seedPriorDelivery(tmp, CANARY_REL, DELIVERED_THEN);
      commitAll(tmp, 'chore: committed project-canonical phases frontmatter');
      // Run 1 — the conflict-skip run (the 0.22.1 canary apply).
      const first = runUpgrade(tmp);
      expect(first.status).toBe(1);
      expect(readFileSync(join(tmp, CANARY_REL), 'utf8')).toContain('phases: [4]');
      expect(first.out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      const manifest1 = readManifest(tmp);
      expect(manifest1.decisions.some((d) => d.path === CANARY_REL && d.verdict === 'CONFLICT' && d.severity === 'ERROR')).toBe(true);
      // THE FIX: the skipped path's baseline survives the manifest rewrite.
      expect(manifest1.baselines[CANARY_REL]).toBeDefined();
      expect(manifest1.baselines[CANARY_REL]!.hash).toBe(baselineKeyFor(CANARY_REL, DELIVERED_THEN));
      // Land run 1 — the pre-upgrade stash reverts an uncommitted prior wave,
      // so run 2 must start from a commit (same pattern as the tombstone
      // two-run test; delivered hooks unset so the landing commit is not
      // blocked by the /sync-gated pre-commit hook).
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (conflict skipped, copy preserved)');
      // Run 2 — classification must re-derive CONFLICT from the PERSISTED
      // baseline. Pre-fix this was NO_BASELINE → DRIFT_RESTORED (WARN) +
      // COPIED, clobbering the project frontmatter at WARN.
      const second = runUpgrade(tmp);
      expect(second.status).toBe(1);
      expect(readFileSync(join(tmp, CANARY_REL), 'utf8')).toContain('phases: [4]');
      expect(second.out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      expect(second.out).not.toContain('DRIFT (restored to canonical) agents/i18n-specialist.md');
      const manifest2 = readManifest(tmp);
      const decision2 = manifest2.decisions.find((d) => d.path === CANARY_REL);
      expect(decision2).toBeDefined();
      expect(decision2!.verdict).toBe('CONFLICT');
      expect(decision2!.severity).toBe('ERROR');
      expect(manifest2.baselines[CANARY_REL]).toBeDefined();
      expect(manifestHasUnresolvedErrors(manifest2)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('tombstoned path retains its baseline across the manifest rewrite', () => {
    // v2.0.0: rides the tombstone-recorded run (identical seeded state — the
    // honored run skips the path (INFO), nothing delivered for it, so pre-fix
    // the writer dropped its baseline while carrying the tombstone).
    const { tmp, status, manifest } = useShape('tombstone-recorded');
    expect(status).toBe(0);
    expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
    expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
    expect(manifest.baselines[WORKFLOWS_REL]).toBeDefined();
    expect(manifest.baselines[WORKFLOWS_REL]!.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
  }, 180000);

  test('delivered path replaces a stale prior baseline with the fresh disk bytes', () => {
    // v2.0.0 fixture split: the stale-copy state rides the agent-heal-matrix
    // run on agents/designer.md (plain co-develop agent, no render tokens —
    // raw template bytes are the delivery expectation); the version gate and
    // baseline-replacement mechanics are generic per-rel.
    const { tmp, status, manifest } = useShape('agent-heal-matrix');
    expect(status).toBe(0);
    expect(readFileSync(join(tmp, 'agents', 'designer.md'), 'utf8')).toBe(restamped(renderProjectTokens(designerTpl, tmp)));
    expect(manifest.decisions.some((d) => d.path === 'agents/designer.md' && d.verdict === 'ADOPT')).toBe(true);
    const entry = manifest.baselines['agents/designer.md'];
    expect(entry).toBeDefined();
    expect(entry!.hash).not.toBe(baselineKeyFor('agents/designer.md', STALE_DESIGNER));
    expect(entry!.hash).toBe(baselineKeyFor('agents/designer.md', readFileSync(join(tmp, 'agents', 'designer.md'), 'utf8')));
    expect(entry!.templateVersion.length).toBeGreaterThan(0);
  }, 180000);

  test('baseline for a template-departed path is pruned; a retained non-delivered template path survives', () => {
    const RETIRED_REL = 'docs/retired-never-shipped.md';
    const README_REL = 'agents/README.md'; // PRESERVE-class — never delivered, template-side
    const { status, manifest } = useShape('agent-heal-matrix');
    expect(status).toBe(0);
    // Template-departed → pruned (never a classification candidate again).
    expect(manifest.baselines[RETIRED_REL]).toBeUndefined();
    // PRESERVE-class template path, not delivered this run → carried forward
    // verbatim (retention is the fix; the PRESERVE pass never re-baselines).
    expect(manifest.baselines[README_REL]).toBeDefined();
    expect(manifest.baselines[README_REL]!.hash).toBe(baselineKeyFor(README_REL, 'prior readme delivery bytes\n'));
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// --changelog-entry (2026-10-29-delivery-bookkeeping-engine design A3 —
// DEC-20261029-01): opt-in CHANGELOG entry scaffolding, default OFF at the
// engine (CHANGELOG.md is project-owned). The pure insert/section/idempotency
// cases live in tests/unit/upgrade-restamp.test.ts; these pin the engine
// wiring: the scaffolded entry rides the recorded delivery (files[]
// attribution), a repeated version is skipped, the default run never touches
// the file, and the flag is refused under --dry-run (apply-mode only).
// (v2.0.0: this describe moved AHEAD of the stub suites so their wave-2
// riders execute after the run they assert against.)
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts --changelog-entry (A3)', () => {
  const templateVersion = readFileSync(join(workspaceRoot, 'templates', 'VERSION'), 'utf8').trim();
  const verEsc = templateVersion.replace(/\./g, '\\.');
  const entryRe = new RegExp(`^- \\*\\*\\[${deliveryDate}\\]\\*\\*: chore\\(upgrade\\): template sync v${verEsc} \\(\\d+ file\\(s\\) delivered; engine-scaffolded — edit or merge before commit; see templates/CHANGELOG\\.md v${verEsc}\\)$`, 'm');

  test('apply with the flag scaffolds one entry into [Unreleased], rides files[] attribution, and is idempotent on re-run', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n- curated project entry\n\n## [0.1.0] - 2026-10-01\n\n- released\n');
      commitAll(tmp, 'chore: changelog fixture');
      const first = runUpgrade(tmp, ['--changelog-entry']);
      expect(first.status).toBe(0);
      const after = readFileSync(join(tmp, 'CHANGELOG.md'), 'utf8');
      // One entry at the top of [Unreleased]; the curated bullet stays below;
      // historical sections untouched.
      expect(after).toMatch(entryRe);
      const lines = after.split('\n');
      const unreleased = lines.findIndex((l) => l === '## [Unreleased]');
      expect(lines[unreleased + 1]).toMatch(/chore\(upgrade\): template sync v/);
      expect(lines[unreleased + 1]).toContain('engine-scaffolded');
      expect(lines[unreleased + 3]).toBe('- curated project entry');
      expect(after).toContain('## [0.1.0] - 2026-10-01');
      // The CHANGELOG change rides the recorded delivery (files[] attribution).
      const manifest1 = readManifest(tmp);
      expect(manifest1.files).toContain('CHANGELOG.md');
      // Idempotent: a second run at the same template version adds nothing.
      // v2.0.0: run 2's project also seeds a COMPLETE pm.md stub (version ==
      // the counterpart → no backfill, no divergence) so the stub FM and
      // STUB_VERSION_DIVERGENCE suites assert their no-op rows against this
      // same run (the wave-2 fixture cache).
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), makeStub(counterpartVersion));
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (changelog scaffolded; complete stub seeded)');
      const second = runUpgrade(tmp, ['--changelog-entry']);
      expect(second.status).toBe(0);
      const occurrences = readFileSync(join(tmp, 'CHANGELOG.md'), 'utf8').split('\n').filter((l) => l.includes(`template sync v${templateVersion}`)).length;
      expect(occurrences).toBe(1);
      changelogWave2 = { tmp, status: second.status, out: second.out, manifest: readManifest(tmp) };
    } finally {
      // The wave-2 fixture is shared with the stub suites — cleanup happens
      // in the file-level afterAll, not here.
    }
  }, 240000);

  test('default OFF: a run without the flag never touches CHANGELOG.md', () => {
    const { tmp, status } = useShape('fresh-governance');
    expect(status).toBe(0);
    expect(readFileSync(join(tmp, 'CHANGELOG.md'), 'utf8')).toBe(GOVERNANCE_CHANGELOG_SEED);
  }, 180000);

  test('--changelog-entry is refused under --dry-run (apply-mode only)', () => {
    // v2.0.0: rides the fresh-governance project (its CHANGELOG is exactly the
    // governance seed) — the refusal is flag-parse-level and persists nothing.
    const { tmp } = useShape('fresh-governance');
    const { status, out } = runUpgrade(tmp, ['--dry-run', '--changelog-entry']);
    expect(status).toBe(1);
    expect(out).toContain('apply-mode only');
    expect(readFileSync(join(tmp, 'CHANGELOG.md'), 'utf8')).toBe(GOVERNANCE_CHANGELOG_SEED);
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Stub frontmatter scalar backfill in the agents/ pass (T-20261028-010 — spec
// docs/designs/2026-10-28-stub-frontmatter-backfill-design.md): the STUB skip
// branch (MERGE_MANAGED agents/pm.md) backfills MISSING top-level scalar
// tier/version/last_updated from the template counterpart with one
// STUB_FM_BACKFILL (INFO) decision row; bodies stay project-owned.
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts stub FM backfill (T-20261028-010)', () => {
  const extractFm = (content: string): string => content.match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0] ?? '';

  test('stale stub without tier/version/last_updated gets all three backfilled + INFO manifest row', () => {
    // v2.0.0: rides the fresh-governance run (the shape seeds exactly this
    // stale-stub state on agents/pm.md; the governance seeds are per-path
    // orthogonal to the stub branch).
    const { tmp, status, out, manifest } = useShape('fresh-governance');
    expect(status).toBe(0);
    const after = readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8');
    // Frontmatter filled from the template counterpart (tier) / delivery date.
    expect(after).toContain('tier: medium');
    expect(after).toContain(`version: "${counterpartVersion}"`);
    expect(after.match(/^last_updated: \d{4}-\d{2}-\d{2}$/m)).toBeTruthy();
    // Body stays project-owned — the fixture body line survives the run.
    expect(after).toContain('Fixture stub body line that stays project-owned.');
    expect(out).toContain('STUB FM BACKFILL: agents/pm.md');
    const row = manifest.decisions.find((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_FM_BACKFILL');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('INFO');
    expect(row!.detail).toContain('tier');
    expect(row!.detail).toContain('frontmatter only');
  }, 180000);

  test('stub whose frontmatter already carries the fields: frontmatter byte-identical, no backfill row', () => {
    // v2.0.0: rides the changelog lifecycle's wave-2 run, whose project seeds
    // exactly this complete stub (version == the counterpart). The backfill
    // is a no-op: the frontmatter gains no key (the MERGE pass may union
    // managed body blocks, and a MERGE-delivered file is then legitimately
    // re-stamped by the v1.74.0 post-delivery restamp — so the comparison
    // excludes the last_updated line; the helper-level test in
    // tests/unit/upgrade-policy-decisions.test.ts pins the strict
    // byte-identity).
    const fm = [
      '---',
      'extends: ../../../agents/pm.md',
      'name: pm',
      `variant: ${VARIANT}`,
      `version: "${counterpartVersion}"`,
      'last_updated: "2026-10-27"',
      'status: active',
      'tier: medium',
      '---',
    ].join('\n');
    const { tmp, status, manifest } = useChangelogWave2();
    expect(status).toBe(0);
    const after = readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8');
    const stripLu = (s: string): string => s.split('\n').filter((l) => !/^last_updated:/.test(l)).join('\n');
    expect(stripLu(extractFm(after))).toBe(stripLu(fm));
    expect(manifest.decisions.some((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_FM_BACKFILL')).toBe(false);
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// STUB_VERSION_DIVERGENCE (2026-10-29-delivery-bookkeeping-engine design D1 —
// DEC-20261029-01): the stub-frontmatter backfill contract blesses a pinned
// older stub `version` as deliberate project divergence (never overwritten),
// but the divergence was invisible — the decision log showed only the STUB
// skip. The agents/ STUB skip arm now records an INFO row naming both
// versions (INFO, not WARN: the pin is sanctioned; repeat-per-run accepted,
// same as STUB_VERSION_BUMP_ADVICE).
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts STUB_VERSION_DIVERGENCE (D1)', () => {
  test('stub pinned at an older version → STUB_VERSION_DIVERGENCE (INFO) row naming both versions', () => {
    // v2.0.0: rides the agent-heal-matrix run (the shape seeds exactly this
    // pinned stub on the MERGE_MANAGED pm.md path).
    const shape = useShape('agent-heal-matrix');
    const { tmp, status, manifest } = shape;
    expect(status).toBe(0);
    expect(counterpartVersion.length).toBeGreaterThan(0);
    // The pin survives: backfill never overwrites the existing version.
    expect(readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8')).toContain('version: "0.9.0"');
    const row = manifest.decisions.find((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_VERSION_DIVERGENCE');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('INFO');
    expect(row!.detail).toContain('stub version 0.9.0 pinned vs counterpart');
    expect(row!.detail).toContain(counterpartVersion);
    expect(row!.detail).toContain('backfill never overwrites');
    // The row rides AFTER the primary skip rows — a consumer reading the
    // path's FIRST decision row still sees the verdict.
    const firstPmRow = manifest.decisions.find((d) => d.path === 'agents/pm.md');
    expect(firstPmRow!.verdict).not.toBe('STUB_VERSION_DIVERGENCE');
  }, 180000);

  test('stub at the counterpart version → no divergence row', () => {
    // v2.0.0: rides the changelog wave-2 run (the complete stub seeded there
    // pins version == the counterpart — no divergence to report).
    const { status, manifest } = useChangelogWave2();
    expect(status).toBe(0);
    expect(manifest.decisions.some((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_VERSION_DIVERGENCE')).toBe(false);
  }, 180000);
});
